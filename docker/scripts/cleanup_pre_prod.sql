-- =============================================================
-- PIRGEFSE — Limpieza pre-producción
-- Ejecutar UNA VEZ antes de generar el dump de producción
-- docker compose exec db psql -U pirgefse -d pirgefse_db -f /docker-entrypoint-initdb.d/cleanup_pre_prod.sql
-- =============================================================

-- 1. Eliminar tablas temporales/staging que no deben ir a producción
DROP TABLE IF EXISTS staging_documentos;
DROP TABLE IF EXISTS _stg_2024_test;

-- 2. Crear usuario de aplicación con permisos mínimos
--    Este usuario es el que usa el backend en producción
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pirgefse_app') THEN
        CREATE ROLE pirgefse_app WITH LOGIN PASSWORD 'CAMBIAR_ANTES_DE_PRODUCCION';
        RAISE NOTICE 'Usuario pirgefse_app creado';
    ELSE
        RAISE NOTICE 'Usuario pirgefse_app ya existe';
    END IF;
END
$$;

-- 3. Otorgar permisos al usuario de la aplicación
GRANT CONNECT ON DATABASE pirgefse_db TO pirgefse_app;
GRANT USAGE ON SCHEMA public TO pirgefse_app;

-- Permisos de lectura/escritura en tablas de datos
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    documentos,
    estado_resultado,
    remuneraciones,
    remuneraciones_2020,
    remuneraciones_2021,
    remuneraciones_2022,
    remuneraciones_2023,
    remuneraciones_2024
TO pirgefse_app;

-- Permisos de solo lectura en dimensiones y vistas materializadas
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pirgefse_app;

-- Permisos en secuencias
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pirgefse_app;

-- 4. Asegurar permisos por defecto para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO pirgefse_app;

-- 5. Verificación final
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(quote_ident(tablename))) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(quote_ident(tablename)) DESC;
