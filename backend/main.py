from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from config import settings
from database import engine
from routes.auth_routes import router as auth_router
from routes.dashboard import router as dashboard_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializar base de datos al arrancar."""
    logger.info("🚀 Iniciando PIRGEFSE API...")
    # Ejecutar init_db al arrancar
    try:
        import subprocess, sys
        subprocess.run([sys.executable, "init_db.py"], check=True)
        logger.info("✅ Base de datos inicializada correctamente")
    except Exception as e:
        logger.error(f"⚠️  Error inicializando BD: {e}")
    yield
    logger.info("🛑 Cerrando PIRGEFSE API...")
    await engine.dispose()

app = FastAPI(
    title="PIRGEFSE API",
    description="API de indicadores financieros educacionales",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(dashboard_router)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "PIRGEFSE API"}
