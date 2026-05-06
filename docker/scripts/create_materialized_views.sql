-- =============================================================
-- PIRGEFSE — Vistas Materializadas para Performance de Dashboards
-- Ejecutar UNA VEZ después de cargar todos los datos.
-- Para refrescar: SELECT refresh_mv_all();
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. KPIs GENERALES (Resumen Ejecutivo)
--    Una sola fila por período con todos los totales.
-- ─────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_resumen_anual CASCADE;
CREATE MATERIALIZED VIEW mv_resumen_anual AS
SELECT
    d.periodo,
    SUM(d.monto_total)          AS monto_total_documentos,
    COUNT(d.id)                 AS n_documentos,
    COUNT(DISTINCT d.rbd)       AS n_establecimientos,
    COUNT(DISTINCT d.sost_id)   AS n_sostenedores
FROM documentos d
WHERE d.periodo IS NOT NULL
GROUP BY d.periodo
ORDER BY d.periodo;

CREATE UNIQUE INDEX ON mv_resumen_anual(periodo);

-- Totales globales (sin filtro de período, para el KPI con "Todos")
DROP MATERIALIZED VIEW IF EXISTS mv_resumen_global CASCADE;
CREATE MATERIALIZED VIEW mv_resumen_global AS
SELECT
    SUM(monto_total)        AS monto_total_documentos,
    COUNT(id)               AS n_documentos,
    COUNT(DISTINCT rbd)     AS n_establecimientos,
    COUNT(DISTINCT sost_id) AS n_sostenedores
FROM documentos;

-- ─────────────────────────────────────────────────────────────
-- 2. REMUNERACIONES POR AÑO (para KPIs y Tendencia)
-- ─────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_rem_anual CASCADE;
CREATE MATERIALIZED VIEW mv_rem_anual AS
SELECT
    anio,
    SUM(liquido)            AS liquido_total,
    SUM(totalhaber)         AS haber_total,
    SUM(totaldescuento)     AS descuento_total,
    ROUND(AVG(liquido), 0)  AS promedio_liquido,
    ROUND(AVG(totalhaber), 0) AS promedio_haber,
    ROUND(AVG(totaldescuento), 0) AS promedio_descuento,
    COUNT(*)                AS n_remuneraciones,
    COUNT(DISTINCT rut)     AS n_funcionarios
FROM remuneraciones
WHERE anio IS NOT NULL
GROUP BY anio
ORDER BY anio;

CREATE UNIQUE INDEX ON mv_rem_anual(anio);

-- Global (sin filtro de año)
DROP MATERIALIZED VIEW IF EXISTS mv_rem_global CASCADE;
CREATE MATERIALIZED VIEW mv_rem_global AS
SELECT
    SUM(liquido)        AS liquido_total,
    COUNT(*)            AS n_remuneraciones,
    COUNT(DISTINCT rut) AS n_funcionarios
FROM remuneraciones;

-- ─────────────────────────────────────────────────────────────
-- 3. REMUNERACIONES POR TIPO DE CONTRATO Y AÑO
-- ─────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_rem_por_tipo CASCADE;
CREATE MATERIALIZED VIEW mv_rem_por_tipo AS
SELECT
    anio,
    tip,
    COUNT(*)                AS n_registros,
    ROUND(AVG(liquido), 0)  AS promedio_liquido
FROM remuneraciones
WHERE tip IS NOT NULL AND tip <> '' AND anio IS NOT NULL
GROUP BY anio, tip
ORDER BY anio, n_registros DESC;

CREATE INDEX ON mv_rem_por_tipo(anio);

-- ─────────────────────────────────────────────────────────────
-- 4. DISTRIBUCIÓN POR SUBVENCIÓN Y AÑO
-- ─────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_subvencion_anual CASCADE;
CREATE MATERIALIZED VIEW mv_subvencion_anual AS
SELECT
    periodo,
    subvencion_alias,
    SUM(monto_total)    AS monto_total,
    COUNT(id)           AS n_documentos
FROM documentos
WHERE subvencion_alias IS NOT NULL AND subvencion_alias <> ''
  AND periodo IS NOT NULL
GROUP BY periodo, subvencion_alias
ORDER BY periodo, monto_total DESC;

CREATE INDEX ON mv_subvencion_anual(periodo);

-- Global
DROP MATERIALIZED VIEW IF EXISTS mv_subvencion_global CASCADE;
CREATE MATERIALIZED VIEW mv_subvencion_global AS
SELECT
    subvencion_alias,
    SUM(monto_total)    AS monto_total,
    COUNT(id)           AS n_documentos
FROM documentos
WHERE subvencion_alias IS NOT NULL AND subvencion_alias <> ''
GROUP BY subvencion_alias
ORDER BY monto_total DESC;

CREATE UNIQUE INDEX ON mv_subvencion_global(subvencion_alias);

-- ─────────────────────────────────────────────────────────────
-- 5. TOP SOSTENEDORES POR AÑO
-- ─────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_sostenedores_anual CASCADE;
CREATE MATERIALIZED VIEW mv_sostenedores_anual AS
SELECT
    periodo,
    sost_id,
    MAX(nombre_sost)            AS nombre_sost,
    SUM(monto_total)            AS monto_total,
    COUNT(DISTINCT rbd)         AS n_establecimientos
FROM documentos
WHERE sost_id IS NOT NULL AND periodo IS NOT NULL
GROUP BY periodo, sost_id
ORDER BY periodo, monto_total DESC;

CREATE INDEX ON mv_sostenedores_anual(periodo, monto_total DESC);

-- Global
DROP MATERIALIZED VIEW IF EXISTS mv_sostenedores_global CASCADE;
CREATE MATERIALIZED VIEW mv_sostenedores_global AS
SELECT
    sost_id,
    MAX(nombre_sost)            AS nombre_sost,
    SUM(monto_total)            AS monto_total,
    COUNT(DISTINCT rbd)         AS n_establecimientos
FROM documentos
WHERE sost_id IS NOT NULL
GROUP BY sost_id
ORDER BY monto_total DESC;

CREATE INDEX ON mv_sostenedores_global(sost_id);

-- ─────────────────────────────────────────────────────────────
-- 6. ESTADO DE RESULTADO POR PERÍODO Y TIPO DE CUENTA
-- ─────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_estado_resultado CASCADE;
CREATE MATERIALIZED VIEW mv_estado_resultado AS
SELECT
    periodo,
    desc_tipo_cuenta,
    SUM(monto_declarado)    AS monto_declarado
FROM estado_resultado
WHERE periodo IS NOT NULL
GROUP BY periodo, desc_tipo_cuenta
ORDER BY periodo, desc_tipo_cuenta;

CREATE INDEX ON mv_estado_resultado(periodo);

-- ─────────────────────────────────────────────────────────────
-- 7. TENDENCIA MENSUAL (documentos por mes/año para drill-down)
-- ─────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_tendencia_mensual CASCADE;
CREATE MATERIALIZED VIEW mv_tendencia_mensual AS
SELECT
    periodo,
    EXTRACT(MONTH FROM fecha_documento)     AS mes,
    SUM(monto_total)                        AS monto_total,
    COUNT(*)                                AS n_documentos
FROM documentos
WHERE fecha_documento IS NOT NULL AND periodo IS NOT NULL
GROUP BY periodo, mes
ORDER BY periodo, mes;

CREATE INDEX ON mv_tendencia_mensual(periodo, mes);

-- ─────────────────────────────────────────────────────────────
-- 8. FUNCIÓN DE REFRESCO DE TODAS LAS VISTAS
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_mv_all()
RETURNS TEXT AS $$
DECLARE
    t TIMESTAMP := clock_timestamp();
BEGIN
    RAISE NOTICE 'Iniciando refresco de vistas materializadas...';
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_resumen_anual;
    REFRESH MATERIALIZED VIEW mv_resumen_global;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rem_anual;
    REFRESH MATERIALIZED VIEW mv_rem_global;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rem_por_tipo;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_subvencion_anual;
    REFRESH MATERIALIZED VIEW mv_subvencion_global;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sostenedores_anual;
    REFRESH MATERIALIZED VIEW mv_sostenedores_global;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_estado_resultado;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tendencia_mensual;
    RETURN 'OK — Todas las vistas refrescadas en ' ||
           ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - t))::NUMERIC, 1) || 's';
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- Mostrar resultado
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN RAISE NOTICE 'Vistas materializadas creadas y pobladas exitosamente.'; END $$;
