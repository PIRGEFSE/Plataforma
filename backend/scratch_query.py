import asyncio
import os
import sys

# Ajustar path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
              AND (table_name ILIKE '%docente%' OR table_name ILIKE '%asistente%' OR table_name ILIKE '%personal%' OR table_name ILIKE '%dotacion%')
        """))
        print("Tablas encontradas:")
        for r in res:
            print(r)

if __name__ == "__main__":
    asyncio.run(main())
