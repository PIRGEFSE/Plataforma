import asyncio
from database import engine
from sqlalchemy import text

async def create_mv():
    print("Creating materialized view mv_sostenibilidad_riesgo...")
    async with engine.begin() as conn:
        await conn.execute(text("""
        DROP MATERIALIZED VIEW IF EXISTS mv_sostenibilidad_riesgo;
        """))
        
        await conn.execute(text("""
        CREATE MATERIALIZED VIEW mv_sostenibilidad_riesgo AS
        SELECT 
            m.agno,
            eo.rut_sostenedor AS sost_id,
            m.rbd,
            m.cod_ense,
            m.cod_espe,
            COUNT(DISTINCT m.mrun) AS matricula,
            COUNT(a.mrun) AS registros_asistencia,
            SUM(COALESCE(a.tasa_asistencia_3, 0)) AS sum_tasa_3,
            COUNT(a.tasa_asistencia_3) AS cnt_tasa_3,
            SUM(COALESCE(a.tasa_asistencia_4, 0)) AS sum_tasa_4,
            COUNT(a.tasa_asistencia_4) AS cnt_tasa_4,
            SUM(COALESCE(a.tasa_asistencia_5, 0)) AS sum_tasa_5,
            COUNT(a.tasa_asistencia_5) AS cnt_tasa_5,
            SUM(COALESCE(a.tasa_asistencia_6, 0)) AS sum_tasa_6,
            COUNT(a.tasa_asistencia_6) AS cnt_tasa_6,
            SUM(COALESCE(a.tasa_asistencia_7, 0)) AS sum_tasa_7,
            COUNT(a.tasa_asistencia_7) AS cnt_tasa_7,
            SUM(COALESCE(a.tasa_asistencia_8, 0)) AS sum_tasa_8,
            COUNT(a.tasa_asistencia_8) AS cnt_tasa_8,
            SUM(COALESCE(a.tasa_asistencia_9, 0)) AS sum_tasa_9,
            COUNT(a.tasa_asistencia_9) AS cnt_tasa_9,
            SUM(COALESCE(a.tasa_asistencia_10, 0)) AS sum_tasa_10,
            COUNT(a.tasa_asistencia_10) AS cnt_tasa_10,
            SUM(COALESCE(a.tasa_asistencia_11, 0)) AS sum_tasa_11,
            COUNT(a.tasa_asistencia_11) AS cnt_tasa_11,
            SUM(COALESCE(a.tasa_asistencia_12, 0)) AS sum_tasa_12,
            COUNT(a.tasa_asistencia_12) AS cnt_tasa_12,
            SUM(COALESCE(a.tasa_asistencia_3, 0) + COALESCE(a.tasa_asistencia_4, 0) + COALESCE(a.tasa_asistencia_5, 0) +
                COALESCE(a.tasa_asistencia_6, 0) + COALESCE(a.tasa_asistencia_7, 0) + COALESCE(a.tasa_asistencia_8, 0) +
                COALESCE(a.tasa_asistencia_9, 0) + COALESCE(a.tasa_asistencia_10, 0) + COALESCE(a.tasa_asistencia_11, 0) + COALESCE(a.tasa_asistencia_12, 0)) AS sum_tasas_total
        FROM dim_matricula m
        INNER JOIN dim_establecimiento_oficial eo ON eo.rbd = m.rbd AND eo.agno = CAST(m.agno AS INT)
        INNER JOIN (
            SELECT DISTINCT cod_ense, cod_grado, cod_espe, jec
            FROM dim_horas_curriculares
        ) hc ON hc.cod_ense = m.cod_ense 
            AND hc.cod_grado = m.cod_grado 
            AND hc.cod_espe = m.cod_espe 
            AND hc.jec = CASE WHEN m.cod_jor = 3 THEN 1 ELSE 0 END
        LEFT JOIN dim_asistencia_anual a ON CAST(m.agno AS SMALLINT) = a.agno AND m.rbd = a.rbd AND m.mrun = a.mrun
        WHERE m.agno IN (2020, 2021, 2022, 2023, 2024)
        GROUP BY 
            m.agno, eo.rut_sostenedor, m.rbd, m.cod_ense, m.cod_espe;
        """))

        print("Creating indexes on mv_sostenibilidad_riesgo...")
        await conn.execute(text("CREATE UNIQUE INDEX idx_mv_sost_riesgo_pk ON mv_sostenibilidad_riesgo(agno, sost_id, rbd, cod_ense, cod_espe);"))
        await conn.execute(text("CREATE INDEX idx_mv_sost_riesgo_sost ON mv_sostenibilidad_riesgo(sost_id);"))
        
    print("Materialized view successfully created.")

if __name__ == "__main__":
    asyncio.run(create_mv())
