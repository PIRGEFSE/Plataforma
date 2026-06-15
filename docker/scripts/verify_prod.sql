-- =============================================================
-- PIRGEFSE — Verificación post-restauración de producción
-- Ejecutar tras pg_restore para validar integridad
--
-- docker compose exec db psql -U pirgefse -d pirgefse_db -f /tmp/verify_prod.sql
-- =============================================================

\echo '====== PIRGEFSE — Verificación de Producción ======'
\echo ''
\echo '--- 1. Tamaño total de la base de datos ---'
SELECT pg_size_pretty(pg_database_size('pirgefse_db')) AS database_size;

\echo ''
\echo '--- 2. Conteo de filas en tablas principales ---'
SELECT 'documentos'        AS tabla, COUNT(*) AS filas FROM documentos
UNION ALL
SELECT 'estado_resultado'  AS tabla, COUNT(*) AS filas FROM estado_resultado
UNION ALL
SELECT 'remuneraciones_2020', COUNT(*) FROM remuneraciones_2020
UNION ALL
SELECT 'remuneraciones_2021', COUNT(*) FROM remuneraciones_2021
UNION ALL
SELECT 'remuneraciones_2022', COUNT(*) FROM remuneraciones_2022
UNION ALL
SELECT 'remuneraciones_2023', COUNT(*) FROM remuneraciones_2023
UNION ALL
SELECT 'remuneraciones_2024', COUNT(*) FROM remuneraciones_2024
ORDER BY tabla;

\echo ''
\echo '--- 3. Estado de vistas materializadas ---'
SELECT 
    matviewname,
    ispopulated,
    pg_size_pretty(pg_relation_size(matviewname::regclass)) AS size
FROM pg_matviews 
WHERE schemaname = 'public'
ORDER BY pg_relation_size(matviewname::regclass) DESC;

\echo ''
\echo '--- 4. Usuarios y privilegios ---'
SELECT usename, usesuper, usecreatedb 
FROM pg_user 
ORDER BY usename;

\echo ''
\echo '--- 5. Índices presentes ---'
SELECT COUNT(*) AS total_indices FROM pg_indexes WHERE schemaname = 'public';

\echo ''
\echo '--- 6. Tablas staging (no deben existir en producción) ---'
SELECT COUNT(*) AS tablas_staging_incorrectas
FROM pg_tables
WHERE schemaname = 'public'
  AND (tablename LIKE 'staging_%' OR tablename LIKE '_stg_%');

\echo ''
\echo '--- 7. Muestra de usuarios de la app ---'
SELECT id, username, role, created_at 
FROM app_users 
ORDER BY created_at 
LIMIT 5;

\echo ''
\echo '====== Verificación completada ======'
