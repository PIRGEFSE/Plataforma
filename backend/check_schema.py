import asyncio
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine("postgresql+asyncpg://pirgefse:pirgefse2024@localhost:5432/pirgefse_db")
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dim_simce'"))
        print("--- dim_simce ---")
        for row in res:
            print(f"{row[0]} ({row[1]})")

        res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
        print("--- tables ---")
        for row in res:
            print(row[0])

asyncio.run(main())
