import pandas as pd
from sqlalchemy import create_engine

# Database connection
DB_URL = "postgresql://pirgefse:pirgefse2024@172.20.0.5:5432/pirgefse_db"
engine = create_engine(DB_URL)

# Path to the CSV file
CSV_PATH = '/home/andres/Documentos/PIRGEFSE/Plataforma/BBDD/matriz_horas_curriculares_chile_homologado_sige.csv'

def main():
    print(f"Reading {CSV_PATH}...")
    
    # Read CSV
    # Using utf-8-sig to handle the BOM (Byte Order Mark) if present
    df = pd.read_csv(CSV_PATH, encoding='utf-8-sig', sep=',')
    
    # Convert column names to lowercase for PostgreSQL standard
    df.columns = [c.lower() for c in df.columns]
    
    print(f"Loading {len(df)} rows into 'dim_horas_curriculares' table...")
    
    # Load into the database. 
    # if_exists='replace' will drop the table if it exists and recreate it.
    df.to_sql('dim_horas_curriculares', engine, if_exists='replace', index=False)
    
    print("Data loaded successfully.")

if __name__ == '__main__':
    main()
