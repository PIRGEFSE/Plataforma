 WITH joined AS (
         SELECT COALESCE(r.sost_id, i.sost_id) AS sost_id,
            COALESCE(r.periodo, i.periodo) AS periodo,
            COALESCE(r.gasto_rem, (0)::numeric) AS gasto_rem,
            COALESCE(i.ingreso_total, (0)::numeric) AS ingreso_total
           FROM (mv_rem_por_sost r
             FULL JOIN mv_ingreso_depurado i ON (((r.sost_id = i.sost_id) AND (r.periodo = i.periodo))))
          WHERE ((COALESCE(r.gasto_rem, (0)::numeric) > (0)::numeric) OR (COALESCE(i.ingreso_total, (0)::numeric) > (0)::numeric))
        ), con_ratio AS (
         SELECT joined.sost_id,
            joined.periodo,
            joined.gasto_rem,
            joined.ingreso_total,
                CASE
                    WHEN (joined.ingreso_total > (0)::numeric) THEN round(((joined.gasto_rem / joined.ingreso_total) * (100)::numeric), 2)
                    ELSE NULL::numeric
                END AS ratio_pct
           FROM joined
        )
 SELECT sost_id,
    periodo,
    gasto_rem,
    ingreso_total,
    ratio_pct,
        CASE
            WHEN (ratio_pct IS NULL) THEN 'Sin Datos'::text
            WHEN (ratio_pct < (70)::numeric) THEN 'Riesgo Bajo'::text
            WHEN (ratio_pct < (85)::numeric) THEN 'Riesgo Medio'::text
            WHEN (ratio_pct < (95)::numeric) THEN 'Riesgo Alto'::text
            ELSE 'Riesgo Crítico'::text
        END AS nivel_riesgo,
        CASE
            WHEN (ratio_pct IS NULL) THEN 0
            WHEN (ratio_pct < (70)::numeric) THEN 1
            WHEN (ratio_pct < (85)::numeric) THEN 2
            WHEN (ratio_pct < (95)::numeric) THEN 3
            ELSE 4
        END AS orden_riesgo
   FROM con_ratio
  ORDER BY
        CASE
            WHEN (ratio_pct IS NULL) THEN 0
            WHEN (ratio_pct < (70)::numeric) THEN 1
            WHEN (ratio_pct < (85)::numeric) THEN 2
            WHEN (ratio_pct < (95)::numeric) THEN 3
            ELSE 4
        END DESC, ratio_pct DESC NULLS LAST;