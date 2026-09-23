import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import sys

async def test():
    engine = create_async_engine("postgresql+asyncpg://pirgefse:pirgefse2024@localhost:5432/pirgefse_db")
    async with engine.connect() as conn:
        res = await conn.execute(text("""
            WITH ingresos AS (
                SELECT rbd, periodo, SUM(monto_declarado) as total_ingreso
                FROM estado_resultado
                WHERE sost_id = 69110400
                  AND subvencion_alias = 'GENERAL'
                  AND cuenta_alias_padre != '500000'
                  AND periodo IN (2022, 2023, 2024)
                GROUP BY rbd, periodo
            ),
            asistencia AS (
                SELECT rbd, agno, SUM(tasa_asistencia_anual) as total_asistencia
                FROM dim_asistencia_anual
                WHERE agno IN (2022, 2023, 2024)
                GROUP BY rbd, agno
            )
            SELECT * FROM ingresos LIMIT 5;
        """))
        print("Ingresos:", res.mappings().all())
        
        res2 = await conn.execute(text("""
            SELECT rbd, agno, SUM(tasa_asistencia_anual) as total_asistencia
            FROM dim_asistencia_anual
            WHERE agno IN (2022, 2023, 2024) AND rbd = 1
            GROUP BY rbd, agno LIMIT 5;
        """))
        print("Asistencia:", res2.mappings().all())

asyncio.run(test())
