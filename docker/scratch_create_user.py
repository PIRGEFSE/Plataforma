import asyncio
from sqlalchemy import text
from database import AsyncSessionLocal
from auth import hash_password

async def create_user():
    username = "sie"
    email = "sie@pirgefse.cl"
    role = "admin"
    sost_id = None
    password_hash = hash_password("sie2024")
    
    async with AsyncSessionLocal() as db:
        await db.execute(
            text("""
            INSERT INTO app_users (username, email, password_hash, role, sost_id, theme, is_active)
            VALUES (:username, :email, :password_hash, :role, :sost_id, 'dark', true)
            """),
            {
                "username": username,
                "email": email,
                "password_hash": password_hash,
                "role": role,
                "sost_id": sost_id
            }
        )
        await db.commit()
    print("User created successfully")

if __name__ == "__main__":
    asyncio.run(create_user())
