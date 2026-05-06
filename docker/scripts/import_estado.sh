#!/usr/bin/env bash
# =============================================================
# import_estado.sh
# Importa Estado_resultado.txt a PostgreSQL
# Estrategia: sed elimina CRLF + COPY FORMAT text con delimiter ~
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../.env"

CONTAINER="pirgefse_db"
DB="${POSTGRES_DB}"
USER="${POSTGRES_USER}"
HOST_DATA_FILE="/home/andres/Documentos/PIRGEFSE/Plataforma/BBDD/Estado_resultado.txt"

echo "=================================================="
echo " Importando Estado_resultado.txt"
echo " Archivo: ${HOST_DATA_FILE}"
echo "=================================================="

echo "[1/3] Creando tabla staging..."
docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" <<'SQL'
DROP TABLE IF EXISTS staging_estado;
CREATE UNLOGGED TABLE staging_estado (
    desc_tipo_cuenta    TEXT,
    cuenta_alias        TEXT,
    desc_cuenta         TEXT,
    cuenta_alias_padre  TEXT,
    desc_cuenta_padre   TEXT,
    monto_declarado     TEXT,
    periodo             TEXT,
    subvencion_alias    TEXT,
    sost_id             TEXT,
    rbd                 TEXT,
    region_rbd          TEXT,
    dependencia_rbd     TEXT,
    desc_estado         TEXT
);
SQL

# Dividir el archivo en chunks y procesarlos en paralelo
CORES=$(nproc)
echo "[2/3] Dividiendo archivo y cargando en paralelo con ${CORES} hilos..."

CHUNKS_DIR="${SCRIPT_DIR}/../tmp_chunks"
mkdir -p "${CHUNKS_DIR}"
rm -f "${CHUNKS_DIR}/est_chunk_"*

tail -n +2 "${HOST_DATA_FILE}" | split -C 100M -d - "${CHUNKS_DIR}/est_chunk_"

export CONTAINER USER DB
find "${CHUNKS_DIR}" -name "est_chunk_*" | xargs -n 1 -P "${CORES}" -I {} bash -c '
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
            if (count >= 13) {
                print line
                line = ""
                count = 0
            }
        }'\'' \
    | docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" \
        -c "\COPY staging_estado FROM STDIN WITH (FORMAT text, DELIMITER '"'~'"', NULL '\'''\'')"
    echo "  -> Chunk $(basename "$CHUNK") procesado."
'

rm -rf "${CHUNKS_DIR}"

echo "[3/3] Poblando dimensiones y tabla final..."
docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" -c "
-- dim_subvencion
INSERT INTO dim_subvencion(subvencion_alias)
SELECT DISTINCT subvencion_alias
FROM staging_estado
WHERE subvencion_alias IS NOT NULL AND subvencion_alias <> ''
ON CONFLICT (subvencion_alias) DO NOTHING;

-- dim_cuenta
INSERT INTO dim_cuenta(cuenta_alias, desc_cuenta, cuenta_alias_padre, desc_cuenta_padre)
SELECT DISTINCT cuenta_alias, desc_cuenta, cuenta_alias_padre, desc_cuenta_padre
FROM staging_estado
WHERE cuenta_alias IS NOT NULL AND cuenta_alias <> ''
ON CONFLICT (cuenta_alias) DO NOTHING;

-- dim_sostenedor
INSERT INTO dim_sostenedor(sost_id, rut_sost, nombre_sost)
SELECT DISTINCT CASE WHEN sost_id ~ '^-?[0-9]+$' THEN sost_id::BIGINT ELSE NULL END, NULL, NULL
FROM staging_estado
WHERE sost_id IS NOT NULL AND sost_id <> '' AND sost_id ~ '^-?[0-9]+$'
ON CONFLICT (sost_id) DO NOTHING;

-- dim_establecimiento
INSERT INTO dim_establecimiento(rbd, nombre_rbd, region_rbd, dependencia_rbd, sost_id)
SELECT DISTINCT
    CASE WHEN rbd ~ '^-?[0-9]+$' THEN rbd::INTEGER ELSE NULL END,
    NULL,
    CASE WHEN region_rbd ~ '^-?[0-9]+(\.[0-9]+)?$' THEN region_rbd::NUMERIC ELSE NULL END,
    dependencia_rbd,
    CASE WHEN sost_id ~ '^-?[0-9]+$' THEN sost_id::BIGINT ELSE NULL END
FROM staging_estado
WHERE rbd IS NOT NULL AND rbd <> '' AND rbd ~ '^-?[0-9]+$'
ON CONFLICT (rbd) DO NOTHING;

-- Tabla final
INSERT INTO estado_resultado (
    desc_tipo_cuenta, cuenta_alias, desc_cuenta,
    cuenta_alias_padre, desc_cuenta_padre,
    monto_declarado, periodo, subvencion_alias,
    sost_id, rbd, region_rbd, dependencia_rbd, desc_estado
)
SELECT
    desc_tipo_cuenta,
    cuenta_alias,
    desc_cuenta,
    cuenta_alias_padre,
    desc_cuenta_padre,
    CASE WHEN monto_declarado ~ '^-?[0-9]+(\.[0-9]+)?$' THEN monto_declarado::NUMERIC ELSE NULL END,
    CASE WHEN periodo ~ '^-?[0-9]+$' THEN periodo::INTEGER ELSE NULL END,
    subvencion_alias,
    CASE WHEN sost_id ~ '^-?[0-9]+$' THEN sost_id::BIGINT ELSE NULL END,
    CASE WHEN rbd ~ '^-?[0-9]+$' THEN rbd::INTEGER ELSE NULL END,
    CASE WHEN region_rbd ~ '^-?[0-9]+(\.[0-9]+)?$' THEN region_rbd::NUMERIC ELSE NULL END,
    dependencia_rbd,
    desc_estado
FROM staging_estado;

DROP TABLE IF EXISTS staging_estado;
ANALYZE estado_resultado;
"
echo "✅  Estado_resultado.txt importado correctamente."
docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" \
    -c "SELECT COUNT(*) AS total_filas FROM estado_resultado;"
