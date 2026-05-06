#!/usr/bin/env bash
# =============================================================
# import_remuneraciones.sh
# Importa archivos Remuneraciones_YYYY.txt (5 archivos, ~7GB c/u)
# Estrategia: sed elimina CRLF + COPY FORMAT text con delimiter ~
# Uso: bash import_remuneraciones.sh [anio]
#   Sin argumento: importa todos los años (2020-2024)
#   Con argumento: importa solo ese año (ej: bash import_remuneraciones.sh 2022)
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../.env"

CONTAINER="pirgefse_db"
DB="${POSTGRES_DB}"
USER="${POSTGRES_USER}"
BBDD_DIR="/home/andres/Documentos/PIRGEFSE/Plataforma/BBDD"

# Si se pasa un año como argumento, solo se importa ese
if [ $# -ge 1 ]; then
    YEARS=("$1")
else
    YEARS=(2020 2021 2022 2023 2024)
fi

import_year() {
    local ANIO="$1"
    local HOST_DATA_FILE="${BBDD_DIR}/Remuneraciones_${ANIO}.txt"

    echo ""
    echo "=================================================="
    echo " Importando Remuneraciones_${ANIO}.txt"
    echo " Archivo: ${HOST_DATA_FILE}"
    echo "=================================================="

    if [ ! -f "${HOST_DATA_FILE}" ]; then
        echo "⚠️  Archivo no encontrado: ${HOST_DATA_FILE}. Saltando."
        return
    fi

    echo "[1/5] Creando tabla staging_remuneraciones_${ANIO}..."
    docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" <<SQL
DROP TABLE IF EXISTS staging_remuneraciones_${ANIO};
CREATE UNLOGGED TABLE staging_remuneraciones_${ANIO} (
    rut             TEXT,
    periodo         TEXT,
    sostenedor      TEXT,
    rbd             TEXT,
    dgv             TEXT,
    tip             TEXT,
    hc              TEXT,
    fei             TEXT,
    fun             TEXT,
    mes             TEXT,
    anio            TEXT,
    habernorend     TEXT,
    totalhaber      TEXT,
    pre             TEXT,
    aaf             TEXT,
    sal             TEXT,
    asa             TEXT,
    imp             TEXT,
    cca             TEXT,
    dif             TEXT,
    dis             TEXT,
    rej             TEXT,
    sce             TEXT,
    ant             TEXT,
    odv             TEXT,
    totaldescuento  TEXT,
    liquido         TEXT,
    subvencion_alias TEXT,
    cuenta_alias    TEXT,
    monto           TEXT
);
SQL

    CORES=$(nproc)
    echo "[2/5] Dividiendo archivo y cargando en paralelo con ${CORES} hilos (esto será mucho más rápido)..."
    
    CHUNKS_DIR="${SCRIPT_DIR}/../tmp_chunks"
    mkdir -p "${CHUNKS_DIR}"
    rm -f "${CHUNKS_DIR}/rem_chunk_${ANIO}_"*

    tail -n +2 "${HOST_DATA_FILE}" | split -C 100M -d - "${CHUNKS_DIR}/rem_chunk_${ANIO}_"

    export CONTAINER USER DB ANIO
    find "${CHUNKS_DIR}" -name "rem_chunk_${ANIO}_*" | xargs -n 1 -P "${CORES}" -I {} bash -c '
        CHUNK="{}"
        sed "s/\r//" "$CHUNK" \
        | tr -d \\134 \
        | awk -F"~" '\''
            {
                if (line == "") {
                    line = $0
                    count = NF
                } else {
                    line = line " " $0
                    count += NF - 1
                }
                if (count >= 30) {
                    # Normalizar: Si el archivo tiene 31 columnas (2022-2024), quitamos la primera (vacía)
                    if (count == 31) {
                        sub(/^[^~]*~/, "", line)
                    }
                    print line
                    line = ""
                    count = 0
                }
            }'\'' \
        | docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" \
            -c "\COPY staging_remuneraciones_${ANIO} FROM STDIN WITH (FORMAT text, DELIMITER '"'~'"', NULL '\'''\'')"
        echo "  -> Chunk $(basename "$CHUNK") procesado."
    '

    rm -rf "${CHUNKS_DIR}"

    echo "[3/5] Poblando dimensiones..."
    docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" <<SQL
INSERT INTO dim_subvencion(subvencion_alias)
SELECT DISTINCT subvencion_alias
FROM staging_remuneraciones_${ANIO}
WHERE subvencion_alias IS NOT NULL AND subvencion_alias <> ''
ON CONFLICT (subvencion_alias) DO NOTHING;

INSERT INTO dim_cuenta(cuenta_alias, desc_cuenta, cuenta_alias_padre, desc_cuenta_padre)
SELECT DISTINCT cuenta_alias, NULL, NULL, NULL
FROM staging_remuneraciones_${ANIO}
WHERE cuenta_alias IS NOT NULL AND cuenta_alias <> ''
ON CONFLICT (cuenta_alias) DO NOTHING;

INSERT INTO dim_sostenedor(sost_id, rut_sost, nombre_sost)
SELECT DISTINCT CASE WHEN sostenedor ~ '^-?[0-9]+$' THEN sostenedor::BIGINT ELSE NULL END, NULL, NULL
FROM staging_remuneraciones_${ANIO}
WHERE sostenedor IS NOT NULL AND sostenedor <> '' AND sostenedor ~ '^-?[0-9]+$'
ON CONFLICT (sost_id) DO NOTHING;

INSERT INTO dim_establecimiento(rbd, nombre_rbd, region_rbd, dependencia_rbd, sost_id)
SELECT DISTINCT
    CASE WHEN rbd ~ '^-?[0-9]+$' THEN rbd::INTEGER ELSE NULL END,
    NULL::TEXT,
    NULL::NUMERIC,
    NULL::TEXT,
    CASE WHEN sostenedor ~ '^-?[0-9]+$' THEN sostenedor::BIGINT ELSE NULL END
FROM staging_remuneraciones_${ANIO}
WHERE rbd IS NOT NULL AND rbd <> '' AND rbd ~ '^-?[0-9]+$'
ON CONFLICT (rbd) DO NOTHING;
SQL

    echo "[4/5] Insertando en partición remuneraciones_${ANIO}..."
    docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" <<SQL
ALTER TABLE remuneraciones_${ANIO} SET (autovacuum_enabled = false);

INSERT INTO remuneraciones (
    rut, periodo, sostenedor, rbd, dgv, tip, hc, fei, fun,
    mes, anio, habernorend, totalhaber, pre, aaf, sal, asa,
    imp, cca, dif, dis, rej, sce, ant, odv,
    totaldescuento, liquido, subvencion_alias, cuenta_alias, monto
)
SELECT
    rut,
    CASE WHEN periodo ~ '^-?[0-9]+$' THEN periodo::INTEGER ELSE NULL END,
    CASE WHEN sostenedor ~ '^-?[0-9]+$' THEN sostenedor::BIGINT ELSE NULL END,
    CASE WHEN rbd ~ '^-?[0-9]+$' THEN rbd::INTEGER ELSE NULL END,
    dgv, tip,
    CASE WHEN hc ~ '^-?[0-9]+(\.[0-9]+)?$' THEN hc::NUMERIC ELSE NULL END,
    CASE WHEN NULLIF(fei,'') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN fei::DATE ELSE NULL END,
    fun,
    CASE WHEN mes ~ '^-?[0-9]+$' THEN mes::INTEGER ELSE NULL END,
    CASE WHEN anio ~ '^-?[0-9]+$' THEN anio::INTEGER ELSE NULL END,
    CASE WHEN habernorend ~ '^-?[0-9]+(\.[0-9]+)?$' THEN habernorend::NUMERIC ELSE NULL END,
    CASE WHEN totalhaber ~ '^-?[0-9]+(\.[0-9]+)?$' THEN totalhaber::NUMERIC ELSE NULL END,
    CASE WHEN pre ~ '^-?[0-9]+(\.[0-9]+)?$' THEN pre::NUMERIC ELSE NULL END,
    CASE WHEN aaf ~ '^-?[0-9]+(\.[0-9]+)?$' THEN aaf::NUMERIC ELSE NULL END,
    CASE WHEN sal ~ '^-?[0-9]+(\.[0-9]+)?$' THEN sal::NUMERIC ELSE NULL END,
    CASE WHEN asa ~ '^-?[0-9]+(\.[0-9]+)?$' THEN asa::NUMERIC ELSE NULL END,
    CASE WHEN imp ~ '^-?[0-9]+(\.[0-9]+)?$' THEN imp::NUMERIC ELSE NULL END,
    CASE WHEN cca ~ '^-?[0-9]+(\.[0-9]+)?$' THEN cca::NUMERIC ELSE NULL END,
    CASE WHEN dif ~ '^-?[0-9]+(\.[0-9]+)?$' THEN dif::NUMERIC ELSE NULL END,
    CASE WHEN dis ~ '^-?[0-9]+(\.[0-9]+)?$' THEN dis::NUMERIC ELSE NULL END,
    CASE WHEN rej ~ '^-?[0-9]+(\.[0-9]+)?$' THEN rej::NUMERIC ELSE NULL END,
    CASE WHEN sce ~ '^-?[0-9]+(\.[0-9]+)?$' THEN sce::NUMERIC ELSE NULL END,
    CASE WHEN ant ~ '^-?[0-9]+(\.[0-9]+)?$' THEN ant::NUMERIC ELSE NULL END,
    CASE WHEN odv ~ '^-?[0-9]+(\.[0-9]+)?$' THEN odv::NUMERIC ELSE NULL END,
    CASE WHEN totaldescuento ~ '^-?[0-9]+(\.[0-9]+)?$' THEN totaldescuento::NUMERIC ELSE NULL END,
    CASE WHEN liquido ~ '^-?[0-9]+(\.[0-9]+)?$' THEN liquido::NUMERIC ELSE NULL END,
    subvencion_alias,
    cuenta_alias,
    CASE WHEN monto ~ '^-?[0-9]+(\.[0-9]+)?$' THEN monto::NUMERIC ELSE NULL END
FROM staging_remuneraciones_${ANIO};

ALTER TABLE remuneraciones_${ANIO} SET (autovacuum_enabled = true);
DROP TABLE IF EXISTS staging_remuneraciones_${ANIO};
VACUUM ANALYZE remuneraciones_${ANIO};
SQL

    echo "[5/5] Verificando..."
    docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" \
        -c "SELECT anio, COUNT(*) AS total_filas FROM remuneraciones WHERE anio = ${ANIO} GROUP BY anio;"

    echo "✅  Remuneraciones_${ANIO}.txt importado correctamente."
}

for YEAR in "${YEARS[@]}"; do
    import_year "${YEAR}"
done

echo ""
echo "🎉  Importación de remuneraciones completada."
docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" \
    -c "SELECT anio, COUNT(*) AS total_filas FROM remuneraciones GROUP BY anio ORDER BY anio;"
