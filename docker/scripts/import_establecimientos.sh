#!/usr/bin/env bash
# =============================================================
# import_establecimientos.sh
# Importa el Directorio Oficial de Establecimientos Educacionales
# desde múltiples CSVs anuales a la tabla dim_establecimiento_oficial.
#
# Maneja 3 esquemas según el año:
#   2020-2021 : 37 cols (sin MAT_TOTAL, sin PACE, sin ESPE_*)
#   2022      : 39 cols (con MAT_TOTAL y PACE, sin ESPE_*)
#   2023+     : 50 cols (esquema completo)
#
# Uso: bash import_establecimientos.sh
# Requiere: Docker container pirgefse_db corriendo
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../.env"

BBDD_DIR="${SCRIPT_DIR}/../../BBDD"
CONTAINER="pirgefse_db"

echo "=============================================="
echo " PIRGEFSE — Importando dim_establecimiento_oficial"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# ---- 1. Verificar container ----
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "ERROR: El contenedor '${CONTAINER}' no está corriendo."
    echo "       Ejecuta: docker compose up -d"
    exit 1
fi

# ---- 2. Buscar carpetas ----
echo ""
echo ">>> Buscando carpetas de establecimientos en: ${BBDD_DIR}"
mapfile -t EE_DIRS < <(find "${BBDD_DIR}" -maxdepth 1 -type d -name "*ficial-EE-20*" | sort)

if [ ${#EE_DIRS[@]} -eq 0 ]; then
    echo "ERROR: No se encontraron carpetas con 'ficial-EE-20' en ${BBDD_DIR}"
    exit 1
fi

echo "  Encontradas ${#EE_DIRS[@]} carpeta(s):"
for d in "${EE_DIRS[@]}"; do echo "    - $(basename "$d")"; done

# ---- 3. Crear tabla destino ----
echo ""
echo ">>> [1/3] Creando tabla dim_establecimiento_oficial..."
docker exec -i "${CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
DROP TABLE IF EXISTS dim_establecimiento_oficial;
CREATE TABLE dim_establecimiento_oficial (
    agno            SMALLINT        NOT NULL,
    rbd             INTEGER         NOT NULL,
    dgv_rbd         SMALLINT,
    nom_rbd         TEXT,
    mrun            BIGINT,
    rut_sostenedor  BIGINT,
    p_juridica      SMALLINT,
    cod_reg_rbd     SMALLINT,
    nom_reg_rbd_a   VARCHAR(100),
    cod_pro_rbd     SMALLINT,
    cod_com_rbd     INTEGER,
    nom_com_rbd     TEXT,
    cod_deprov_rbd  SMALLINT,
    nom_deprov_rbd  TEXT,
    cod_depe        SMALLINT,
    cod_depe2       SMALLINT,
    rural_rbd       SMALLINT,
    latitud         DOUBLE PRECISION,
    longitud        DOUBLE PRECISION,
    convenio_pie    SMALLINT,
    pace            SMALLINT,
    ens_01          INTEGER, ens_02 INTEGER, ens_03 INTEGER, ens_04 INTEGER,
    ens_05          INTEGER, ens_06 INTEGER, ens_07 INTEGER, ens_08 INTEGER,
    ens_09          INTEGER, ens_10 INTEGER, ens_11 INTEGER,
    mat_total       INTEGER,
    matricula       SMALLINT,
    estado_estab    SMALLINT,
    ori_religiosa   SMALLINT,
    ori_otro_glosa  TEXT,
    pago_matricula  TEXT,
    pago_mensual    TEXT,
    espe_01         INTEGER, espe_02 INTEGER, espe_03 INTEGER, espe_04 INTEGER,
    espe_05         INTEGER, espe_06 INTEGER, espe_07 INTEGER, espe_08 INTEGER,
    espe_09         INTEGER, espe_10 INTEGER, espe_11 INTEGER,
    PRIMARY KEY (agno, rbd)
);
CREATE INDEX idx_ee_rut_sostenedor ON dim_establecimiento_oficial(rut_sostenedor);
CREATE INDEX idx_ee_agno           ON dim_establecimiento_oficial(agno);
CREATE INDEX idx_ee_cod_reg        ON dim_establecimiento_oficial(cod_reg_rbd);
\echo '✅ Tabla dim_establecimiento_oficial creada.'
SQL

# ---- 4. Función auxiliar para generar SQL según esquema ----
generate_sql() {
    local AGNO=$1
    local NCOLS=$2
    local CSV_PATH="/tmp/establecimientos_${AGNO}.csv"

    # Cabecera común
    cat <<SQLHEAD
DROP TABLE IF EXISTS _stg_establecimientos;
SQLHEAD

    # CREATE TEMP TABLE según número de columnas
    if [ "${NCOLS}" -le 37 ]; then
        cat <<SQLSTG
CREATE TEMP TABLE _stg_establecimientos (
    agno TEXT, rbd TEXT, dgv_rbd TEXT, nom_rbd TEXT, mrun TEXT,
    rut_sostenedor TEXT, p_juridica TEXT,
    cod_reg_rbd TEXT, nom_reg_rbd_a TEXT, cod_pro_rbd TEXT,
    cod_com_rbd TEXT, nom_com_rbd TEXT, cod_deprov_rbd TEXT, nom_deprov_rbd TEXT,
    cod_depe TEXT, cod_depe2 TEXT,
    rural_rbd TEXT, latitud TEXT, longitud TEXT, convenio_pie TEXT,
    ens_01 TEXT, ens_02 TEXT, ens_03 TEXT, ens_04 TEXT, ens_05 TEXT,
    ens_06 TEXT, ens_07 TEXT, ens_08 TEXT, ens_09 TEXT, ens_10 TEXT, ens_11 TEXT,
    matricula TEXT, estado_estab TEXT,
    ori_religiosa TEXT, ori_otro_glosa TEXT, pago_matricula TEXT, pago_mensual TEXT
);
SQLSTG
    elif [ "${NCOLS}" -le 39 ]; then
        cat <<SQLSTG
CREATE TEMP TABLE _stg_establecimientos (
    agno TEXT, rbd TEXT, dgv_rbd TEXT, nom_rbd TEXT, mrun TEXT,
    rut_sostenedor TEXT, p_juridica TEXT,
    cod_reg_rbd TEXT, nom_reg_rbd_a TEXT, cod_pro_rbd TEXT,
    cod_com_rbd TEXT, nom_com_rbd TEXT, cod_deprov_rbd TEXT, nom_deprov_rbd TEXT,
    cod_depe TEXT, cod_depe2 TEXT,
    rural_rbd TEXT, latitud TEXT, longitud TEXT, convenio_pie TEXT, pace TEXT,
    ens_01 TEXT, ens_02 TEXT, ens_03 TEXT, ens_04 TEXT, ens_05 TEXT,
    ens_06 TEXT, ens_07 TEXT, ens_08 TEXT, ens_09 TEXT, ens_10 TEXT, ens_11 TEXT,
    mat_total TEXT, matricula TEXT, estado_estab TEXT,
    ori_religiosa TEXT, ori_otro_glosa TEXT, pago_matricula TEXT, pago_mensual TEXT
);
SQLSTG
    else
        cat <<SQLSTG
CREATE TEMP TABLE _stg_establecimientos (
    agno TEXT, rbd TEXT, dgv_rbd TEXT, nom_rbd TEXT, mrun TEXT,
    rut_sostenedor TEXT, p_juridica TEXT,
    cod_reg_rbd TEXT, nom_reg_rbd_a TEXT, cod_pro_rbd TEXT,
    cod_com_rbd TEXT, nom_com_rbd TEXT, cod_deprov_rbd TEXT, nom_deprov_rbd TEXT,
    cod_depe TEXT, cod_depe2 TEXT,
    rural_rbd TEXT, latitud TEXT, longitud TEXT, convenio_pie TEXT, pace TEXT,
    ens_01 TEXT, ens_02 TEXT, ens_03 TEXT, ens_04 TEXT, ens_05 TEXT,
    ens_06 TEXT, ens_07 TEXT, ens_08 TEXT, ens_09 TEXT, ens_10 TEXT, ens_11 TEXT,
    mat_total TEXT, matricula TEXT, estado_estab TEXT,
    ori_religiosa TEXT, ori_otro_glosa TEXT, pago_matricula TEXT, pago_mensual TEXT,
    espe_01 TEXT, espe_02 TEXT, espe_03 TEXT, espe_04 TEXT, espe_05 TEXT,
    espe_06 TEXT, espe_07 TEXT, espe_08 TEXT, espe_09 TEXT, espe_10 TEXT, espe_11 TEXT
);
SQLSTG
    fi

    # COPY
    echo "COPY _stg_establecimientos FROM '${CSV_PATH}'"
    echo "WITH (FORMAT CSV, HEADER TRUE, DELIMITER ';', NULL '', ENCODING 'UTF8');"
    echo "\\echo 'Staging OK. Filas:'"
    echo "SELECT COUNT(*) FROM _stg_establecimientos;"

    # DELETE + INSERT
    echo "DELETE FROM dim_establecimiento_oficial WHERE agno = ${AGNO}::SMALLINT;"

    if [ "${NCOLS}" -le 37 ]; then
        # 2020-2021: sin mat_total, sin pace, sin espe_*
        cat <<SQLIN
INSERT INTO dim_establecimiento_oficial
    (agno,rbd,dgv_rbd,nom_rbd,mrun,rut_sostenedor,p_juridica,
     cod_reg_rbd,nom_reg_rbd_a,cod_pro_rbd,cod_com_rbd,nom_com_rbd,
     cod_deprov_rbd,nom_deprov_rbd,cod_depe,cod_depe2,
     rural_rbd,latitud,longitud,convenio_pie,
     ens_01,ens_02,ens_03,ens_04,ens_05,ens_06,ens_07,ens_08,ens_09,ens_10,ens_11,
     matricula,estado_estab,ori_religiosa,ori_otro_glosa,pago_matricula,pago_mensual)
SELECT
    TRIM(agno)::SMALLINT, TRIM(rbd)::INTEGER,
    NULLIF(TRIM(dgv_rbd),'')::SMALLINT, NULLIF(TRIM(nom_rbd),''),
    NULLIF(TRIM(mrun),'')::BIGINT, NULLIF(TRIM(rut_sostenedor),'')::BIGINT,
    NULLIF(TRIM(p_juridica),'')::SMALLINT,
    NULLIF(TRIM(cod_reg_rbd),'')::SMALLINT, NULLIF(TRIM(nom_reg_rbd_a),''),
    NULLIF(TRIM(cod_pro_rbd),'')::SMALLINT, NULLIF(TRIM(cod_com_rbd),'')::INTEGER,
    NULLIF(TRIM(nom_com_rbd),''), NULLIF(TRIM(cod_deprov_rbd),'')::SMALLINT,
    NULLIF(TRIM(nom_deprov_rbd),''), NULLIF(TRIM(cod_depe),'')::SMALLINT,
    NULLIF(TRIM(cod_depe2),'')::SMALLINT, NULLIF(TRIM(rural_rbd),'')::SMALLINT,
    NULLIF(TRIM(latitud),'')::DOUBLE PRECISION, NULLIF(TRIM(longitud),'')::DOUBLE PRECISION,
    NULLIF(TRIM(convenio_pie),'')::SMALLINT,
    NULLIF(TRIM(ens_01),'')::INTEGER, NULLIF(TRIM(ens_02),'')::INTEGER,
    NULLIF(TRIM(ens_03),'')::INTEGER, NULLIF(TRIM(ens_04),'')::INTEGER,
    NULLIF(TRIM(ens_05),'')::INTEGER, NULLIF(TRIM(ens_06),'')::INTEGER,
    NULLIF(TRIM(ens_07),'')::INTEGER, NULLIF(TRIM(ens_08),'')::INTEGER,
    NULLIF(TRIM(ens_09),'')::INTEGER, NULLIF(TRIM(ens_10),'')::INTEGER,
    NULLIF(TRIM(ens_11),'')::INTEGER,
    NULLIF(TRIM(matricula),'')::SMALLINT, NULLIF(TRIM(estado_estab),'')::SMALLINT,
    NULLIF(TRIM(ori_religiosa),'')::SMALLINT, NULLIF(TRIM(ori_otro_glosa),''),
    NULLIF(TRIM(pago_matricula),''), NULLIF(TRIM(pago_mensual),'')
FROM _stg_establecimientos;
SQLIN
    elif [ "${NCOLS}" -le 39 ]; then
        # 2022: con mat_total y pace, sin espe_*
        cat <<SQLIN
INSERT INTO dim_establecimiento_oficial
    (agno,rbd,dgv_rbd,nom_rbd,mrun,rut_sostenedor,p_juridica,
     cod_reg_rbd,nom_reg_rbd_a,cod_pro_rbd,cod_com_rbd,nom_com_rbd,
     cod_deprov_rbd,nom_deprov_rbd,cod_depe,cod_depe2,
     rural_rbd,latitud,longitud,convenio_pie,pace,
     ens_01,ens_02,ens_03,ens_04,ens_05,ens_06,ens_07,ens_08,ens_09,ens_10,ens_11,
     mat_total,matricula,estado_estab,ori_religiosa,ori_otro_glosa,
     pago_matricula,pago_mensual)
SELECT
    TRIM(agno)::SMALLINT, TRIM(rbd)::INTEGER,
    NULLIF(TRIM(dgv_rbd),'')::SMALLINT, NULLIF(TRIM(nom_rbd),''),
    NULLIF(TRIM(mrun),'')::BIGINT, NULLIF(TRIM(rut_sostenedor),'')::BIGINT,
    NULLIF(TRIM(p_juridica),'')::SMALLINT,
    NULLIF(TRIM(cod_reg_rbd),'')::SMALLINT, NULLIF(TRIM(nom_reg_rbd_a),''),
    NULLIF(TRIM(cod_pro_rbd),'')::SMALLINT, NULLIF(TRIM(cod_com_rbd),'')::INTEGER,
    NULLIF(TRIM(nom_com_rbd),''), NULLIF(TRIM(cod_deprov_rbd),'')::SMALLINT,
    NULLIF(TRIM(nom_deprov_rbd),''), NULLIF(TRIM(cod_depe),'')::SMALLINT,
    NULLIF(TRIM(cod_depe2),'')::SMALLINT, NULLIF(TRIM(rural_rbd),'')::SMALLINT,
    NULLIF(TRIM(latitud),'')::DOUBLE PRECISION, NULLIF(TRIM(longitud),'')::DOUBLE PRECISION,
    NULLIF(TRIM(convenio_pie),'')::SMALLINT, NULLIF(TRIM(pace),'')::SMALLINT,
    NULLIF(TRIM(ens_01),'')::INTEGER, NULLIF(TRIM(ens_02),'')::INTEGER,
    NULLIF(TRIM(ens_03),'')::INTEGER, NULLIF(TRIM(ens_04),'')::INTEGER,
    NULLIF(TRIM(ens_05),'')::INTEGER, NULLIF(TRIM(ens_06),'')::INTEGER,
    NULLIF(TRIM(ens_07),'')::INTEGER, NULLIF(TRIM(ens_08),'')::INTEGER,
    NULLIF(TRIM(ens_09),'')::INTEGER, NULLIF(TRIM(ens_10),'')::INTEGER,
    NULLIF(TRIM(ens_11),'')::INTEGER,
    NULLIF(TRIM(mat_total),'')::INTEGER,
    NULLIF(TRIM(matricula),'')::SMALLINT, NULLIF(TRIM(estado_estab),'')::SMALLINT,
    NULLIF(TRIM(ori_religiosa),'')::SMALLINT, NULLIF(TRIM(ori_otro_glosa),''),
    NULLIF(TRIM(pago_matricula),''), NULLIF(TRIM(pago_mensual),'')
FROM _stg_establecimientos;
SQLIN
    else
        # 2023+: esquema completo con espe_*
        cat <<SQLIN
INSERT INTO dim_establecimiento_oficial
SELECT
    TRIM(agno)::SMALLINT, TRIM(rbd)::INTEGER,
    NULLIF(TRIM(dgv_rbd),'')::SMALLINT, NULLIF(TRIM(nom_rbd),''),
    NULLIF(TRIM(mrun),'')::BIGINT, NULLIF(TRIM(rut_sostenedor),'')::BIGINT,
    NULLIF(TRIM(p_juridica),'')::SMALLINT,
    NULLIF(TRIM(cod_reg_rbd),'')::SMALLINT, NULLIF(TRIM(nom_reg_rbd_a),''),
    NULLIF(TRIM(cod_pro_rbd),'')::SMALLINT, NULLIF(TRIM(cod_com_rbd),'')::INTEGER,
    NULLIF(TRIM(nom_com_rbd),''), NULLIF(TRIM(cod_deprov_rbd),'')::SMALLINT,
    NULLIF(TRIM(nom_deprov_rbd),''), NULLIF(TRIM(cod_depe),'')::SMALLINT,
    NULLIF(TRIM(cod_depe2),'')::SMALLINT, NULLIF(TRIM(rural_rbd),'')::SMALLINT,
    NULLIF(TRIM(latitud),'')::DOUBLE PRECISION, NULLIF(TRIM(longitud),'')::DOUBLE PRECISION,
    NULLIF(TRIM(convenio_pie),'')::SMALLINT, NULLIF(TRIM(pace),'')::SMALLINT,
    NULLIF(TRIM(ens_01),'')::INTEGER, NULLIF(TRIM(ens_02),'')::INTEGER,
    NULLIF(TRIM(ens_03),'')::INTEGER, NULLIF(TRIM(ens_04),'')::INTEGER,
    NULLIF(TRIM(ens_05),'')::INTEGER, NULLIF(TRIM(ens_06),'')::INTEGER,
    NULLIF(TRIM(ens_07),'')::INTEGER, NULLIF(TRIM(ens_08),'')::INTEGER,
    NULLIF(TRIM(ens_09),'')::INTEGER, NULLIF(TRIM(ens_10),'')::INTEGER,
    NULLIF(TRIM(ens_11),'')::INTEGER,
    NULLIF(TRIM(mat_total),'')::INTEGER,
    NULLIF(TRIM(matricula),'')::SMALLINT, NULLIF(TRIM(estado_estab),'')::SMALLINT,
    NULLIF(TRIM(ori_religiosa),'')::SMALLINT, NULLIF(TRIM(ori_otro_glosa),''),
    NULLIF(TRIM(pago_matricula),''), NULLIF(TRIM(pago_mensual),''),
    NULLIF(TRIM(espe_01),'')::INTEGER, NULLIF(TRIM(espe_02),'')::INTEGER,
    NULLIF(TRIM(espe_03),'')::INTEGER, NULLIF(TRIM(espe_04),'')::INTEGER,
    NULLIF(TRIM(espe_05),'')::INTEGER, NULLIF(TRIM(espe_06),'')::INTEGER,
    NULLIF(TRIM(espe_07),'')::INTEGER, NULLIF(TRIM(espe_08),'')::INTEGER,
    NULLIF(TRIM(espe_09),'')::INTEGER, NULLIF(TRIM(espe_10),'')::INTEGER,
    NULLIF(TRIM(espe_11),'')::INTEGER
FROM _stg_establecimientos;
SQLIN
    fi

    echo "\\echo 'Filas insertadas para año ${AGNO}:'"
    echo "SELECT COUNT(*) FROM dim_establecimiento_oficial WHERE agno = ${AGNO}::SMALLINT;"
    echo "DROP TABLE IF EXISTS _stg_establecimientos;"
}

# ---- 5. Procesar cada año ----
for EE_DIR in "${EE_DIRS[@]}"; do

    CSV_FILE=$(find "${EE_DIR}" -maxdepth 1 -name "*.csv" \
        ! -iname "Codigo*" ! -iname "Frecuencia*" | head -1)

    if [ -z "${CSV_FILE}" ]; then
        echo "  ⚠ No se encontró CSV en $(basename "${EE_DIR}"), saltando..."
        continue
    fi

    AGNO=$(basename "${EE_DIR}" | grep -oP '20\d{2}' | head -1)
    NCOLS=$(head -1 "${CSV_FILE}" | sed 's/\xef\xbb\xbf//' | tr ';' '\n' | wc -l)

    echo ""
    echo ">>> [2/3] Año ${AGNO}: $(basename "${CSV_FILE}") (${NCOLS} columnas)"

    # Preprocesar: quitar BOM y normalizar comas decimales (latitud col 18, longitud col 19)
    TMP_CSV="/tmp/establecimientos_${AGNO}.csv"

    python3 - "${CSV_FILE}" "${TMP_CSV}" <<'PYEOF'
import sys, csv, re, io
src, dst = sys.argv[1], sys.argv[2]
BOM = b'\xef\xbb\xbf'

# Leer el archivo binario y quitar BOM
raw = open(src, 'rb').read().replace(BOM, b'')
text = raw.decode('utf-8', errors='replace').replace('\r\n', '\n').replace('\r', '\n')

def clean_coord(val):
    """Extrae la coordenada decimal válida de un campo que puede tener texto/BOM previo."""
    val = val.strip()
    # Buscar el primer número con o sin signo negativo (acepta coma o punto decimal)
    match = re.search(r'-?[0-9]+[,\.][0-9]+', val)
    if match:
        return match.group(0).replace(',', '.')
    # Fallback: si es un entero puro
    match2 = re.search(r'-?[0-9]+', val)
    if match2:
        return match2.group(0)
    return ''

lines_out = []
reader = csv.reader(io.StringIO(text), delimiter=';')
for i, row in enumerate(reader):
    if i > 0 and len(row) > 18:
        row[17] = clean_coord(row[17])  # latitud
        row[18] = clean_coord(row[18])  # longitud
    lines_out.append(';'.join(row))

open(dst, 'w', encoding='utf-8', newline='\r\n').writelines(l + '\n' for l in lines_out)
PYEOF

    # Copiar al container
    docker cp "${TMP_CSV}" "${CONTAINER}:/tmp/establecimientos_${AGNO}.csv"
    rm -f "${TMP_CSV}"

    # Generar SQL y ejecutar directamente
    generate_sql "${AGNO}" "${NCOLS}" | \
        docker exec -i "${CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
            --set ON_ERROR_STOP=1

    echo "  ✅ Año ${AGNO} importado correctamente."
done

# ---- 6. Verificación final ----
echo ""
echo ">>> [3/3] Verificación final..."
docker exec -i "${CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
\echo ''
\echo '=== Resumen por año ==='
SELECT
    agno,
    COUNT(*) AS total_ee,
    COUNT(DISTINCT rut_sostenedor) AS sostenedores,
    SUM(mat_total) AS matricula_total,
    SUM(CASE WHEN estado_estab = 1 AND matricula = 1 THEN 1 ELSE 0 END) AS ee_activos
FROM dim_establecimiento_oficial
GROUP BY agno
ORDER BY agno;

\echo ''
\echo '=== Total general ==='
SELECT
    COUNT(*) AS total_filas,
    COUNT(DISTINCT agno) AS anios_cargados,
    COUNT(DISTINCT rbd) AS rbd_distintos,
    COUNT(DISTINCT rut_sostenedor) AS sostenedores_distintos
FROM dim_establecimiento_oficial;

\echo ''
\echo '✅ Importación de dim_establecimiento_oficial completada.'
SQL

echo ""
echo "=============================================="
echo " ✅ dim_establecimiento_oficial cargada exitosamente"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
