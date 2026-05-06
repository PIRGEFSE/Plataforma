-- =============================================================
-- PIRGEFSE — Vista Materializada: Gasto Remuneracional sobre
-- Ingreso Depurado
-- Dimensión: Riesgo Estructural y Comportamiento Financiero
--
-- Indicador: Gasto Remuneracional / Ingreso Depurado (%)
--
-- Numerador:   tabla REMUNERACIONES, cuentas de nómina 2024
--              (para otros años la clasificación es referencial)
-- Denominador: tabla ESTADO_RESULTADO, desc_tipo_cuenta ILIKE
--              '%ingreso%', UPPER(TRIM(desc_estado)) = 'RENDIDO'
--
-- Niveles de riesgo:
--   < 70%         → Riesgo Bajo    (margen operacional saludable)
--   70% – 84.99%  → Riesgo Medio   (presión financiera moderada)
--   85% – 94.99%  → Riesgo Alto    (poca flexibilidad)
--   ≥ 95%         → Riesgo Crítico (cobertura comprometida)
-- =============================================================

-- Cuentas remuneracionales (referencia 2024):
-- 410101,410102,410104,410105,410116,410119,410121,410124,
-- 410128,410129,410401,410402,410403,410404,410304,410309,
-- 410501,410803

-- ── Vista 1: Gasto remuneracional por sostenedor/período ─────
DROP MATERIALIZED VIEW IF EXISTS mv_rem_por_sost CASCADE;

CREATE MATERIALIZED VIEW mv_rem_por_sost AS
SELECT
    sostenedor                   AS sost_id,
    anio                         AS periodo,
    SUM(monto)                   AS gasto_rem
FROM remuneraciones
WHERE cuenta_alias IN (
    '410101','410102','410104','410105','410116','410119',
    '410121','410124','410128','410129',
    '410401','410402','410403','410404',
    '410304','410309','410501','410803'
)
  AND sostenedor IS NOT NULL
GROUP BY sostenedor, anio;

CREATE INDEX ON mv_rem_por_sost(sost_id);
CREATE INDEX ON mv_rem_por_sost(periodo);
CREATE INDEX ON mv_rem_por_sost(periodo, sost_id);

-- ── Vista 2: Ingreso depurado por sostenedor/período ─────────
DROP MATERIALIZED VIEW IF EXISTS mv_ingreso_depurado CASCADE;

CREATE MATERIALIZED VIEW mv_ingreso_depurado AS
SELECT
    sost_id,
    periodo,
    SUM(monto_declarado) AS ingreso_total
FROM estado_resultado
WHERE desc_tipo_cuenta ILIKE '%ingreso%'
  AND UPPER(TRIM(desc_estado)) = 'RENDIDO'
  AND sost_id IS NOT NULL
GROUP BY sost_id, periodo;

CREATE INDEX ON mv_ingreso_depurado(sost_id);
CREATE INDEX ON mv_ingreso_depurado(periodo);
CREATE INDEX ON mv_ingreso_depurado(periodo, sost_id);

-- ── Vista 3: Ratio por sostenedor/período ────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_ratio_rem_ingreso CASCADE;

CREATE MATERIALIZED VIEW mv_ratio_rem_ingreso AS
WITH joined AS (
    SELECT
        COALESCE(r.sost_id, i.sost_id) AS sost_id,
        COALESCE(r.periodo, i.periodo) AS periodo,
        COALESCE(r.gasto_rem, 0)       AS gasto_rem,
        COALESCE(i.ingreso_total, 0)   AS ingreso_total
    FROM mv_rem_por_sost r
    FULL OUTER JOIN mv_ingreso_depurado i
        ON r.sost_id = i.sost_id AND r.periodo = i.periodo
    WHERE COALESCE(r.gasto_rem, 0) > 0
      OR  COALESCE(i.ingreso_total, 0) > 0
),
con_ratio AS (
    SELECT *,
        CASE WHEN ingreso_total > 0
             THEN ROUND((gasto_rem / ingreso_total * 100)::NUMERIC, 2)
             ELSE NULL
        END AS ratio_pct
    FROM joined
)
SELECT *,
    CASE
        WHEN ratio_pct IS NULL     THEN 'Sin Datos'
        WHEN ratio_pct < 70        THEN 'Riesgo Bajo'
        WHEN ratio_pct < 85        THEN 'Riesgo Medio'
        WHEN ratio_pct < 95        THEN 'Riesgo Alto'
        ELSE                            'Riesgo Crítico'
    END AS nivel_riesgo,
    CASE
        WHEN ratio_pct IS NULL     THEN 0
        WHEN ratio_pct < 70        THEN 1
        WHEN ratio_pct < 85        THEN 2
        WHEN ratio_pct < 95        THEN 3
        ELSE                            4
    END AS orden_riesgo
FROM con_ratio
ORDER BY orden_riesgo DESC, ratio_pct DESC NULLS LAST;

CREATE INDEX ON mv_ratio_rem_ingreso(sost_id);
CREATE INDEX ON mv_ratio_rem_ingreso(periodo);
CREATE INDEX ON mv_ratio_rem_ingreso(nivel_riesgo);
CREATE INDEX ON mv_ratio_rem_ingreso(periodo, nivel_riesgo);

-- ── Vista 4: Resumen global por período y nivel de riesgo ────
DROP MATERIALIZED VIEW IF EXISTS mv_ratio_rem_resumen CASCADE;

CREATE MATERIALIZED VIEW mv_ratio_rem_resumen AS
SELECT
    periodo,
    nivel_riesgo,
    orden_riesgo,
    COUNT(DISTINCT sost_id)          AS n_sostenedores,
    ROUND(AVG(ratio_pct)::NUMERIC,2) AS avg_ratio,
    ROUND(MIN(ratio_pct)::NUMERIC,2) AS min_ratio,
    ROUND(MAX(ratio_pct)::NUMERIC,2) AS max_ratio,
    SUM(gasto_rem)                   AS total_gasto_rem,
    SUM(ingreso_total)               AS total_ingreso
FROM mv_ratio_rem_ingreso
WHERE nivel_riesgo <> 'Sin Datos'
GROUP BY periodo, nivel_riesgo, orden_riesgo
ORDER BY periodo, orden_riesgo;

CREATE INDEX ON mv_ratio_rem_resumen(periodo);

DO $$ BEGIN
    RAISE NOTICE 'Vistas de Ratio Rem/Ingreso creadas exitosamente.';
END $$;
