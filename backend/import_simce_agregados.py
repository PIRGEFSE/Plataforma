import asyncio
import pandas as pd
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import sys
import os

DB_URL = "postgresql+asyncpg://pirgefse:pirgefse2024@db:5432/pirgefse_db"

engine = create_async_engine(DB_URL)

async def main():
    async with engine.begin() as conn:
        # Create tables
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS dim_simce_comuna (
                cod_com INTEGER,
                grado VARCHAR(5),
                prom_lect NUMERIC,
                prom_mate NUMERIC,
                PRIMARY KEY (cod_com, grado)
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS dim_simce_region (
                cod_reg INTEGER,
                grado VARCHAR(5),
                prom_lect NUMERIC,
                prom_mate NUMERIC,
                PRIMARY KEY (cod_reg, grado)
            )
        """))
        await conn.execute(text("TRUNCATE TABLE dim_simce_comuna, dim_simce_region"))

        grados = ['2M', '4B', '6B']
        for grado in grados:
            # Comuna
            com_path = f'/BBDD/Simce+2024/{grado}/Archivos CSV (Planos)/simce{grado.lower()}2024_comuna_preliminar.csv'
            try:
                df = pd.read_csv(com_path, sep=';', encoding='latin-1', decimal=',')
            except:
                df = pd.read_csv(com_path, sep=',', encoding='utf-8', decimal='.')
            
            prom_lect_col = f'prom_lect{grado.lower()}_com'
            prom_mate_col = f'prom_mate{grado.lower()}_com'
            
            for _, row in df.iterrows():
                try:
                    await conn.execute(text("""
                        INSERT INTO dim_simce_comuna (cod_com, grado, prom_lect, prom_mate)
                        VALUES (:cod_com, :grado, :prom_lect, :prom_mate)
                        ON CONFLICT DO NOTHING
                    """), {
                        "cod_com": int(row['cod_com']),
                        "grado": grado,
                        "prom_lect": float(row[prom_lect_col].replace(',', '.')) if isinstance(row[prom_lect_col], str) else float(row[prom_lect_col]),
                        "prom_mate": float(row[prom_mate_col].replace(',', '.')) if isinstance(row[prom_mate_col], str) else float(row[prom_mate_col])
                    })
                except Exception as e:
                    pass
            
            # Region
            reg_path = f'/BBDD/Simce+2024/{grado}/Archivos CSV (Planos)/simce{grado.lower()}2024_region_preliminar.csv'
            try:
                df = pd.read_csv(reg_path, sep=';', encoding='latin-1', decimal=',')
            except:
                df = pd.read_csv(reg_path, sep=',', encoding='utf-8', decimal='.')
                
            prom_lect_col = f'prom_lect{grado.lower()}_reg'
            prom_mate_col = f'prom_mate{grado.lower()}_reg'
            
            for _, row in df.iterrows():
                try:
                    await conn.execute(text("""
                        INSERT INTO dim_simce_region (cod_reg, grado, prom_lect, prom_mate)
                        VALUES (:cod_reg, :grado, :prom_lect, :prom_mate)
                        ON CONFLICT DO NOTHING
                    """), {
                        "cod_reg": int(row['cod_reg']),
                        "grado": grado,
                        "prom_lect": float(row[prom_lect_col].replace(',', '.')) if isinstance(row[prom_lect_col], str) else float(row[prom_lect_col]),
                        "prom_mate": float(row[prom_mate_col].replace(',', '.')) if isinstance(row[prom_mate_col], str) else float(row[prom_mate_col])
                    })
                except Exception as e:
                    pass

    print("Datos oficiales de comuna y región importados exitosamente.")

if __name__ == '__main__':
    asyncio.run(main())
