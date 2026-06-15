from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # ---------------------------------------------------------------
    # Base de datos
    # Debe definirse en la variable de entorno DATABASE_URL.
    # No tiene valor por defecto para evitar conexiones accidentales
    # a una BBDD de desarrollo en entornos de producción.
    # ---------------------------------------------------------------
    DATABASE_URL: str

    # ---------------------------------------------------------------
    # JWT — SECRET_KEY debe ser una cadena aleatoria de >= 64 chars.
    # Generar con: python3 -c "import secrets; print(secrets.token_hex(32))"
    # No tiene valor por defecto: la app falla al iniciar si no se define.
    # ---------------------------------------------------------------
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 horas

    # ---------------------------------------------------------------
    # CORS — En producción debe apuntar al dominio real del frontend.
    # ---------------------------------------------------------------
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()

