import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select, text
from database import engine, AsyncSessionLocal, Base
from models import User
from auth import hash_password

INITIAL_USERS = [
    {"username": "admin", "email": "admin@pirgefse.cl", "password": "pirgefse2024", "role": "admin"},
    {"username": "viewer", "email": "viewer@pirgefse.cl", "password": "viewer2024", "role": "viewer"},
]

async def init_db():
    async with engine.begin() as conn:
        await conn.execute(text("CREATE TABLE IF NOT EXISTS app_users ("
            "id SERIAL PRIMARY KEY,"
            "username VARCHAR(50) UNIQUE NOT NULL,"
            "email VARCHAR(100) UNIQUE,"
            "password_hash VARCHAR(255) NOT NULL,"
            "role VARCHAR(20) NOT NULL DEFAULT 'viewer',"
            "is_active BOOLEAN DEFAULT TRUE,"
            "created_at TIMESTAMPTZ DEFAULT NOW()"
            ")"))

    async with AsyncSessionLocal() as db:
        for u in INITIAL_USERS:
            existing = await db.execute(select(User).where(User.username == u["username"]))
            if existing.scalar_one_or_none() is None:
                user = User(
                    username=u["username"],
                    email=u["email"],
                    password_hash=hash_password(u["password"]),
                    role=u["role"],
                )
                db.add(user)
                print(f"  ✅ Usuario '{u['username']}' creado con rol '{u['role']}'")
            else:
                print(f"  ℹ️  Usuario '{u['username']}' ya existe, saltando.")
        await db.commit()

if __name__ == "__main__":
    asyncio.run(init_db())
