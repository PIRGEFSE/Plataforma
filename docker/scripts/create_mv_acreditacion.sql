-- =============================================================
-- PIRGEFSE — Vista Materializada: Acreditación de Saldos
-- Dimensión: Sostenibilidad y Riesgo Financiero
--
-- Agrupa por sostenedor y período el estado de rendición
-- (RENDIDO / NO RENDIDO), normalizando la grafía con UPPER(),
-- y clasifica a los sostenedores en niveles de riesgo según
-- su tasa de rendición acumulada:
--
--   RIESGO BAJO     : ≥ 90% registros RENDIDO
--   RIESGO MEDIO    : 70% – 89%
--   RIESGO ALTO     : 40% – 69%
--   RIESGO CRÍTICO  : < 40%
-- =============================================================

-- ── Vista 1: Resumen global por período y estado ─────────────
DROP MATERIALIZED VIEW IF EXISTS mv_acreditacion_global CASCADE;

CREATE MATERIALIZED VIEW mv_acreditacion_global AS
SELECT
    periodo,
    CASE WHEN UPPER(TRIM(desc_estado)) = 'RENDIDO'    THEN 'Rendido'
         WHEN UPPER(TRIM(desc_estado)) = 'NO RENDIDO' THEN 'No rendido'
         ELSE 'Sin estado'
    END                              AS estado_norm,
    COUNT(*)                         AS n_registros,
    SUM(monto_declarado)             AS monto_total
FROM estado_resultado
WHERE desc_estado IS NOT NULL
GROUP BY periodo, estado_norm
ORDER BY periodo, estado_norm;

CREATE INDEX ON mv_acreditacion_global(periodo);

-- ── Vista 2: Clasificación de riesgo por sostenedor ──────────
DROP MATERIALIZED VIEW IF EXISTS mv_acreditacion_riesgo CASCADE;

CREATE MATERIALIZED VIEW mv_acreditacion_riesgo AS
WITH base AS (
    SELECT
        sost_id,
        periodo,
        COUNT(*)                                                         AS total_reg,
        SUM(CASE WHEN UPPER(TRIM(desc_estado)) = 'RENDIDO'    THEN 1 ELSE 0 END) AS n_rendido,
        SUM(CASE WHEN UPPER(TRIM(desc_estado)) = 'NO RENDIDO' THEN 1 ELSE 0 END) AS n_no_rendido,
        SUM(monto_declarado)                                             AS monto_total,
        SUM(CASE WHEN UPPER(TRIM(desc_estado)) = 'RENDIDO'
                 THEN monto_declarado ELSE 0 END)                        AS monto_rendido,
        SUM(CASE WHEN UPPER(TRIM(desc_estado)) = 'NO RENDIDO'
                 THEN monto_declarado ELSE 0 END)                        AS monto_no_rendido,
        MAX(subvencion_alias)                                            AS subvencion_alias,
        MAX(region_rbd::INT)                                             AS region_rbd
    FROM estado_resultado
    WHERE sost_id IS NOT NULL
      AND desc_estado IS NOT NULL
    GROUP BY sost_id, periodo
),
con_pct AS (
    SELECT *,
        CASE WHEN total_reg > 0
             THEN ROUND((n_rendido::NUMERIC / total_reg * 100), 2)
             ELSE 0 END AS pct_rendido,
        CASE WHEN total_reg > 0
             THEN ROUND((n_no_rendido::NUMERIC / total_reg * 100), 2)
             ELSE 0 END AS pct_no_rendido
    FROM base
),
con_riesgo AS (
    SELECT *,
        CASE
            WHEN pct_rendido >= 90 THEN 'Riesgo Bajo'
            WHEN pct_rendido >= 70 THEN 'Riesgo Medio'
            WHEN pct_rendido >= 40 THEN 'Riesgo Alto'
            ELSE                        'Riesgo Crítico'
        END AS nivel_riesgo,
        CASE
            WHEN pct_rendido >= 90 THEN 1
            WHEN pct_rendido >= 70 THEN 2
            WHEN pct_rendido >= 40 THEN 3
            ELSE                        4
        END AS orden_riesgo
    FROM con_pct
)
SELECT *
FROM con_riesgo
ORDER BY orden_riesgo DESC, monto_no_rendido DESC;

CREATE INDEX ON mv_acreditacion_riesgo(sost_id);
CREATE INDEX ON mv_acreditacion_riesgo(periodo);
CREATE INDEX ON mv_acreditacion_riesgo(nivel_riesgo);
CREATE INDEX ON mv_acreditacion_riesgo(periodo, nivel_riesgo);

-- ── Vista 3: Resumen de niveles de riesgo por período ────────
DROP MATERIALIZED VIEW IF EXISTS mv_acreditacion_resumen_riesgo CASCADE;

CREATE MATERIALIZED VIEW mv_acreditacion_resumen_riesgo AS
SELECT
    periodo,
    nivel_riesgo,
    orden_riesgo,
    COUNT(DISTINCT sost_id)   AS n_sostenedores,
    SUM(monto_total)          AS monto_total,
    SUM(monto_no_rendido)     AS monto_no_rendido,
    SUM(n_no_rendido)         AS n_no_rendido_total,
    ROUND(AVG(pct_rendido), 2) AS avg_pct_rendido
FROM mv_acreditacion_riesgo
GROUP BY periodo, nivel_riesgo, orden_riesgo
ORDER BY periodo, orden_riesgo;

CREATE INDEX ON mv_acreditacion_resumen_riesgo(periodo);

DO $$ BEGIN
    RAISE NOTICE 'Vistas de Acreditación de Saldos creadas exitosamente.';
END $$;
