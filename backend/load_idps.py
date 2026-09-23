import os
import glob
import pandas as pd
from sqlalchemy import create_engine

DB_URL = "postgresql://pirgefse:pirgefse2024@db:5432/pirgefse_db"
engine = create_engine(DB_URL)

def load_csvs(pattern, table_name):
    print(f"Loading {table_name}...")
    files = glob.glob(pattern, recursive=True)
    df_list = []
    for f in files:
        if ".csv#" in f:
            continue
        print(f"  Reading {f}...")
        try:
            df = pd.read_csv(f, sep=";", low_memory=False, encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(f, sep=";", low_memory=False, encoding="latin1")
        # clean columns
        df.columns = [str(c).strip().replace('"', '').lower() for c in df.columns]
        df_list.append(df)
    
    if not df_list:
        print(f"  No files found for {table_name}.")
        return

    combined = pd.concat(df_list, ignore_index=True)
    print(f"  Writing {len(combined)} rows to {table_name}...")
    combined.to_sql(table_name, engine, if_exists="replace", index=False)
    print(f"  {table_name} loaded successfully.\n")

if __name__ == "__main__":
    base_dir = "/data/bbdd/IDPS"
    load_csvs(f"{base_dir}/**/*rbd_dim*.csv", "dim_IDPS")
    load_csvs(f"{base_dir}/**/*niveles*.csv", "dim_niveles_IDPS")
    print("Done!")
