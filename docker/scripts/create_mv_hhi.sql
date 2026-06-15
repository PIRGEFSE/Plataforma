-- =============================================================
-- PIRGEFSE — Vista Materializada: HHI de Fuentes de Ingreso
-- Dimensión: Sostenibilidad y Riesgo Financiero
--
-- El Índice Herfindahl-Hirschman (HHI) mide la concentración
-- de las fuentes de financiamiento por sostenedor.
--
-- Fórmula:  HHI = Σ (s_i × 100)²
-- donde s_i = participación de la fuente i en el ingreso total
--
-- Interpretación (escala 0-10.000):
--   HHI < 1.500  → Concentración Baja   (diversificado)
--   HHI 1.500-2.500 → Concentración Moderada
--   HHI > 2.500  → Concentración Alta   (alta vulnerabilidad)
--
-- Fuente: estado_resultado WHERE desc_tipo_cuenta ILIKE '%ingreso%'
--         AND UPPER(TRIM(desc_estado)) = 'RENDIDO'
--         AND cuenta_alias_padre LIKE '3%'
--         Clasificado por subvencion_alias por sostenedor y período.
--
-- Optimizaciones:
--   - fuente_principal calculada con ROW_NUMBER() en lugar de
--     subconsultas correlacionadas (evita O(n²) por grupo)
--   - Índice en cuenta_alias_padre para acelerar el filtro '3%'
-- =============================================================

-- ── Índice de apoyo para el nuevo filtro (si no existe) ──────────────────
CREATE INDEX IF NOT EXISTS idx_er_cuenta_alias_padre
    ON estado_resultado (cuenta_alias_padre);

-- ── Vista 1: Participación de cada fuente por sostenedor/período ──
DROP MATERIALIZED VIEW IF EXISTS mv_hhi_fuentes CASCADE;

CREATE MATERIALIZED VIEW mv_hhi_fuentes AS
WITH ingresos AS (
    -- Agrega montos por fuente, filtrando solo ingresos rendidos
    -- con cuenta_alias_padre que inicia con '3'
    SELECT
        sost_id,
        periodo,
        subvencion_alias,
        SUM(monto_declarado) AS monto_fuente
    FROM estado_resultado
    WHERE UPPER(TRIM(desc_tipo_cuenta)) LIKE '%INGRESO%'
      AND UPPER(TRIM(desc_estado)) = 'RENDIDO'
      AND cuenta_alias_padre LIKE '3%'
      AND sost_id IS NOT NULL
      AND subvencion_alias IS NOT NULL
      AND subvencion_alias <> ''
    GROUP BY sost_id, periodo, subvencion_alias
),
totales AS (
    SELECT sost_id, periodo, SUM(monto_fuente) AS monto_total
    FROM ingresos
    GROUP BY sost_id, periodo
),
con_participacion AS (
    SELECT
        i.sost_id,
        i.periodo,
        i.subvencion_alias,
        i.monto_fuente,
        t.monto_total,
        CASE WHEN t.monto_total > 0
             THEN (i.monto_fuente / t.monto_total)
             ELSE 0 END                     AS participacion,
        CASE WHEN t.monto_total > 0
             THEN ROUND(((i.monto_fuente / t.monto_total) * 100)::NUMERIC, 2)
             ELSE 0 END                     AS pct_participacion
    FROM ingresos i
    JOIN totales t USING (sost_id, periodo)
),
-- Identifica la fuente principal usando ROW_NUMBER (evita subconsultas correlacionadas)
con_ranking AS (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY sost_id, periodo
            ORDER BY pct_participacion DESC, subvencion_alias
        ) AS rn
    FROM con_participacion
),
fuente_principal AS (
    SELECT sost_id, periodo, subvencion_alias AS fuente_principal, pct_participacion AS pct_fuente_principal
    FROM con_ranking
    WHERE rn = 1
),
hhi_calc AS (
    SELECT
        cp.sost_id,
        cp.periodo,
        -- HHI = Σ (pct_i)²  en escala 0-10.000
        ROUND(SUM(POWER(cp.participacion * 100, 2))::NUMERIC, 2) AS hhi,
        SUM(cp.monto_fuente)                                      AS monto_total,
        COUNT(DISTINCT cp.subvencion_alias)                       AS n_fuentes,
        fp.fuente_principal,
        fp.pct_fuente_principal
    FROM con_participacion cp
    JOIN fuente_principal fp USING (sost_id, periodo)
    GROUP BY cp.sost_id, cp.periodo, fp.fuente_principal, fp.pct_fuente_principal
),
con_riesgo AS (
    SELECT *,
        CASE
            WHEN hhi < 1500  THEN 'Concentración Baja'
            WHEN hhi < 2500  THEN 'Concentración Moderada'
            ELSE                  'Concentración Alta'
        END AS nivel_concentracion,
        CASE
            WHEN hhi < 1500  THEN 1
            WHEN hhi < 2500  THEN 2
            ELSE                  3
        END AS orden_concentracion
    FROM hhi_calc
)
SELECT * FROM con_riesgo
ORDER BY orden_concentracion DESC, hhi DESC;

CREATE INDEX ON mv_hhi_fuentes(sost_id);
CREATE INDEX ON mv_hhi_fuentes(periodo);
CREATE INDEX ON mv_hhi_fuentes(nivel_concentracion);
CREATE INDEX ON mv_hhi_fuentes(periodo, nivel_concentracion);

-- ── Vista 2: Resumen de HHI por período y nivel de concentración ──
DROP MATERIALIZED VIEW IF EXISTS mv_hhi_resumen CASCADE;

CREATE MATERIALIZED VIEW mv_hhi_resumen AS
SELECT
    periodo,
    nivel_concentracion,
    orden_concentracion,
    COUNT(DISTINCT sost_id)         AS n_sostenedores,
    ROUND(AVG(hhi)::NUMERIC, 2)     AS avg_hhi,
    ROUND(MIN(hhi)::NUMERIC, 2)     AS min_hhi,
    ROUND(MAX(hhi)::NUMERIC, 2)     AS max_hhi,
    SUM(monto_total)                AS monto_total
FROM mv_hhi_fuentes
GROUP BY periodo, nivel_concentracion, orden_concentracion
ORDER BY periodo, orden_concentracion;

CREATE UNIQUE INDEX ON mv_hhi_resumen(periodo, nivel_concentracion);

-- ── Vista 3: Participación global de fuentes (todos los sostenedores) ──
DROP MATERIALIZED VIEW IF EXISTS mv_hhi_fuentes_global CASCADE;

CREATE MATERIALIZED VIEW mv_hhi_fuentes_global AS
SELECT
    periodo,
    subvencion_alias,
    SUM(monto_declarado)                            AS monto_total,
    COUNT(DISTINCT sost_id)                         AS n_sostenedores,
    ROUND(
        (SUM(monto_declarado) /
         NULLIF(SUM(SUM(monto_declarado)) OVER (PARTITION BY periodo), 0) * 100
        )::NUMERIC, 2
    )                                               AS pct_participacion_global
FROM estado_resultado
WHERE UPPER(TRIM(desc_tipo_cuenta)) LIKE '%INGRESO%'
  AND UPPER(TRIM(desc_estado)) = 'RENDIDO'
  AND cuenta_alias_padre LIKE '3%'
  AND sost_id IS NOT NULL
  AND subvencion_alias IS NOT NULL
  AND subvencion_alias <> ''
GROUP BY periodo, subvencion_alias
ORDER BY periodo, monto_total DESC;

CREATE INDEX ON mv_hhi_fuentes_global(periodo);

DO $$ BEGIN
    RAISE NOTICE 'Vistas de HHI de Fuentes de Ingreso creadas exitosamente.';
END $$;
