#!/usr/bin/env bash
# =============================================================
# import_subvenciones.sh
# Crea la tabla dim_monto_subvencion en PostgreSQL y carga los
# datos del archivo CSV de Detalle Subvenciones 2023.
#
# Estrategia:
#   1. Preprocesa el CSV (latin-1 → UTF-8, normaliza cabeceras)
#   2. Copia el CSV procesado al contenedor Docker
#   3. Crea tabla staging (todo TEXT) y hace COPY
#   4. INSERT final con casteo de tipos a dim_monto_subvencion
#
# Uso:
#   bash import_subvenciones.sh          # crea tabla si no existe
#   bash import_subvenciones.sh --drop   # elimina y recrea la tabla
#
# Requiere: Docker container pirgefse_db corriendo
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../.env"

BBDD_DIR="${SCRIPT_DIR}/../../BBDD"
CONTAINER="pirgefse_db"
DROP_TABLE=false

# ---- Parsear argumentos ----
for arg in "$@"; do
    case $arg in
        --drop) DROP_TABLE=true ;;
        *) echo "Argumento desconocido: $arg"; exit 1 ;;
    esac
done

CSV_SOURCE="${BBDD_DIR}/Subvenciones-a-EE-2023/20240606_Detalle Subvenciones 2023_20240605.csv"
TMP_CSV="/tmp/subvenciones_2023.csv"
CONTAINER_CSV="/tmp/subvenciones_2023.csv"

echo "============================================================"
echo "  PIRGEFSE — Importando dim_monto_subvencion"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# ---- 1. Verificar container ----
echo ""
echo ">>> [1/5] Verificando contenedor Docker..."
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "  ERROR: El contenedor '${CONTAINER}' no está corriendo."
    echo "         Ejecuta: cd docker && docker compose up -d"
    exit 1
fi
echo "  ✅ Contenedor '${CONTAINER}' activo."

# ---- 2. Verificar archivo fuente ----
echo ""
echo ">>> [2/5] Verificando archivo CSV..."
if [ ! -f "${CSV_SOURCE}" ]; then
    echo "  ERROR: No se encontró el CSV en:"
    echo "         ${CSV_SOURCE}"
    exit 1
fi
NLINES=$(wc -l < "${CSV_SOURCE}")
echo "  ✅ Archivo encontrado: $(basename "${CSV_SOURCE}")"
echo "     Líneas totales (incl. cabecera): ${NLINES}"

# ---- 3. Preprocesar CSV: latin-1 → UTF-8, limpiar \r, normalizar cabeceras ----
echo ""
echo ">>> [3/5] Preprocesando CSV (latin-1 → UTF-8)..."

python3 - "${CSV_SOURCE}" "${TMP_CSV}" <<'PYEOF'
import sys
import csv
import io

src, dst = sys.argv[1], sys.argv[2]

# Leer en latin-1
with open(src, 'r', encoding='latin-1', newline='') as f:
    content = f.read()

# Normalizar saltos de línea Windows (\r\n → \n) y \r sueltos
content = content.replace('\r\n', '\n').replace('\r', '\n')

# Mapeo de cabeceras: normalizar las columnas con Ñ corrompida
HEADER_MAP = {
    # Cualquier variante de DESEMPEÑO con encoding roto → nombre limpio
    'DESEMPEÑO_DIFICIL':         'DESEMPENO_DIFICIL',
    'DESEMPEÃO_DIFICIL':         'DESEMPENO_DIFICIL',
    'DESEMPEÃ\x91O_DIFICIL':     'DESEMPENO_DIFICIL',
    'DESEMPEÑO_DIFICIL_NODOC':   'DESEMPENO_DIFICIL_NODOC',
    'DESEMPEÃO_DIFICIL_NODOC':   'DESEMPENO_DIFICIL_NODOC',
    'DESEMPEÃ\x91O_DIFICIL_NODOC': 'DESEMPENO_DIFICIL_NODOC',
    # Otras cabeceras que pueden variar
    'DONACIONAPLICADA':          'DONACION_APLICADA',
}

reader = csv.reader(io.StringIO(content), delimiter=';')
rows = list(reader)

if not rows:
    print("ERROR: CSV vacío", file=sys.stderr)
    sys.exit(1)

# Normalizar cabecera
header = [HEADER_MAP.get(col.strip(), col.strip()) for col in rows[0]]

# Detectar posición de columnas críticas por posición (fallback robusto)
# índice esperado según inspección: [31]=DESEMPENO_DIFICIL, [32]=DESEMPENO_DIFICIL_NODOC
for i, h in enumerate(header):
    if 'DESEMPE' in h.upper() and 'NODOC' not in h.upper():
        header[i] = 'DESEMPENO_DIFICIL'
    elif 'DESEMPE' in h.upper() and 'NODOC' in h.upper():
        header[i] = 'DESEMPENO_DIFICIL_NODOC'

print(f"  Cabeceras normalizadas: {len(header)} columnas")
print(f"  [31]={header[31]}  [32]={header[32]}")

# Escribir CSV limpio en UTF-8
with open(dst, 'w', encoding='utf-8', newline='\n') as f:
    writer = csv.writer(f, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    writer.writerow(header)
    for row in rows[1:]:
        # Filtrar filas completamente vacías
        if any(cell.strip() for cell in row):
            writer.writerow(row)

import os
size_mb = os.path.getsize(dst) / 1024 / 1024
print(f"  CSV procesado guardado en: {dst} ({size_mb:.1f} MB)")
PYEOF

echo "  ✅ Preprocesamiento completado."

# ---- 4. Copiar CSV al contenedor ----
echo ""
echo ">>> [4/5] Copiando CSV al contenedor ${CONTAINER}..."
docker cp "${TMP_CSV}" "${CONTAINER}:${CONTAINER_CSV}"
rm -f "${TMP_CSV}"
echo "  ✅ CSV copiado a ${CONTAINER_CSV} dentro del contenedor."

# ---- 5. Crear tabla y cargar datos ----
echo ""
echo ">>> [5/5] Creando tabla y cargando datos en PostgreSQL..."

docker exec -i "${CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
    --set ON_ERROR_STOP=1 <<SQL

-- ================================================================
-- PASO A: Eliminar tabla si se solicitó --drop
-- ================================================================
$(if [ "${DROP_TABLE}" = true ]; then
    echo "\\echo '>>> Eliminando dim_monto_subvencion (--drop solicitado)...'"
    echo "DROP TABLE IF EXISTS dim_monto_subvencion CASCADE;"
fi)

-- ================================================================
-- PASO B: Crear tabla destino dim_monto_subvencion
-- ================================================================
\echo '>>> Creando tabla dim_monto_subvencion...'

CREATE TABLE IF NOT EXISTS dim_monto_subvencion (
    id                          SERIAL          PRIMARY KEY,
    -- Periodo
    agno                        SMALLINT        NOT NULL,
    mes                         SMALLINT        NOT NULL,
    -- Establecimiento educacional
    rbd                         INTEGER         NOT NULL,
    nombre_rbd                  TEXT,
    -- Sostenedor
    rut_sostenedor              BIGINT,
    nom_sostenedor              TEXT,
    -- Ubicación geográfica
    cod_reg_rbd                 SMALLINT,
    nom_reg_rbd                 VARCHAR(100),
    cod_pro_rbd                 SMALLINT,
    cod_com_rbd                 INTEGER,
    nom_com_rbd                 VARCHAR(100),
    cod_deprov_rbd              SMALLINT,
    nom_deprov_rbd              VARCHAR(100),
    -- Dependencia y ruralidad
    cod_depe                    SMALLINT,
    cod_depe2                   SMALLINT,
    rural_rbd                   SMALLINT,
    -- Matrícula
    matricula                   INTEGER,
    -- Montos de subvenciones (en pesos chilenos)
    escolaridad                 BIGINT,
    escolaridad_pie             BIGINT,
    internado                   BIGINT,
    porc_zona                   SMALLINT,
    monto_asig_zona             BIGINT,
    descuento_ficom             BIGINT,
    aporte_estado_ficom         BIGINT,
    ruralidad                   BIGINT,
    piso_rural                  BIGINT,
    discrepancia                BIGINT,
    donacion_aplicada           BIGINT,
    reintegros                  BIGINT,
    retenciones                 BIGINT,
    multas                      BIGINT,
    desempeno_dificil           BIGINT,
    desempeno_dificil_nodoc     BIGINT,
    subv_adicional_especial     BIGINT,
    subv_asistentes_educacion   BIGINT,
    profesor_encargado          BIGINT,
    reliquidacion               BIGINT,
    apor_gratuidad              BIGINT,
    sub_normal                  BIGINT,
    sep_prio                    BIGINT,
    sep_pref                    BIGINT,
    mantenimiento               BIGINT,
    sned                        BIGINT,
    proretencion                BIGINT,
    reforzamiento               BIGINT,
    -- Un registro por establecimiento por mes
    UNIQUE (agno, rbd, mes)
);

-- Índices para consultas frecuentes del dashboard
CREATE INDEX IF NOT EXISTS idx_subv_rbd      ON dim_monto_subvencion (rbd);
CREATE INDEX IF NOT EXISTS idx_subv_agno     ON dim_monto_subvencion (agno);
CREATE INDEX IF NOT EXISTS idx_subv_mes      ON dim_monto_subvencion (mes);
CREATE INDEX IF NOT EXISTS idx_subv_com      ON dim_monto_subvencion (cod_com_rbd);
CREATE INDEX IF NOT EXISTS idx_subv_rut_sost ON dim_monto_subvencion (rut_sostenedor);
CREATE INDEX IF NOT EXISTS idx_subv_reg      ON dim_monto_subvencion (cod_reg_rbd);

\echo '  ✅ Tabla e índices creados.'

-- ================================================================
-- PASO C: Tabla staging (todo TEXT para COPY sin errores de tipo)
-- ================================================================
\echo '>>> Creando tabla staging temporal...'

DROP TABLE IF EXISTS _stg_subvenciones;
CREATE TEMP TABLE _stg_subvenciones (
    agno                    TEXT,
    rbd                     TEXT,
    nombre_rbd              TEXT,
    rut_sostenedor          TEXT,
    nom_sostenedor          TEXT,
    cod_reg_rbd             TEXT,
    nom_reg_rbd             TEXT,
    cod_pro_rbd             TEXT,
    cod_com_rbd             TEXT,
    nom_com_rbd             TEXT,
    cod_deprov_rbd          TEXT,
    nom_deprov_rbd          TEXT,
    cod_depe                TEXT,
    cod_depe2               TEXT,
    rural_rbd               TEXT,
    mes                     TEXT,
    matricula               TEXT,
    escolaridad             TEXT,
    escolaridad_pie         TEXT,
    internado               TEXT,
    porc_zona               TEXT,
    monto_asig_zona         TEXT,
    descuento_ficom         TEXT,
    aporte_estado_ficom     TEXT,
    ruralidad               TEXT,
    piso_rural              TEXT,
    discrepancia            TEXT,
    donacion_aplicada       TEXT,
    reintegros              TEXT,
    retenciones             TEXT,
    multas                  TEXT,
    desempeno_dificil       TEXT,
    desempeno_dificil_nodoc TEXT,
    subv_adicional_especial TEXT,
    subv_asistentes_educacion TEXT,
    profesor_encargado      TEXT,
    reliquidacion           TEXT,
    apor_gratuidad          TEXT,
    sub_normal              TEXT,
    sep_prio                TEXT,
    sep_pref                TEXT,
    mantenimiento           TEXT,
    sned                    TEXT,
    proretencion            TEXT,
    reforzamiento           TEXT
);

-- ================================================================
-- PASO D: COPY desde el archivo CSV (ya en UTF-8)
-- ================================================================
\echo '>>> Cargando CSV en staging...'

COPY _stg_subvenciones
FROM '${CONTAINER_CSV}'
WITH (
    FORMAT CSV,
    HEADER TRUE,
    DELIMITER ';',
    NULL '',
    ENCODING 'UTF8'
);

\echo 'Filas cargadas en staging:'
SELECT COUNT(*) AS filas_staging FROM _stg_subvenciones;

-- ================================================================
-- PASO E: INSERT a tabla destino con casteo de tipos
-- ================================================================
\echo '>>> Insertando en dim_monto_subvencion...'

INSERT INTO dim_monto_subvencion (
    agno, mes, rbd, nombre_rbd,
    rut_sostenedor, nom_sostenedor,
    cod_reg_rbd, nom_reg_rbd, cod_pro_rbd, cod_com_rbd, nom_com_rbd,
    cod_deprov_rbd, nom_deprov_rbd,
    cod_depe, cod_depe2, rural_rbd,
    matricula,
    escolaridad, escolaridad_pie, internado,
    porc_zona, monto_asig_zona,
    descuento_ficom, aporte_estado_ficom,
    ruralidad, piso_rural, discrepancia,
    donacion_aplicada, reintegros, retenciones, multas,
    desempeno_dificil, desempeno_dificil_nodoc,
    subv_adicional_especial, subv_asistentes_educacion,
    profesor_encargado, reliquidacion,
    apor_gratuidad, sub_normal,
    sep_prio, sep_pref, mantenimiento,
    sned, proretencion, reforzamiento
)
SELECT
    NULLIF(TRIM(agno),  '')::SMALLINT,
    NULLIF(TRIM(mes),   '')::SMALLINT,
    NULLIF(TRIM(rbd),   '')::INTEGER,
    NULLIF(TRIM(nombre_rbd), ''),
    NULLIF(TRIM(rut_sostenedor), '')::BIGINT,
    NULLIF(TRIM(nom_sostenedor), ''),
    NULLIF(TRIM(cod_reg_rbd),    '')::SMALLINT,
    NULLIF(TRIM(nom_reg_rbd),    ''),
    NULLIF(TRIM(cod_pro_rbd),    '')::SMALLINT,
    NULLIF(TRIM(cod_com_rbd),    '')::INTEGER,
    NULLIF(TRIM(nom_com_rbd),    ''),
    NULLIF(TRIM(cod_deprov_rbd), '')::SMALLINT,
    NULLIF(TRIM(nom_deprov_rbd), ''),
    NULLIF(TRIM(cod_depe),       '')::SMALLINT,
    NULLIF(TRIM(cod_depe2),      '')::SMALLINT,
    NULLIF(TRIM(rural_rbd),      '')::SMALLINT,
    NULLIF(TRIM(matricula),      '')::INTEGER,
    NULLIF(TRIM(escolaridad),             '')::BIGINT,
    NULLIF(TRIM(escolaridad_pie),         '')::BIGINT,
    NULLIF(TRIM(internado),               '')::BIGINT,
    NULLIF(TRIM(porc_zona),               '')::SMALLINT,
    NULLIF(TRIM(monto_asig_zona),         '')::BIGINT,
    NULLIF(TRIM(descuento_ficom),         '')::BIGINT,
    NULLIF(TRIM(aporte_estado_ficom),     '')::BIGINT,
    NULLIF(TRIM(ruralidad),               '')::BIGINT,
    NULLIF(TRIM(piso_rural),              '')::BIGINT,
    NULLIF(TRIM(discrepancia),            '')::BIGINT,
    NULLIF(TRIM(donacion_aplicada),       '')::BIGINT,
    NULLIF(TRIM(reintegros),              '')::BIGINT,
    NULLIF(TRIM(retenciones),             '')::BIGINT,
    NULLIF(TRIM(multas),                  '')::BIGINT,
    NULLIF(TRIM(desempeno_dificil),       '')::BIGINT,
    NULLIF(TRIM(desempeno_dificil_nodoc), '')::BIGINT,
    NULLIF(TRIM(subv_adicional_especial),   '')::BIGINT,
    NULLIF(TRIM(subv_asistentes_educacion), '')::BIGINT,
    NULLIF(TRIM(profesor_encargado),        '')::BIGINT,
    NULLIF(TRIM(reliquidacion),             '')::BIGINT,
    NULLIF(TRIM(apor_gratuidad),            '')::BIGINT,
    NULLIF(TRIM(sub_normal),                '')::BIGINT,
    NULLIF(TRIM(sep_prio),                  '')::BIGINT,
    NULLIF(TRIM(sep_pref),                  '')::BIGINT,
    NULLIF(TRIM(mantenimiento),             '')::BIGINT,
    NULLIF(TRIM(sned),                      '')::BIGINT,
    NULLIF(TRIM(proretencion),              '')::BIGINT,
    NULLIF(TRIM(reforzamiento),             '')::BIGINT
FROM _stg_subvenciones
WHERE TRIM(rbd) ~ '^\d+$'   -- filtrar filas sin RBD válido
  AND TRIM(agno) ~ '^\d+$'
  AND TRIM(mes)  ~ '^\d+$'
ON CONFLICT (agno, rbd, mes) DO UPDATE SET
    nombre_rbd                = EXCLUDED.nombre_rbd,
    rut_sostenedor            = EXCLUDED.rut_sostenedor,
    nom_sostenedor            = EXCLUDED.nom_sostenedor,
    cod_reg_rbd               = EXCLUDED.cod_reg_rbd,
    nom_reg_rbd               = EXCLUDED.nom_reg_rbd,
    cod_pro_rbd               = EXCLUDED.cod_pro_rbd,
    cod_com_rbd               = EXCLUDED.cod_com_rbd,
    nom_com_rbd               = EXCLUDED.nom_com_rbd,
    cod_deprov_rbd            = EXCLUDED.cod_deprov_rbd,
    nom_deprov_rbd            = EXCLUDED.nom_deprov_rbd,
    cod_depe                  = EXCLUDED.cod_depe,
    cod_depe2                 = EXCLUDED.cod_depe2,
    rural_rbd                 = EXCLUDED.rural_rbd,
    matricula                 = EXCLUDED.matricula,
    escolaridad               = EXCLUDED.escolaridad,
    escolaridad_pie           = EXCLUDED.escolaridad_pie,
    internado                 = EXCLUDED.internado,
    porc_zona                 = EXCLUDED.porc_zona,
    monto_asig_zona           = EXCLUDED.monto_asig_zona,
    descuento_ficom           = EXCLUDED.descuento_ficom,
    aporte_estado_ficom       = EXCLUDED.aporte_estado_ficom,
    ruralidad                 = EXCLUDED.ruralidad,
    piso_rural                = EXCLUDED.piso_rural,
    discrepancia              = EXCLUDED.discrepancia,
    donacion_aplicada         = EXCLUDED.donacion_aplicada,
    reintegros                = EXCLUDED.reintegros,
    retenciones               = EXCLUDED.retenciones,
    multas                    = EXCLUDED.multas,
    desempeno_dificil         = EXCLUDED.desempeno_dificil,
    desempeno_dificil_nodoc   = EXCLUDED.desempeno_dificil_nodoc,
    subv_adicional_especial   = EXCLUDED.subv_adicional_especial,
    subv_asistentes_educacion = EXCLUDED.subv_asistentes_educacion,
    profesor_encargado        = EXCLUDED.profesor_encargado,
    reliquidacion             = EXCLUDED.reliquidacion,
    apor_gratuidad            = EXCLUDED.apor_gratuidad,
    sub_normal                = EXCLUDED.sub_normal,
    sep_prio                  = EXCLUDED.sep_prio,
    sep_pref                  = EXCLUDED.sep_pref,
    mantenimiento             = EXCLUDED.mantenimiento,
    sned                      = EXCLUDED.sned,
    proretencion              = EXCLUDED.proretencion,
    reforzamiento             = EXCLUDED.reforzamiento;

DROP TABLE IF EXISTS _stg_subvenciones;

-- ================================================================
-- PASO F: Verificación final
-- ================================================================
\echo ''
\echo '=== Verificación: resumen por mes ==='
SELECT
    mes,
    COUNT(*)                                        AS establecimientos,
    COUNT(DISTINCT rbd)                             AS rbds_unicos,
    SUM(sub_normal)                                 AS total_sub_normal,
    SUM(sep_prio + sep_pref)                        AS total_sep,
    SUM(apor_gratuidad)                             AS total_gratuidad,
    SUM(sub_normal + sep_prio + sep_pref + apor_gratuidad + escolaridad_pie
        + monto_asig_zona + subv_asistentes_educacion + sned + mantenimiento)
                                                    AS monto_total_aprox
FROM dim_monto_subvencion
GROUP BY mes
ORDER BY mes;

\echo ''
\echo '=== Totales generales ==='
SELECT
    COUNT(*)                    AS total_registros,
    COUNT(DISTINCT rbd)         AS rbds_unicos,
    COUNT(DISTINCT rut_sostenedor) AS sostenedores_unicos,
    COUNT(DISTINCT mes)         AS meses_cargados,
    SUM(sub_normal + sep_prio + sep_pref + apor_gratuidad)
                                AS monto_principal_total
FROM dim_monto_subvencion;

\echo ''
\echo '✅ dim_monto_subvencion cargada exitosamente.'
SQL

# Limpiar CSV del contenedor
docker exec "${CONTAINER}" rm -f "${CONTAINER_CSV}"

echo ""
echo "============================================================"
echo "  ✅ dim_monto_subvencion importada exitosamente"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
