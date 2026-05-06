#!/usr/bin/env bash
# =============================================================
# import_documentos.sh
# Importa Documentos.txt a PostgreSQL
# Estrategia: sed elimina CRLF + COPY FORMAT text con delimiter ~
# El archivo tiene una columna índice inicial (_idx) que se omite
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../.env"

CONTAINER="pirgefse_db"
DB="${POSTGRES_DB}"
USER="${POSTGRES_USER}"
HOST_DATA_FILE="/home/andres/Documentos/PIRGEFSE/Plataforma/BBDD/Documentos.txt"

echo "=================================================="
echo " Importando Documentos.txt"
echo " Archivo: ${HOST_DATA_FILE}"
echo "=================================================="

# Crear tabla staging temporal UNLOGGED (más rápida, sin WAL)
echo "[1/4] Creando tabla staging..."
docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" <<'SQL'
DROP TABLE IF EXISTS staging_documentos;
CREATE UNLOGGED TABLE staging_documentos (
    _idx              TEXT,
    periodo           TEXT,
    sost_id           TEXT,
    rut_sost          TEXT,
    nombre_sost       TEXT,
    rbd               TEXT,
    nombre_rbd        TEXT,
    region_rbd        TEXT,
    dependencia_rbd   TEXT,
    subvencion_alias  TEXT,
    desc_libro        TEXT,
    tipo_docs_alias   TEXT,
    cuenta_alias      TEXT,
    desc_cuenta       TEXT,
    desc_cuenta_padre TEXT,
    cuenta_alias_padre TEXT,
    numero_documento  TEXT,
    nombre_documento  TEXT,
    detalle_documento TEXT,
    fecha_documento   TEXT,
    monto_total       TEXT,
    monto_declarado   TEXT,
    fecha_pago_documento TEXT,
    rut_documento     TEXT
);
SQL

# Dividir el archivo en chunks y procesarlos en paralelo (maximizando CPUs disponibles)
CORES=$(nproc)
echo "[2/4] Dividiendo archivo y cargando en paralelo con ${CORES} hilos (esto será mucho más rápido)..."

# Crear directorio temporal para los chunks en disco (no en RAM /tmp)
CHUNKS_DIR="${SCRIPT_DIR}/../tmp_chunks"
mkdir -p "${CHUNKS_DIR}"
rm -f "${CHUNKS_DIR}/doc_chunk_"*

# Extraer todo menos el header y dividir en pedazos de 100M líneas (o MB)
tail -n +2 "${HOST_DATA_FILE}" | split -C 100M -d - "${CHUNKS_DIR}/doc_chunk_"

# Procesar los chunks en paralelo usando xargs
export CONTAINER USER DB
find "${CHUNKS_DIR}" -name "doc_chunk_*" | xargs -n 1 -P "${CORES}" -I {} bash -c '
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
            if (count >= 24) {
                print line
                line = ""
                count = 0
            }
        }'\'' \
    | docker exec -i "$CONTAINER" psql -U "$USER" -d "$DB" \
        -c "\COPY staging_documentos FROM STDIN WITH (FORMAT text, DELIMITER '"'~'"', NULL '\'''\'')"
    echo "  -> Chunk $(basename "$CHUNK") procesado."
'

# Limpiar pedazos
rm -rf "${CHUNKS_DIR}"

echo "[3/4] Poblando dimensiones y tabla final..."
docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" <<'SQL'
-- dim_sostenedor
INSERT INTO dim_sostenedor(sost_id, rut_sost, nombre_sost)
SELECT DISTINCT
    CASE WHEN sost_id ~ '^-?[0-9]+$' THEN sost_id::BIGINT ELSE NULL END,
    rut_sost,
    nombre_sost
FROM staging_documentos
WHERE sost_id IS NOT NULL AND sost_id <> '' AND sost_id ~ '^-?[0-9]+$'
ON CONFLICT (sost_id) DO NOTHING;

-- dim_establecimiento
INSERT INTO dim_establecimiento(rbd, nombre_rbd, region_rbd, dependencia_rbd, sost_id)
SELECT DISTINCT
    CASE WHEN rbd ~ '^-?[0-9]+$' THEN rbd::INTEGER ELSE NULL END,
    nombre_rbd,
    CASE WHEN region_rbd ~ '^-?[0-9]+(\.[0-9]+)?$' THEN region_rbd::NUMERIC ELSE NULL END,
    dependencia_rbd,
    CASE WHEN sost_id ~ '^-?[0-9]+$' THEN sost_id::BIGINT ELSE NULL END
FROM staging_documentos
WHERE rbd IS NOT NULL AND rbd <> '' AND rbd ~ '^-?[0-9]+$'
ON CONFLICT (rbd) DO NOTHING;

-- dim_subvencion
INSERT INTO dim_subvencion(subvencion_alias)
SELECT DISTINCT subvencion_alias
FROM staging_documentos
WHERE subvencion_alias IS NOT NULL AND subvencion_alias <> ''
ON CONFLICT (subvencion_alias) DO NOTHING;

-- dim_cuenta
INSERT INTO dim_cuenta(cuenta_alias, desc_cuenta, cuenta_alias_padre, desc_cuenta_padre)
SELECT DISTINCT cuenta_alias, desc_cuenta, cuenta_alias_padre, desc_cuenta_padre
FROM staging_documentos
WHERE cuenta_alias IS NOT NULL AND cuenta_alias <> ''
ON CONFLICT (cuenta_alias) DO NOTHING;

-- dim_tipo_documento
INSERT INTO dim_tipo_documento(tipo_docs_alias, desc_libro)
SELECT DISTINCT tipo_docs_alias, desc_libro
FROM staging_documentos
WHERE tipo_docs_alias IS NOT NULL AND tipo_docs_alias <> ''
ON CONFLICT (tipo_docs_alias) DO NOTHING;

-- Insertar en tabla final
INSERT INTO documentos (
    periodo, sost_id, rut_sost, nombre_sost,
    rbd, nombre_rbd, region_rbd, dependencia_rbd,
    subvencion_alias, desc_libro, tipo_docs_alias,
    cuenta_alias, desc_cuenta, desc_cuenta_padre, cuenta_alias_padre,
    numero_documento, nombre_documento, detalle_documento,
    fecha_documento, monto_total, monto_declarado,
    fecha_pago_documento, rut_documento
)
SELECT
    CASE WHEN periodo ~ '^-?[0-9]+$' THEN periodo::INTEGER ELSE NULL END,
    CASE WHEN sost_id ~ '^-?[0-9]+$' THEN sost_id::BIGINT ELSE NULL END,
    rut_sost,
    nombre_sost,
    CASE WHEN rbd ~ '^-?[0-9]+$' THEN rbd::INTEGER ELSE NULL END,
    nombre_rbd,
    CASE WHEN region_rbd ~ '^-?[0-9]+(\.[0-9]+)?$' THEN region_rbd::NUMERIC ELSE NULL END,
    dependencia_rbd,
    subvencion_alias,
    desc_libro,
    tipo_docs_alias,
    cuenta_alias,
    desc_cuenta,
    desc_cuenta_padre,
    cuenta_alias_padre,
    CASE WHEN numero_documento ~ '^-?[0-9]+$' THEN numero_documento::NUMERIC ELSE NULL END,
    nombre_documento,
    detalle_documento,
    CASE WHEN NULLIF(fecha_documento,'') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN fecha_documento::DATE ELSE NULL END,
    CASE WHEN monto_total ~ '^-?[0-9]+(\.[0-9]+)?$' THEN monto_total::NUMERIC ELSE NULL END,
    CASE WHEN monto_declarado ~ '^-?[0-9]+(\.[0-9]+)?$' THEN monto_declarado::NUMERIC ELSE NULL END,
    CASE WHEN NULLIF(fecha_pago_documento,'') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN fecha_pago_documento::DATE ELSE NULL END,
    rut_documento
FROM staging_documentos;
SQL

echo "[4/4] Limpiando staging y analizando..."
docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" \
    -c "DROP TABLE IF EXISTS staging_documentos; ANALYZE documentos;"

echo ""
echo "✅  Documentos.txt importado correctamente."
docker exec -i "${CONTAINER}" psql -U "${USER}" -d "${DB}" \
    -c "SELECT COUNT(*) AS total_filas FROM documentos;"
