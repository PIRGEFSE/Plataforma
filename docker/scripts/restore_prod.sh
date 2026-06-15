#!/usr/bin/env bash
# =============================================================
# restore_prod.sh
# Restaura la base de datos PIRGEFSE en el servidor de producción
#
# Uso: bash restore_prod.sh /ruta/al/pirgefse_prod_YYYYMMDD.dump
# Prerequisito: 
#   - Docker y docker compose instalados en el servidor
#   - .env.production configurado con contraseñas reales
#   - Dump transferido al servidor
#
# Ejecutar en el servidor de producción:
#   cd /opt/pirgefse/docker
#   bash scripts/restore_prod.sh /opt/pirgefse/dumps/pirgefse_prod_YYYYMMDD.dump
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env.production"

if [ ! -f "${ENV_FILE}" ]; then
    echo "❌  Error: ${ENV_FILE} no encontrado."
    echo "   Copia y configura el template primero:"
    echo "   cp .env.production.template .env.production"
    echo "   vim .env.production"
    exit 1
fi

source "${ENV_FILE}"

if [ $# -lt 1 ]; then
    echo "❌  Error: Debes especificar la ruta del dump."
    echo "   Uso: bash restore_prod.sh /ruta/al/pirgefse_prod.dump"
    exit 1
fi

DUMP_FILE="$1"
CONTAINER="pirgefse_db"

if [ ! -f "${DUMP_FILE}" ]; then
    echo "❌  Error: Archivo dump no encontrado: ${DUMP_FILE}"
    exit 1
fi

DUMP_SIZE=$(du -sh "${DUMP_FILE}" | cut -f1)

echo "=============================================="
echo " PIRGEFSE — Restauración en Producción"
echo " Fecha: $(date)"
echo " Dump: ${DUMP_FILE} (${DUMP_SIZE})"
echo " Host: $(hostname)"
echo "=============================================="
echo ""
echo "⚠️  ATENCIÓN: Este proceso:"
echo "   - Levantará solo el contenedor de DB"
echo "   - Restaurará ~69 GB de datos (2-4 horas)"
echo "   - Creará el usuario de aplicación"
echo ""
echo "Presiona Enter para continuar o Ctrl+C para cancelar..."
read -r

# --- Paso 1: Levantar solo el contenedor de DB ---
echo ""
echo "[1/6] Levantando contenedor de base de datos..."
docker compose -f docker-compose.prod.yml --env-file .env.production up -d db
sleep 10

# Esperar a que PostgreSQL esté listo
echo "      Esperando que PostgreSQL esté listo..."
for i in {1..30}; do
    if docker exec "${CONTAINER}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" &>/dev/null; then
        echo "      ✅ PostgreSQL listo."
        break
    fi
    echo "      ... intento ${i}/30"
    sleep 5
done

# --- Paso 2: Copiar dump al contenedor ---
echo ""
echo "[2/6] Copiando dump al contenedor (${DUMP_SIZE})..."
docker cp "${DUMP_FILE}" "${CONTAINER}:/tmp/pirgefse_restore.dump"

# --- Paso 3: Restaurar con paralelismo ---
echo ""
echo "[3/6] Restaurando base de datos con pg_restore (-j 4)..."
echo "      Esto puede tardar 2-4 horas. No interrumpir."
RESTORE_START=$(date +%s)

docker exec "${CONTAINER}" pg_restore \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --jobs=4 \
    --verbose \
    --no-password \
    /tmp/pirgefse_restore.dump

RESTORE_END=$(date +%s)
RESTORE_MINS=$(( (RESTORE_END - RESTORE_START) / 60 ))
echo "      ✅ Restauración completada en ${RESTORE_MINS} minutos."

# --- Paso 4: Limpiar dump del contenedor ---
echo ""
echo "[4/6] Limpiando dump temporal del contenedor..."
docker exec "${CONTAINER}" rm -f /tmp/pirgefse_restore.dump

# --- Paso 5: Crear usuario de aplicación ---
echo ""
echo "[5/6] Configurando usuario de aplicación (pirgefse_app)..."
docker exec -i "${CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<SQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pirgefse_app') THEN
        CREATE ROLE pirgefse_app WITH LOGIN PASSWORD '${POSTGRES_APP_PASSWORD}';
        RAISE NOTICE 'Usuario pirgefse_app creado';
    ELSE
        ALTER ROLE pirgefse_app WITH PASSWORD '${POSTGRES_APP_PASSWORD}';
        RAISE NOTICE 'Usuario pirgefse_app: contraseña actualizada';
    END IF;
END
\$\$;

GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO pirgefse_app;
GRANT USAGE ON SCHEMA public TO pirgefse_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pirgefse_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_users TO pirgefse_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pirgefse_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO pirgefse_app;
SQL

# --- Paso 6: Verificación ---
echo ""
echo "[6/6] Verificando integridad..."
docker exec "${CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "
SELECT 
    'documentos' AS tabla, COUNT(*) AS filas FROM documentos
UNION ALL SELECT 'estado_resultado', COUNT(*) FROM estado_resultado
UNION ALL SELECT 'remuneraciones', COUNT(*) FROM remuneraciones
UNION ALL SELECT 'app_users', COUNT(*) FROM app_users
ORDER BY tabla;
"

echo ""
echo "=============================================="
echo " ✅  Restauración completada exitosamente."
echo " Próximo paso: levantar la plataforma completa"
echo "   docker compose -f docker-compose.prod.yml --env-file .env.production up -d"
echo "=============================================="
