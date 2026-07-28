#!/usr/bin/env bash
# =============================================================
# import_asistencia_anual.sh
# Crea la tabla dim_asistencia_anual en PostgreSQL y carga los
# datos de los archivos CSV (2022, 2023, 2024).
#
# Estrategia:
#   1. Preprocesa el CSV (latin-1 → UTF-8, " " o "NA" → vacío)
#   2. Copia el CSV procesado al contenedor Docker
#   3. Crea tabla staging (todo TEXT) y hace COPY
#   4. INSERT final con casteo de tipos a dim_asistencia_anual
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../.env"

BBDD_DIR="${SCRIPT_DIR}/../../BBDD"
CONTAINER="pirgefse_db"
DROP_TABLE=false

for arg in "$@"; do
    case $arg in
        --drop) DROP_TABLE=true ;;
        *) echo "Argumento desconocido: $arg"; exit 1 ;;
    esac
done

# Archivos CSV a procesar
CSV_FILES=(
    "${BBDD_DIR}/Asistencia-anual-2024/ASISTENCIA_ANUAL_PUBL_2024.csv"
)

TMP_CSV="/tmp/asistencia_tmp.csv"
CONTAINER_CSV="/tmp/asistencia_tmp.csv"

echo "============================================================"
echo "  PIRGEFSE — Importando dim_asistencia_anual"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# ---- 1. Verificar container ----
echo ""
echo ">>> [1/4] Verificando contenedor Docker..."
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "  ERROR: El contenedor '${CONTAINER}' no está corriendo."
    exit 1
fi
echo "  ✅ Contenedor '${CONTAINER}' activo."

# ---- 2. Crear tabla principal ----
echo ""
echo ">>> [2/4] Creando tabla dim_asistencia_anual..."
docker exec -i "${CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --set ON_ERROR_STOP=1 <<SQL

$(if [ "${DROP_TABLE}" = true ]; then
    echo "\\echo '>>> Eliminando dim_asistencia_anual (--drop)...'"
    echo "DROP TABLE IF EXISTS dim_asistencia_anual CASCADE;"
fi)

CREATE TABLE IF NOT EXISTS dim_asistencia_anual (
    id SERIAL PRIMARY KEY,
    agno SMALLINT NOT NULL,
    mrun BIGINT NOT NULL,
    rbd INTEGER NOT NULL,
    nom_rbd VARCHAR(200),
    cod_reg_rbd SMALLINT,
    nom_reg_rbd_a VARCHAR(100),
    cod_pro_rbd SMALLINT,
    cod_com_rbd INTEGER,
    nom_com_rbd VARCHAR(100),
    cod_deprov_rbd SMALLINT,
    nom_deprov_rbd VARCHAR(100),
    rural_rbd SMALLINT,
    cod_depe2 SMALLINT,
    cod_ense SMALLINT,
    cod_ense2 SMALLINT,
    cod_grado SMALLINT,
    let_cur VARCHAR(10),
    fec_nac_alu VARCHAR(20),
    gen_alu SMALLINT,
    
    dias_asistidos_3 SMALLINT, dias_trabajados_3 SMALLINT, tasa_asistencia_3 NUMERIC(5,2), categoria_asis_3 SMALLINT,
    dias_asistidos_4 SMALLINT, dias_trabajados_4 SMALLINT, tasa_asistencia_4 NUMERIC(5,2), categoria_asis_4 SMALLINT,
    dias_asistidos_5 SMALLINT, dias_trabajados_5 SMALLINT, tasa_asistencia_5 NUMERIC(5,2), categoria_asis_5 SMALLINT,
    dias_asistidos_6 SMALLINT, dias_trabajados_6 SMALLINT, tasa_asistencia_6 NUMERIC(5,2), categoria_asis_6 SMALLINT,
    dias_asistidos_7 SMALLINT, dias_trabajados_7 SMALLINT, tasa_asistencia_7 NUMERIC(5,2), categoria_asis_7 SMALLINT,
    dias_asistidos_8 SMALLINT, dias_trabajados_8 SMALLINT, tasa_asistencia_8 NUMERIC(5,2), categoria_asis_8 SMALLINT,
    dias_asistidos_9 SMALLINT, dias_trabajados_9 SMALLINT, tasa_asistencia_9 NUMERIC(5,2), categoria_asis_9 SMALLINT,
    dias_asistidos_10 SMALLINT, dias_trabajados_10 SMALLINT, tasa_asistencia_10 NUMERIC(5,2), categoria_asis_10 SMALLINT,
    dias_asistidos_11 SMALLINT, dias_trabajados_11 SMALLINT, tasa_asistencia_11 NUMERIC(5,2), categoria_asis_11 SMALLINT,
    dias_asistidos_12 SMALLINT, dias_trabajados_12 SMALLINT, tasa_asistencia_12 NUMERIC(5,2), categoria_asis_12 SMALLINT,
    
    dias_asistidos_anual SMALLINT,
    dias_trabajados_anual SMALLINT,
    tasa_asistencia_anual NUMERIC(5,2),
    categoria_asis_anual SMALLINT,
    
    slep TEXT,
    nombre_slep TEXT,
    generacion_slep TEXT,

    UNIQUE (agno, rbd, mrun)
);

CREATE INDEX IF NOT EXISTS idx_dim_asis_rbd ON dim_asistencia_anual (rbd);
CREATE INDEX IF NOT EXISTS idx_dim_asis_agno ON dim_asistencia_anual (agno);
CREATE INDEX IF NOT EXISTS idx_dim_asis_mrun ON dim_asistencia_anual (mrun);
CREATE INDEX IF NOT EXISTS idx_dim_asis_com ON dim_asistencia_anual (cod_com_rbd);
SQL
echo "  ✅ Tabla creada."

# Iterar sobre cada CSV
for CSV_FILE in "${CSV_FILES[@]}"; do
    echo ""
    echo ">>> [3/4] Procesando archivo: $(basename "${CSV_FILE}")"
    
    if [ ! -f "${CSV_FILE}" ]; then
        echo "  ⚠️ Archivo no encontrado. Saltando."
        continue
    fi

    # Preprocesar CSV (latin-1 a utf-8, limpieza de 'NA'/' ' a vacío, normalizar saltos)
    echo "    - Preprocesando CSV con Python..."
    python3 - "${CSV_FILE}" "${TMP_CSV}" <<'PYEOF'
import sys
import csv

src, dst = sys.argv[1], sys.argv[2]
try:
    with open(src, 'r', encoding='utf-8') as f:
        f.read(1024)
    enc = 'utf-8'
except UnicodeDecodeError:
    enc = 'latin-1'

def sanitize_field(cell):
    c = cell.strip()
    return '' if c.upper() in ['NA', 'N/A', ''] else c

with open(src, 'r', encoding=enc) as f_in, open(dst, 'w', encoding='utf-8', newline='') as f_out:
    reader = csv.reader(f_in, delimiter=';')
    writer = csv.writer(f_out, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    for row in reader:
        writer.writerow([sanitize_field(cell) for cell in row])
PYEOF
    echo "    ✅ Preprocesamiento completo."

    # Copiar al contenedor
    echo "    - Copiando al contenedor Docker..."
    docker cp "${TMP_CSV}" "${CONTAINER}:${CONTAINER_CSV}"
    rm -f "${TMP_CSV}"

    # Staging y Carga
    echo "    - Cargando a base de datos PostgreSQL..."
    docker exec -i "${CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --set ON_ERROR_STOP=1 <<SQL

DROP TABLE IF EXISTS _stg_asistencia_anual;
CREATE TEMP TABLE _stg_asistencia_anual (
    agno TEXT, mrun TEXT, rbd TEXT, nom_rbd TEXT, cod_reg_rbd TEXT, nom_reg_rbd_a TEXT,
    cod_pro_rbd TEXT, cod_com_rbd TEXT, nom_com_rbd TEXT, cod_deprov_rbd TEXT, nom_deprov_rbd TEXT,
    rural_rbd TEXT, cod_depe2 TEXT, cod_ense TEXT, cod_ense2 TEXT, cod_grado TEXT, let_cur TEXT,
    fec_nac_alu TEXT, gen_alu TEXT,
    
    dias_asistidos_3 TEXT, dias_trabajados_3 TEXT,
    dias_asistidos_4 TEXT, dias_trabajados_4 TEXT,
    dias_asistidos_5 TEXT, dias_trabajados_5 TEXT,
    dias_asistidos_6 TEXT, dias_trabajados_6 TEXT,
    dias_asistidos_7 TEXT, dias_trabajados_7 TEXT,
    dias_asistidos_8 TEXT, dias_trabajados_8 TEXT,
    dias_asistidos_9 TEXT, dias_trabajados_9 TEXT,
    dias_asistidos_10 TEXT, dias_trabajados_10 TEXT,
    dias_asistidos_11 TEXT, dias_trabajados_11 TEXT,
    dias_asistidos_12 TEXT, dias_trabajados_12 TEXT,
    
    tasa_asistencia_3 TEXT, tasa_asistencia_4 TEXT, tasa_asistencia_5 TEXT, tasa_asistencia_6 TEXT,
    tasa_asistencia_7 TEXT, tasa_asistencia_8 TEXT, tasa_asistencia_9 TEXT, tasa_asistencia_10 TEXT,
    tasa_asistencia_11 TEXT, tasa_asistencia_12 TEXT,
    
    categoria_asis_3 TEXT, categoria_asis_4 TEXT, categoria_asis_5 TEXT, categoria_asis_6 TEXT,
    categoria_asis_7 TEXT, categoria_asis_8 TEXT, categoria_asis_9 TEXT, categoria_asis_10 TEXT,
    categoria_asis_11 TEXT, categoria_asis_12 TEXT,
    
    dias_asistidos_anual TEXT, dias_trabajados_anual TEXT, tasa_asistencia_anual TEXT, categoria_asis_anual TEXT,
    slep TEXT, nombre_slep TEXT, generacion_slep TEXT
);

COPY _stg_asistencia_anual
FROM '${CONTAINER_CSV}'
WITH (FORMAT CSV, HEADER TRUE, DELIMITER ';', NULL '', ENCODING 'UTF8');

INSERT INTO dim_asistencia_anual (
    agno, mrun, rbd, nom_rbd, cod_reg_rbd, nom_reg_rbd_a, cod_pro_rbd, cod_com_rbd, nom_com_rbd,
    cod_deprov_rbd, nom_deprov_rbd, rural_rbd, cod_depe2, cod_ense, cod_ense2, cod_grado, let_cur,
    fec_nac_alu, gen_alu,
    dias_asistidos_3, dias_trabajados_3, tasa_asistencia_3, categoria_asis_3,
    dias_asistidos_4, dias_trabajados_4, tasa_asistencia_4, categoria_asis_4,
    dias_asistidos_5, dias_trabajados_5, tasa_asistencia_5, categoria_asis_5,
    dias_asistidos_6, dias_trabajados_6, tasa_asistencia_6, categoria_asis_6,
    dias_asistidos_7, dias_trabajados_7, tasa_asistencia_7, categoria_asis_7,
    dias_asistidos_8, dias_trabajados_8, tasa_asistencia_8, categoria_asis_8,
    dias_asistidos_9, dias_trabajados_9, tasa_asistencia_9, categoria_asis_9,
    dias_asistidos_10, dias_trabajados_10, tasa_asistencia_10, categoria_asis_10,
    dias_asistidos_11, dias_trabajados_11, tasa_asistencia_11, categoria_asis_11,
    dias_asistidos_12, dias_trabajados_12, tasa_asistencia_12, categoria_asis_12,
    dias_asistidos_anual, dias_trabajados_anual, tasa_asistencia_anual, categoria_asis_anual,
    slep, nombre_slep, generacion_slep
)
SELECT 
    NULLIF(agno, '')::SMALLINT,
    NULLIF(mrun, '')::BIGINT,
    NULLIF(rbd, '')::INTEGER,
    NULLIF(nom_rbd, ''),
    NULLIF(cod_reg_rbd, '')::SMALLINT,
    NULLIF(nom_reg_rbd_a, ''),
    NULLIF(cod_pro_rbd, '')::SMALLINT,
    NULLIF(cod_com_rbd, '')::INTEGER,
    NULLIF(nom_com_rbd, ''),
    NULLIF(cod_deprov_rbd, '')::SMALLINT,
    NULLIF(nom_deprov_rbd, ''),
    NULLIF(rural_rbd, '')::SMALLINT,
    NULLIF(cod_depe2, '')::SMALLINT,
    NULLIF(cod_ense, '')::SMALLINT,
    NULLIF(cod_ense2, '')::SMALLINT,
    NULLIF(cod_grado, '')::SMALLINT,
    NULLIF(let_cur, ''),
    NULLIF(fec_nac_alu, ''),
    NULLIF(gen_alu, '')::SMALLINT,
    
    NULLIF(dias_asistidos_3, '')::SMALLINT, NULLIF(dias_trabajados_3, '')::SMALLINT, NULLIF(REPLACE(tasa_asistencia_3, ',', '.'), '')::NUMERIC, NULLIF(categoria_asis_3, '')::SMALLINT,
    NULLIF(dias_asistidos_4, '')::SMALLINT, NULLIF(dias_trabajados_4, '')::SMALLINT, NULLIF(REPLACE(tasa_asistencia_4, ',', '.'), '')::NUMERIC, NULLIF(categoria_asis_4, '')::SMALLINT,
    NULLIF(dias_asistidos_5, '')::SMALLINT, NULLIF(dias_trabajados_5, '')::SMALLINT, NULLIF(REPLACE(tasa_asistencia_5, ',', '.'), '')::NUMERIC, NULLIF(categoria_asis_5, '')::SMALLINT,
    NULLIF(dias_asistidos_6, '')::SMALLINT, NULLIF(dias_trabajados_6, '')::SMALLINT, NULLIF(REPLACE(tasa_asistencia_6, ',', '.'), '')::NUMERIC, NULLIF(categoria_asis_6, '')::SMALLINT,
    NULLIF(dias_asistidos_7, '')::SMALLINT, NULLIF(dias_trabajados_7, '')::SMALLINT, NULLIF(REPLACE(tasa_asistencia_7, ',', '.'), '')::NUMERIC, NULLIF(categoria_asis_7, '')::SMALLINT,
    NULLIF(dias_asistidos_8, '')::SMALLINT, NULLIF(dias_trabajados_8, '')::SMALLINT, NULLIF(REPLACE(tasa_asistencia_8, ',', '.'), '')::NUMERIC, NULLIF(categoria_asis_8, '')::SMALLINT,
    NULLIF(dias_asistidos_9, '')::SMALLINT, NULLIF(dias_trabajados_9, '')::SMALLINT, NULLIF(REPLACE(tasa_asistencia_9, ',', '.'), '')::NUMERIC, NULLIF(categoria_asis_9, '')::SMALLINT,
    NULLIF(dias_asistidos_10, '')::SMALLINT, NULLIF(dias_trabajados_10, '')::SMALLINT, NULLIF(REPLACE(tasa_asistencia_10, ',', '.'), '')::NUMERIC, NULLIF(categoria_asis_10, '')::SMALLINT,
    NULLIF(dias_asistidos_11, '')::SMALLINT, NULLIF(dias_trabajados_11, '')::SMALLINT, NULLIF(REPLACE(tasa_asistencia_11, ',', '.'), '')::NUMERIC, NULLIF(categoria_asis_11, '')::SMALLINT,
    NULLIF(dias_asistidos_12, '')::SMALLINT, NULLIF(dias_trabajados_12, '')::SMALLINT, NULLIF(REPLACE(tasa_asistencia_12, ',', '.'), '')::NUMERIC, NULLIF(categoria_asis_12, '')::SMALLINT,
    
    NULLIF(dias_asistidos_anual, '')::SMALLINT, NULLIF(dias_trabajados_anual, '')::SMALLINT, NULLIF(REPLACE(tasa_asistencia_anual, ',', '.'), '')::NUMERIC, NULLIF(categoria_asis_anual, '')::SMALLINT,
    
    NULLIF(slep, ''), NULLIF(nombre_slep, ''), NULLIF(generacion_slep, '')
FROM _stg_asistencia_anual
WHERE TRIM(agno) ~ '^\\d+$' AND TRIM(mrun) ~ '^\\d+$' AND TRIM(rbd) ~ '^\\d+$'
ON CONFLICT (agno, rbd, mrun) DO NOTHING;

SQL
    
    echo "    ✅ Archivo cargado en BD."
    docker exec "${CONTAINER}" rm -f "${CONTAINER_CSV}"
done

echo ""
echo ">>> [4/4] Verificación de la carga..."
docker exec -i "${CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "SELECT agno, COUNT(*) AS registros FROM dim_asistencia_anual GROUP BY agno ORDER BY agno;"

echo "============================================================"
echo "  ✅ Importación de Asistencia Anual finalizada con éxito."
echo "============================================================"
