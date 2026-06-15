import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import json

DATABASE_URL = "postgresql+asyncpg://pirgefse:pirgefse2024@localhost:5432/pirgefse_db"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'remuneraciones'"))
        cols_rem = [dict(row) for row in res.mappings()]
        print("Remuneraciones:", [c['column_name'] for c in cols_rem])

asyncio.run(main())
