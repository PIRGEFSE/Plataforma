import os
import glob
import pandas as pd
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("Error: No se encontró DATABASE_URL en las variables de entorno.")
    exit(1)

# SQLAlchemy no soporta 'postgresql+asyncpg' con pandas to_sql de manera nativa sin el driver adecuado de sync
# Por lo tanto, reemplazamos 'postgresql+asyncpg' por 'postgresql' para usar psycopg2 (asumiendo que está instalado)
if "postgresql+asyncpg" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg", "postgresql")

DATABASE_URL = DATABASE_URL.replace("localhost", "172.20.0.5")

engine = create_engine(DATABASE_URL)

# Ruta base donde se encuentran las carpetas de años
BASE_DIR = "/home/andres/Documentos/PIRGEFSE/Plataforma/BBDD/Convivencia Escolar"

# Buscar todos los archivos CSV en subcarpetas
csv_files = glob.glob(os.path.join(BASE_DIR, "**", "*.csv"), recursive=True)

if not csv_files:
    print("No se encontraron archivos CSV en el directorio especificado.")
    exit(1)

print(f"Se encontraron {len(csv_files)} archivos CSV. Comenzando lectura...")

df_list = []

for file in csv_files:
    print(f"Procesando: {os.path.basename(file)}")
    try:
        # Se asume encoding utf-8-sig para eliminar BOM (\ufeff)
        df = pd.read_csv(file, sep=';', encoding='utf-8-sig', dtype=str)
        df_list.append(df)
    except Exception as e:
        print(f"Error procesando el archivo {file}: {e}")

if df_list:
    print("Concatenando DataFrames...")
    # ignore_index=True y concatenar alinea automáticamente las columnas faltantes llenando con NaN
    df_final = pd.concat(df_list, ignore_index=True)
    
    print(f"DataFrame final creado con {len(df_final)} registros y {len(df_final.columns)} columnas.")
    print("Insertando datos en la base de datos (dim_convivencia_escolar)...")
    
    try:
        df_final.to_sql("dim_convivencia_escolar", engine, if_exists="replace", index=False, chunksize=10000)
        print("Datos insertados correctamente en dim_convivencia_escolar.")
    except Exception as e:
        print(f"Error al insertar en la base de datos: {e}")
else:
    print("No hay datos para procesar.")
