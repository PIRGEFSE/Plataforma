"""
Script: load_sned_tables.py
Propósito: Crear las tablas Ficha_SNED y Tabla_SNED en la base de datos
           y cargar los datos desde los archivos CSV del backend.

Tablas:
  - Ficha_SNED  → archivos resultados_campos_sned*.csv
  - Tabla_SNED  → archivos resultados_tabla_sned*.csv

Uso:
  cd /home/andres/Documentos/PIRGEFSE/Plataforma/backend
  source .venv/bin/activate
  python load_sned_tables.py
"""

import os
import glob
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# ─── Configuración ───────────────────────────────────────────────────────────
# Cargar variables del .env (usa psycopg2 síncrono en lugar de asyncpg)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL_ASYNC = os.getenv("DATABASE_URL", "")
# Convertir URL asyncpg → psycopg2 para uso síncrono con pandas
DATABASE_URL_SYNC = DATABASE_URL_ASYNC.replace(
    "postgresql+asyncpg://", "postgresql+psycopg2://"
)

engine = create_engine(DATABASE_URL_SYNC, echo=False)

# Directorio donde están los CSV (mismo directorio que este script)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# ─── DDL de las tablas ───────────────────────────────────────────────────────
DDL_FICHA_SNED = """
CREATE TABLE IF NOT EXISTS "Ficha_SNED" (
    id                    SERIAL PRIMARY KEY,
    nro                   INTEGER          NOT NULL,
    grupo_homogeneo       TEXT,
    posicion_gh           INTEGER,
    n_establecimientos_gh INTEGER,
    seleccionado_sned     TEXT,
    agno                  INTEGER
);
"""

DDL_TABLA_SNED = """
CREATE TABLE IF NOT EXISTS "Tabla_SNED" (
    id                  SERIAL PRIMARY KEY,
    nro_establecimiento INTEGER          NOT NULL,
    agno                INTEGER,
    resultados_sned     TEXT,
    ind_sned            NUMERIC(12, 4),
    e                   NUMERIC(12, 4),
    s                   NUMERIC(12, 4),
    i                   NUMERIC(12, 4),
    m                   NUMERIC(12, 4),
    ig                  NUMERIC(12, 4),
    int_val             NUMERIC(12, 4)
);
"""

# ─── Helpers ─────────────────────────────────────────────────────────────────
def parse_number(val):
    """Convierte '57,3916' → 57.3916; devuelve None si no es válido."""
    if pd.isna(val):
        return None
    s = str(val).strip().replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def load_campos_sned(pattern: str) -> pd.DataFrame:
    """
    Lee todos los CSV resultados_campos_sned*.csv y devuelve un DataFrame
    normalizado listo para insertar en Ficha_SNED.
    """
    files = sorted(glob.glob(pattern))
    if not files:
        print(f"  ⚠️  No se encontraron archivos con el patrón: {pattern}")
        return pd.DataFrame()

    dfs = []
    for f in files:
        print(f"  📄 Leyendo {os.path.basename(f)} …")
        df = pd.read_csv(f, encoding="utf-8")
        dfs.append(df)

    combined = pd.concat(dfs, ignore_index=True)

    # Normalizar columnas → nombres de la tabla
    combined.rename(columns={
        "NRO":                    "nro",
        "GRUPO_HOMOGENEO":        "grupo_homogeneo",
        "POSICION_GH":            "posicion_gh",
        "N_ESTABLECIMIENTOS_GH":  "n_establecimientos_gh",
        "SELECCIONADO_SNED":      "seleccionado_sned",
        "AGNO":                   "agno",
    }, inplace=True)

    # Convertir tipos
    combined["nro"]                   = pd.to_numeric(combined["nro"],                   errors="coerce")
    combined["posicion_gh"]           = pd.to_numeric(combined["posicion_gh"],           errors="coerce")
    combined["n_establecimientos_gh"] = pd.to_numeric(combined["n_establecimientos_gh"], errors="coerce")
    combined["agno"]                  = pd.to_numeric(combined["agno"],                  errors="coerce")

    # Eliminar duplicados exactos
    combined.drop_duplicates(inplace=True)

    print(f"  ✅ Total registros Ficha_SNED: {len(combined)}")
    return combined[["nro", "grupo_homogeneo", "posicion_gh",
                      "n_establecimientos_gh", "seleccionado_sned", "agno"]]


def load_tabla_sned(pattern: str) -> pd.DataFrame:
    """
    Lee todos los CSV resultados_tabla_sned*.csv y devuelve un DataFrame
    normalizado listo para insertar en Tabla_SNED.
    """
    files = sorted(glob.glob(pattern))
    if not files:
        print(f"  ⚠️  No se encontraron archivos con el patrón: {pattern}")
        return pd.DataFrame()

    dfs = []
    for f in files:
        print(f"  📄 Leyendo {os.path.basename(f)} …")
        df = pd.read_csv(f, encoding="utf-8")
        dfs.append(df)

    combined = pd.concat(dfs, ignore_index=True)

    # Normalizar columnas → nombres de la tabla
    # Columna "IND. SNED" puede tener punto en el nombre
    rename_map = {
        "NRO_ESTABLECIMIENTO": "nro_establecimiento",
        "AGNO":                "agno",
        "RESULTADOS SNED":     "resultados_sned",
        "IND. SNED":           "ind_sned",
        "E":                   "e",
        "S":                   "s",
        "I":                   "i",
        "M":                   "m",
        "IG":                  "ig",
        "INT":                 "int_val",
    }
    combined.rename(columns=rename_map, inplace=True)

    # Convertir columnas numéricas (formato español: "57,3916" → 57.3916)
    for col in ["ind_sned", "e", "s", "i", "m", "ig", "int_val"]:
        if col in combined.columns:
            combined[col] = combined[col].apply(parse_number)

    combined["nro_establecimiento"] = pd.to_numeric(combined["nro_establecimiento"], errors="coerce")
    combined["agno"]                = pd.to_numeric(combined["agno"],                errors="coerce")

    # Eliminar duplicados exactos
    combined.drop_duplicates(inplace=True)

    print(f"  ✅ Total registros Tabla_SNED: {len(combined)}")
    return combined[["nro_establecimiento", "agno", "resultados_sned",
                      "ind_sned", "e", "s", "i", "m", "ig", "int_val"]]


# ─── Main ────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  Creando tablas Ficha_SNED y Tabla_SNED en la BD…")
    print("=" * 60)

    with engine.begin() as conn:
        conn.execute(text(DDL_FICHA_SNED))
        print("  ✅ Tabla 'Ficha_SNED' lista.")
        conn.execute(text(DDL_TABLA_SNED))
        print("  ✅ Tabla 'Tabla_SNED' lista.")

    # ── Cargar Ficha_SNED ──────────────────────────────────────────────────
    print("\n  Cargando datos en Ficha_SNED…")
    pattern_campos = os.path.join(BASE_DIR, "resultados_campos_sned*.csv")
    df_ficha = load_campos_sned(pattern_campos)

    if not df_ficha.empty:
        df_ficha.to_sql(
            name="Ficha_SNED",
            con=engine,
            if_exists="append",   # No borrar; agrega sin duplicar (drop_duplicates ya aplicado)
            index=False,
            method="multi",
            chunksize=500,
        )
        print(f"  ✅ {len(df_ficha)} filas insertadas en 'Ficha_SNED'.")
    else:
        print("  ⚠️  Sin datos para insertar en Ficha_SNED.")

    # ── Cargar Tabla_SNED ──────────────────────────────────────────────────
    print("\n  Cargando datos en Tabla_SNED…")
    pattern_tabla = os.path.join(BASE_DIR, "resultados_tabla_sned*.csv")
    df_tabla = load_tabla_sned(pattern_tabla)

    if not df_tabla.empty:
        df_tabla.to_sql(
            name="Tabla_SNED",
            con=engine,
            if_exists="append",
            index=False,
            method="multi",
            chunksize=500,
        )
        print(f"  ✅ {len(df_tabla)} filas insertadas en 'Tabla_SNED'.")
    else:
        print("  ⚠️  Sin datos para insertar en Tabla_SNED.")

    print("\n" + "=" * 60)
    print("  ¡Proceso completado exitosamente!")
    print("=" * 60)


if __name__ == "__main__":
    main()
