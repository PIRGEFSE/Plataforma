-- =============================================================
-- PIRGEFSE — Vista Materializada: Innovación Pedagógica
-- Clasifica gastos de estado_resultado en:
--   * Gasto en Innovación Pedagógica: cuentas 410500, 410600, 410700
--   * Gasto No Remuneracional: gastos 410xxx que NO son los de nómina
--     (la lista de cuentas remuneracionales corresponde a 2024;
--      para otros años aplica la misma lógica pues aún no se ha
--      definido la lista definitiva de esos períodos)
--   * Total Gasto: suma de todos los registros filtrados por Gasto
-- =============================================================

-- Cuentas remuneracionales (referencia 2024)
-- Se excluyen de "Gasto No Remuneracional"
-- 410101,410102,410104,410105,410116,410119,410121,410124,410128,410129
-- 410401,410402,410403,410404,410304,410309,410501,410803

DROP MATERIALIZED VIEW IF EXISTS mv_innovacion_pedagogica CASCADE;

CREATE MATERIALIZED VIEW mv_innovacion_pedagogica AS
WITH gastos AS (
    -- Base: sólo registros clasificados como Gasto
    SELECT
        periodo,
        cuenta_alias,
        cuenta_alias_padre,
        SUM(monto_declarado) AS monto,
        COUNT(*)             AS n_registros
    FROM estado_resultado
    WHERE desc_tipo_cuenta ILIKE '%gasto%'
      AND cuenta_alias IS NOT NULL
      AND cuenta_alias <> ''
    GROUP BY periodo, cuenta_alias, cuenta_alias_padre
),
clasificados AS (
    SELECT
        periodo,
        cuenta_alias,
        cuenta_alias_padre,
        monto,
        n_registros,
        -- Innovación Pedagógica: comparación por cuenta_alias_PADRE
        CASE WHEN cuenta_alias_padre IN ('410500','410600','410700')
             THEN monto ELSE 0 END AS monto_innovacion,
        -- Remuneracional: comparación por cuenta_alias (sin cambios)
        CASE WHEN cuenta_alias IN (
                '410101','410102','410104','410105','410116','410119',
                '410121','410124','410128','410129',
                '410401','410402','410403','410404',
                '410304','410309','410501','410803'
             )
             THEN monto ELSE 0 END AS monto_remuneracional
    FROM gastos
)
SELECT
    periodo,
    -- Indicadores de innovación
    SUM(monto_innovacion)                                   AS monto_innovacion,
    SUM(monto)                                              AS total_gasto,
    SUM(monto) - SUM(monto_remuneracional)                  AS gasto_no_remuneracional,
    SUM(monto_remuneracional)                               AS gasto_remuneracional,

    -- Porcentajes calculados
    CASE WHEN SUM(monto) > 0
         THEN ROUND((SUM(monto_innovacion)::NUMERIC / SUM(monto) * 100), 2)
         ELSE 0 END                                         AS pct_innovacion_total,

    CASE WHEN (SUM(monto) - SUM(monto_remuneracional)) > 0
         THEN ROUND(
                (SUM(monto_innovacion)::NUMERIC /
                 NULLIF(SUM(monto) - SUM(monto_remuneracional), 0) * 100)
              , 2)
         ELSE 0 END                                         AS pct_innovacion_no_rem,

    SUM(n_registros)                                        AS n_registros
FROM clasificados
GROUP BY periodo
ORDER BY periodo;

CREATE UNIQUE INDEX ON mv_innovacion_pedagogica(periodo);

-- ─────────────────────────────────────────────────────────────
-- Vista detalle por cuenta para análisis de la composición
-- ─────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_innovacion_detalle CASCADE;

CREATE MATERIALIZED VIEW mv_innovacion_detalle AS
SELECT
    periodo,
    cuenta_alias,
    cuenta_alias_padre,
    SUM(monto_declarado)   AS monto_total,
    COUNT(*)               AS n_registros,
    COUNT(DISTINCT rbd)    AS n_establecimientos,
    CASE
        -- Innovación: comparación por cuenta_alias_PADRE
        WHEN cuenta_alias_padre IN ('410500','410600','410700')    THEN 'Innovación Pedagógica'
        -- Remuneracional: comparación por cuenta_alias (sin cambios)
        WHEN cuenta_alias IN (
                '410101','410102','410104','410105','410116','410119',
                '410121','410124','410128','410129',
                '410401','410402','410403','410404',
                '410304','410309','410501','410803')               THEN 'Remuneracional'
        ELSE 'No Remuneracional Otro'
    END AS tipo_cuenta
FROM estado_resultado
WHERE desc_tipo_cuenta ILIKE '%gasto%'
  AND cuenta_alias IS NOT NULL
  AND cuenta_alias <> ''
GROUP BY periodo, cuenta_alias, cuenta_alias_padre
ORDER BY periodo, tipo_cuenta, monto_total DESC;

CREATE INDEX ON mv_innovacion_detalle(periodo);
CREATE INDEX ON mv_innovacion_detalle(tipo_cuenta);

DO $$ BEGIN
    RAISE NOTICE 'Vistas mv_innovacion_pedagogica y mv_innovacion_detalle creadas exitosamente.';
END $$;
