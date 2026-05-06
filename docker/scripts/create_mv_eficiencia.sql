-- =============================================================
-- PIRGEFSE — Vista Materializada: Eficiencia y Estructura del Gasto
-- Clasifica el gasto de estado_resultado por categoría según
-- el prefijo de cuenta_alias:
--   410xx → Gasto en Aula
--   411xx → Gasto Administrativo
--   700xx → Otros Gastos
-- Solo registros donde desc_tipo_cuenta contiene 'Gasto'
-- =============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_eficiencia_gasto CASCADE;

CREATE MATERIALIZED VIEW mv_eficiencia_gasto AS
SELECT
    periodo,
    subvencion_alias,
    region_rbd,
    CASE
        WHEN cuenta_alias LIKE '410%' THEN 'Gasto en Aula'
        WHEN cuenta_alias LIKE '411%' THEN 'Gasto Administrativo'
        WHEN cuenta_alias LIKE '700%' THEN 'Otros Gastos'
        ELSE 'Sin clasificar'
    END                                         AS categoria_gasto,
    SUM(monto_declarado)                        AS monto_total,
    COUNT(*)                                    AS n_registros,
    COUNT(DISTINCT rbd)                         AS n_establecimientos,
    COUNT(DISTINCT sost_id)                     AS n_sostenedores
FROM estado_resultado
WHERE
    desc_tipo_cuenta ILIKE '%gasto%'
    AND cuenta_alias IS NOT NULL
    AND cuenta_alias <> ''
    AND (
        cuenta_alias LIKE '410%' OR
        cuenta_alias LIKE '411%' OR
        cuenta_alias LIKE '700%'
    )
GROUP BY
    periodo,
    subvencion_alias,
    region_rbd,
    categoria_gasto
ORDER BY
    periodo,
    categoria_gasto;

CREATE INDEX ON mv_eficiencia_gasto(periodo);
CREATE INDEX ON mv_eficiencia_gasto(categoria_gasto);
CREATE INDEX ON mv_eficiencia_gasto(periodo, categoria_gasto);

-- ─────────────────────────────────────────────────────────────
-- Vista agregada por período y categoría (para gráficos principales)
-- ─────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_eficiencia_resumen CASCADE;

CREATE MATERIALIZED VIEW mv_eficiencia_resumen AS
SELECT
    periodo,
    CASE
        WHEN cuenta_alias LIKE '410%' THEN 'Gasto en Aula'
        WHEN cuenta_alias LIKE '411%' THEN 'Gasto Administrativo'
        WHEN cuenta_alias LIKE '700%' THEN 'Otros Gastos'
        ELSE 'Sin clasificar'
    END                             AS categoria_gasto,
    SUM(monto_declarado)            AS monto_total,
    COUNT(*)                        AS n_registros
FROM estado_resultado
WHERE
    desc_tipo_cuenta ILIKE '%gasto%'
    AND cuenta_alias IS NOT NULL
    AND cuenta_alias <> ''
    AND (
        cuenta_alias LIKE '410%' OR
        cuenta_alias LIKE '411%' OR
        cuenta_alias LIKE '700%'
    )
GROUP BY periodo, categoria_gasto
ORDER BY periodo, categoria_gasto;

CREATE UNIQUE INDEX ON mv_eficiencia_resumen(periodo, categoria_gasto);

DO $$ BEGIN
    RAISE NOTICE 'Vista mv_eficiencia_gasto y mv_eficiencia_resumen creadas exitosamente.';
END $$;
