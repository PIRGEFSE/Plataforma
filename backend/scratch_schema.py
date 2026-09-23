import asyncio
from database import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        print("--- dim_matricula ---")
        res = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dim_matricula'"))
        for row in res: print(row)
        
        print("\n--- dim_asistencia_anual ---")
        res = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dim_asistencia_anual'"))
        for row in res: print(row)
        
        print("\n--- dim_horas_curriculares ---")
        res = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dim_horas_curriculares'"))
        for row in res: print(row)

asyncio.run(main())
