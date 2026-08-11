import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine("postgresql+asyncpg://pirgefse:pirgefse2024@localhost:5432/pirgefse_db")
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='censo2024'"))
        print("--- tables in censo2024 ---")
        tables = [row[0] for row in res]
        for t in tables:
            print(t)
            res_col = await conn.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'censo2024' AND table_name = '{t}'"))
            for col in res_col:
                print(f"  {col[0]} ({col[1]})")

asyncio.run(main())
