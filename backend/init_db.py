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

async def create_schema():
    """
    Crea la tabla app_users si no existe.
    REQUIERE privilegios DDL (superusuario). Usar solo en despliegue inicial,
    NO en el startup normal de la aplicación.
    """
    async with engine.begin() as conn:
        await conn.execute(text(
            "CREATE TABLE IF NOT EXISTS app_users ("
            "id SERIAL PRIMARY KEY,"
            "username VARCHAR(50) UNIQUE NOT NULL,"
            "email VARCHAR(100) UNIQUE,"
            "password_hash VARCHAR(255) NOT NULL,"
            "role VARCHAR(20) NOT NULL DEFAULT 'viewer',"
            "sost_id BIGINT,"
            "rbd_id BIGINT,"
            "is_active BOOLEAN DEFAULT TRUE,"
            "created_at TIMESTAMPTZ DEFAULT NOW(),"
            "resumen_pins JSONB DEFAULT '[]'::jsonb"
            ")"
        ))
        # Migración incremental: agregar columnas si no existen
        await conn.execute(text(
            "ALTER TABLE app_users ADD COLUMN IF NOT EXISTS sost_id BIGINT"
        ))
        await conn.execute(text(
            "ALTER TABLE app_users ADD COLUMN IF NOT EXISTS rbd_id BIGINT"
        ))
        await conn.execute(text(
            "ALTER TABLE app_users ADD COLUMN IF NOT EXISTS resumen_pins JSONB DEFAULT '[]'::jsonb"
        ))
    print("  ✅ Esquema app_users verificado.")

async def migrate_schema():
    """
    Migración incremental: agrega columnas nuevas si no existen.
    Seguro de ejecutar múltiples veces (idempotente).
    """
    async with engine.begin() as conn:
        await conn.execute(text(
            "ALTER TABLE app_users ADD COLUMN IF NOT EXISTS sost_id BIGINT"
        ))
        await conn.execute(text(
            "ALTER TABLE app_users ADD COLUMN IF NOT EXISTS rbd_id BIGINT"
        ))
        await conn.execute(text(
            "ALTER TABLE app_users ADD COLUMN IF NOT EXISTS resumen_pins JSONB DEFAULT '[]'::jsonb"
        ))
    print("  ✅ Migración incremental completada.")

async def seed_users():
    """
    Inserta los usuarios iniciales si no existen.
    Solo requiere permisos INSERT/SELECT — compatible con pirgefse_app.
    """
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

async def init_db():
    """
    Punto de entrada para el startup de la app.
    Solo hace seed de usuarios (sin DDL).
    La tabla app_users debe existir previamente (creada en el despliegue).
    """
    await seed_users()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Inicializar base de datos PIRGEFSE")
    parser.add_argument(
        "--full",
        action="store_true",
        help="Crear esquema (DDL) + usuarios. Requiere superusuario."
    )
    parser.add_argument(
        "--migrate",
        action="store_true",
        help="Solo migración incremental de columnas nuevas (idempotente)."
    )
    args = parser.parse_args()

    async def main():
        if args.full:
            print("[Modo completo] Creando esquema + usuarios...")
            await create_schema()
            await seed_users()
        elif args.migrate:
            print("[Modo migración] Aplicando cambios incrementales...")
            await migrate_schema()
        else:
            print("[Modo seed] Solo insertando usuarios (tabla debe existir)...")
            await seed_users()

    asyncio.run(main())
