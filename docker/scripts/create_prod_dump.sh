#!/usr/bin/env bash
# =============================================================
# create_prod_dump.sh
# Genera el dump de producción de la base de datos PIRGEFSE
# Formato: custom (-Fc) — permite restauración paralela con pg_restore
#
# Uso: bash scripts/create_prod_dump.sh
# Prerequisito: docker compose up -d (contenedor DB corriendo)
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../.env"

CONTAINER="pirgefse_db"
DB="${POSTGRES_DB}"
USER="${POSTGRES_USER}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${SCRIPT_DIR}/../pirgefse_prod_${TIMESTAMP}.dump"

echo "=============================================="
echo " PIRGEFSE — Generando dump de producción"
echo " Fecha: $(date)"
echo " Base de datos: ${DB} (69 GB aprox.)"
echo " Destino: ${DUMP_FILE}"
echo "=============================================="
echo ""
echo "⚠️  Este proceso puede tardar 30-60 minutos."
echo "   Presiona Ctrl+C para cancelar en los próximos 5 segundos..."
sleep 5

echo ""
echo "[1/3] Verificando integridad antes del dump..."
docker exec "${CONTAINER}" psql -U "${USER}" -d "${DB}" -t -A -c "
SELECT 'documentos=' || COUNT(*) FROM documentos
UNION ALL SELECT 'estado_resultado=' || COUNT(*) FROM estado_resultado
UNION ALL SELECT 'remuneraciones_2020=' || COUNT(*) FROM remuneraciones_2020
UNION ALL SELECT 'remuneraciones_2021=' || COUNT(*) FROM remuneraciones_2021
UNION ALL SELECT 'remuneraciones_2022=' || COUNT(*) FROM remuneraciones_2022
UNION ALL SELECT 'remuneraciones_2023=' || COUNT(*) FROM remuneraciones_2023
UNION ALL SELECT 'remuneraciones_2024=' || COUNT(*) FROM remuneraciones_2024;
"

echo ""
echo "[2/3] Generando dump en formato custom (paralelizable)..."
echo "      Tamaño estimado del dump: ~15-25 GB (comprimido)"

docker exec "${CONTAINER}" pg_dump \
    -U "${USER}" \
    -d "${DB}" \
    --format=custom \
    --compress=6 \
    --verbose \
    --no-password \
    --file=/tmp/pirgefse_prod.dump

echo ""
echo "[3/3] Copiando dump del contenedor al host..."
docker cp "${CONTAINER}:/tmp/pirgefse_prod.dump" "${DUMP_FILE}"
docker exec "${CONTAINER}" rm -f /tmp/pirgefse_prod.dump

DUMP_SIZE=$(du -sh "${DUMP_FILE}" | cut -f1)
echo ""
echo "✅  Dump generado exitosamente."
echo "   Archivo: ${DUMP_FILE}"
echo "   Tamaño:  ${DUMP_SIZE}"
echo ""
echo "Próximo paso — Transferir al servidor de producción:"
echo "  rsync -avz --progress ${DUMP_FILE} root@192.141.169.15:/opt/pirgefse/dumps/"
echo ""
echo "O con scp:"
echo "  scp -i ~/.ssh/id_pirgefse ${DUMP_FILE} root@192.141.169.15:/opt/pirgefse/dumps/"
