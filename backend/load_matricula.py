import pandas as pd
import os
import glob
from sqlalchemy import create_engine, text
from io import StringIO
import csv
import sys

BASE_DIR = '/home/andres/Documentos/PIRGEFSE/Plataforma/BBDD/Matricula por Estudiante'
DB_URL = "postgresql://pirgefse:pirgefse2024@172.20.0.5:5432/pirgefse_db"
engine = create_engine(DB_URL)

def psql_insert_copy(table, conn, keys, data_iter):
    # This method is used to insert data extremely fast into postgres via COPY
    dbapi_conn = conn.connection
    with dbapi_conn.cursor() as cur:
        s_buf = StringIO()
        writer = csv.writer(s_buf)
        writer.writerows(data_iter)
        s_buf.seek(0)
        
        columns = ', '.join('"{}"'.format(k) for k in keys)
        table_name = '"{}"'.format(table.name)
        if table.schema:
            table_name = '"{}"."{}"'.format(table.schema, table.name)
            
        sql = 'COPY {} ({}) FROM STDIN WITH CSV NULL '''.format(table_name, columns)
        cur.copy_expert(sql=sql, file=s_buf)

def main():
    folders = [f for f in os.listdir(BASE_DIR) if f.startswith('Matricula-por-estudiante-') and os.path.isdir(os.path.join(BASE_DIR, f))]
    folders.sort() # Ensure we process them in order, or we can find 2024 specifically
    
    file_paths = []
    file_2024 = None
    for folder in folders:
        folder_path = os.path.join(BASE_DIR, folder)
        csv_files = glob.glob(os.path.join(folder_path, '*.CSV'))
        if not csv_files:
            continue
        csv_path = csv_files[0]
        file_paths.append(csv_path)
        if '2024' in folder:
            file_2024 = csv_path
            
    if not file_2024:
        print("2024 file not found, which is needed to define the superset schema.")
        sys.exit(1)

    print(f"Found {len(file_paths)} CSV files to load.")

    # 1. Create the table using the 2024 file's schema
    print(f"Reading first chunk of {file_2024} to infer schema...")
    try:
        df_2024_chunk = pd.read_csv(file_2024, sep=';', nrows=10, encoding='utf-8-sig', dtype=str)
    except:
        df_2024_chunk = pd.read_csv(file_2024, sep=';', nrows=10, encoding='latin-1', dtype=str)
        
    df_2024_chunk.columns = [c.lower() for c in df_2024_chunk.columns]
    all_columns = list(df_2024_chunk.columns)

from sqlalchemy.types import Integer, BigInteger, SmallInteger, Text

    print("Dropping and creating dim_matricula table...")
    sql_dtypes = {
        'agno': SmallInteger(),
        'rbd': Integer(),
        'mrun': BigInteger(),
        'cod_ense': Integer(),
        'cod_grado': Integer(),
        'cod_jor': Integer(),
        'cod_espe': Integer()
    }
    df_2024_chunk.head(0).to_sql('dim_matricula', engine, if_exists='replace', index=False, dtype=sql_dtypes)
    
    # We will use low_memory=False and dtype=str to avoid warnings and mixed types for safe import, 
    # but since this is analytics we can also just let it infer.
    # To be extremely safe with data variations across 5 years, converting all to string might be safest.
    # However, pandas usually infers correctly. We will use the default inference.
    
    # 2. Insert data for all files
    for csv_path in file_paths:
        print(f"\n--- Loading {csv_path} ---")
        try:
            chunks = pd.read_csv(csv_path, sep=';', chunksize=500000, encoding='utf-8-sig', low_memory=False)
        except Exception:
            chunks = pd.read_csv(csv_path, sep=';', chunksize=500000, encoding='latin-1', low_memory=False)
            
        chunk_num = 1
        for chunk in chunks:
            chunk.columns = [c.lower() for c in chunk.columns]
            
            # Align columns: add missing columns as NaN, drop extra columns not in superset
            for col in all_columns:
                if col not in chunk.columns:
                    chunk[col] = pd.NA
                    
            chunk = chunk[all_columns] # reorder and filter to match table exactly
            
            chunk.to_sql('dim_matricula', engine, if_exists='append', index=False, method=psql_insert_copy)
            print(f"  Inserted chunk {chunk_num} ({len(chunk)} rows)")
            chunk_num += 1

if __name__ == '__main__':
    main()
