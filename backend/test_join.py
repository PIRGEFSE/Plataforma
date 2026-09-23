import asyncio
from database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        q = text("""
        WITH base_matricula AS (
            SELECT m.agno, m.rbd, m.mrun, 
                   CAST(NULLIF(m.cod_ense, '') AS BIGINT) AS cod_ense, 
                   CAST(NULLIF(m.cod_grado, '') AS BIGINT) AS cod_grado, 
                   CAST(NULLIF(m.cod_espe, '') AS BIGINT) AS cod_espe,
                   CASE WHEN CAST(NULLIF(m.cod_jor, '') AS INT) = 3 THEN 1 ELSE 0 END AS jec
            FROM dim_matricula m
            WHERE m.agno IN ('2023','2024')
            LIMIT 1000
        )
        SELECT COUNT(*) FROM base_matricula b
        WHERE EXISTS (
            SELECT 1 FROM dim_horas_curriculares hc 
            WHERE hc.cod_ense = b.cod_ense 
              AND hc.cod_grado = b.cod_grado 
              AND hc.cod_espe = b.cod_espe 
              AND hc.jec = b.jec
        )
        """)
        res = await conn.execute(q)
        print("Count with JOIN:", res.scalar())
        
        q2 = text("SELECT COUNT(*) FROM dim_matricula WHERE agno IN ('2023','2024')")
        res2 = await conn.execute(q2)
        print("Count without JOIN:", res2.scalar())

asyncio.run(main())
