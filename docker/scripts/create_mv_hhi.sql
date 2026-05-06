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
--         Clasificado por subvencion_alias por sostenedor y período.
-- =============================================================

-- ── Vista 1: Participación de cada fuente por sostenedor/período ──
DROP MATERIALIZED VIEW IF EXISTS mv_hhi_fuentes CASCADE;

CREATE MATERIALIZED VIEW mv_hhi_fuentes AS
WITH ingresos AS (
    SELECT
        sost_id,
        periodo,
        subvencion_alias,
        SUM(monto_declarado)                AS monto_fuente
    FROM estado_resultado
    WHERE desc_tipo_cuenta ILIKE '%ingreso%'
      AND UPPER(TRIM(desc_estado)) = 'RENDIDO'
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
hhi_calc AS (
    SELECT
        sost_id,
        periodo,
        -- HHI = Σ (pct_i)²  en escala 0-10.000
        ROUND(SUM(POWER(participacion * 100, 2))::NUMERIC, 2)   AS hhi,
        SUM(monto_fuente)                                        AS monto_total,
        COUNT(DISTINCT subvencion_alias)                         AS n_fuentes,
        -- Fuente principal (mayor participación)
        MAX(subvencion_alias) FILTER (
            WHERE pct_participacion = (
                SELECT MAX(cp2.pct_participacion)
                FROM con_participacion cp2
                WHERE cp2.sost_id = con_participacion.sost_id
                  AND cp2.periodo  = con_participacion.periodo
            )
        )                                                        AS fuente_principal,
        MAX(pct_participacion) FILTER (
            WHERE pct_participacion = (
                SELECT MAX(cp2.pct_participacion)
                FROM con_participacion cp2
                WHERE cp2.sost_id = con_participacion.sost_id
                  AND cp2.periodo  = con_participacion.periodo
            )
        )                                                        AS pct_fuente_principal
    FROM con_participacion
    GROUP BY sost_id, periodo
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
WHERE desc_tipo_cuenta ILIKE '%ingreso%'
  AND UPPER(TRIM(desc_estado)) = 'RENDIDO'
  AND sost_id IS NOT NULL
  AND subvencion_alias IS NOT NULL
  AND subvencion_alias <> ''
GROUP BY periodo, subvencion_alias
ORDER BY periodo, monto_total DESC;

CREATE INDEX ON mv_hhi_fuentes_global(periodo);

DO $$ BEGIN
    RAISE NOTICE 'Vistas de HHI de Fuentes de Ingreso creadas exitosamente.';
END $$;
