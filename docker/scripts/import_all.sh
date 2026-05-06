#!/usr/bin/env bash
# =============================================================
# import_all.sh
# Orquestador principal: importa todos los archivos en orden
# Uso: bash import_all.sh [--skip-remuneraciones] [--only-year YYYY]
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../.env"

SKIP_REMUNERACIONES=false
ONLY_YEAR=""

# Parsear argumentos
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-remuneraciones) SKIP_REMUNERACIONES=true; shift ;;
        --only-year) ONLY_YEAR="$2"; shift 2 ;;
        *) echo "Argumento desconocido: $1"; exit 1 ;;
    esac
done

echo "=============================================="
echo " PIRGEFSE — Importación Completa"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

START_TOTAL=$(date +%s)

# --- Documentos ---
echo ""
echo ">>> [1/3] Importando Documentos.txt..."
START=$(date +%s)
bash "${SCRIPT_DIR}/import_documentos.sh"
echo "    Tiempo: $(( $(date +%s) - START )) segundos"

# --- Estado Resultado ---
echo ""
echo ">>> [2/3] Importando Estado_resultado.txt..."
START=$(date +%s)
bash "${SCRIPT_DIR}/import_estado.sh"
echo "    Tiempo: $(( $(date +%s) - START )) segundos"

# --- Remuneraciones ---
if [ "${SKIP_REMUNERACIONES}" = true ]; then
    echo ""
    echo ">>> [3/3] Remuneraciones: OMITIDO (--skip-remuneraciones)"
elif [ -n "${ONLY_YEAR}" ]; then
    echo ""
    echo ">>> [3/3] Importando Remuneraciones_${ONLY_YEAR}.txt..."
    START=$(date +%s)
    bash "${SCRIPT_DIR}/import_remuneraciones.sh" "${ONLY_YEAR}"
    echo "    Tiempo: $(( $(date +%s) - START )) segundos"
else
    echo ""
    echo ">>> [3/3] Importando Remuneraciones (todos los años 2020-2024)..."
    START=$(date +%s)
    bash "${SCRIPT_DIR}/import_remuneraciones.sh"
    echo "    Tiempo: $(( $(date +%s) - START )) segundos"
fi

echo ""
echo "=============================================="
echo " ✅ Importación completa"
echo " Tiempo total: $(( $(date +%s) - START_TOTAL )) segundos"
echo "=============================================="

# Resumen final
docker exec -i "pirgefse_db" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
\echo '=== Resumen de tablas ==='
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS tamaño
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

\echo '=== Conteo por tabla de hechos ==='
SELECT 'documentos' AS tabla, COUNT(*) AS filas FROM documentos
UNION ALL
SELECT 'estado_resultado', COUNT(*) FROM estado_resultado
UNION ALL
SELECT 'remuneraciones', COUNT(*) FROM remuneraciones;
SQL
