import os
import re
import pandas as pd
from bs4 import BeautifulSoup

def process_sned_file(filepath):
    print(f"Procesando archivo: {filepath}")
    
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    # Separar el documento en las 3 páginas copiadas
    # Usamos el tag <!DOCTYPE html> o <html como separador
    pages = re.split(r'(?i)<!DOCTYPE html', content)
    
    # Filtramos fragmentos vacíos
    pages = [p for p in pages if p.strip()]

    records = []
    tables_data = []

    for idx, page in enumerate(pages):
        soup = BeautifulSoup(page, 'lxml')
        
        # Diccionario para almacenar los datos de esta página
        record = {}
        
        # Función auxiliar para buscar el label y obtener el valor en el <p> siguiente
        def get_value_by_label_keyword(keyword):
            label = soup.find('label', string=lambda t: t and keyword in t)
            if label:
                # Buscar el <p> o div siguiente
                # Según la estructura es:
                # <label>...</label>
                # <p class="ficha"> : valor </p>
                p = label.find_next_sibling('p')
                if p:
                    # Obtenemos el texto, eliminando espacios y el ":"
                    val = p.get_text(separator=' ', strip=True)
                    if val.startswith(':'):
                        val = val[1:].strip()
                    return val
            return None

        # Extraer los campos solicitados
        nro = get_value_by_label_keyword("NRO.")
        record['NRO'] = nro
        record['GRUPO_HOMOGENEO'] = get_value_by_label_keyword("GRUPO HOMOGÉNEO (GH)")
        record['POSICION_GH'] = get_value_by_label_keyword("POSICIÓN DENTRO DEL GH.")
        record['N_ESTABLECIMIENTOS_GH'] = get_value_by_label_keyword("DE ESTABLECIMIENTOS DEL GH")
        record['SELECCIONADO_SNED'] = get_value_by_label_keyword("SELECCIONADO EN SNED")
        
        # Extraer los años desde el propio texto del label "SELECCIONADO EN SNED"
        agnos = []
        label_sned = soup.find('label', string=lambda t: t and "SELECCIONADO EN SNED" in t)
        if label_sned:
            label_text = label_sned.get_text(separator=' ', strip=True)
            # Buscar el patrón de años, ej: 2020-2021
            match = re.search(r'(20\d{2})-(20\d{2})', label_text)
            if match:
                agnos = [match.group(1), match.group(2)]
        
        if not agnos:
            agnos = [None]
        
        # Solo guardamos si encontramos un número de establecimiento
        if record['NRO'] is not None:
            for a in agnos:
                rec_copy = record.copy()
                rec_copy['AGNO'] = a
                records.append(rec_copy)

            # Buscar la tabla 'tabla_certificados'
            # Hay dos tablas con este id, la primera es la de "RESULTADOS SNED", la segunda "RESULTADOS SNED POR PERÍODO"
            tables = soup.find_all('table', {'id': 'tabla_certificados'})
            
            if len(tables) > 0:
                # Tomamos la primera tabla (Resultados SNED)
                table1 = tables[0]
                
                # Extraemos cabeceras
                thead = table1.find('thead')
                headers = []
                if thead:
                    headers = [th.get_text(strip=True) for th in thead.find_all('th')]
                
                # Extraemos filas
                tbody = table1.find('tbody')
                if tbody:
                    for tr in tbody.find_all('tr'):
                        tds = tr.find_all('td')
                        row_vals = [td.get_text(strip=True) for td in tds]
                        
                        if len(headers) == len(row_vals):
                            for a in agnos:
                                row_dict = {'NRO_ESTABLECIMIENTO': nro, 'AGNO': a}
                                for h, v in zip(headers, row_vals):
                                    row_dict[h] = v
                                tables_data.append(row_dict)

    # Convertir a DataFrame de Pandas para tabular y exportar
    df_records = pd.DataFrame(records)
    df_tables = pd.DataFrame(tables_data)

    # Unir ambos DataFrames
    df_tables_merge = df_tables.rename(columns={'NRO_ESTABLECIMIENTO': 'NRO'})
    df_unified = pd.merge(df_records, df_tables_merge, on=['NRO', 'AGNO'], how='left')

    print("\n--- Resumen de Campos Extraídos ---")
    print(df_records.to_string(index=False))
    
    print("\n--- Resumen de la Tabla Extraída (Primeras filas) ---")
    print(df_tables.head().to_string(index=False))

    # Guardar a CSV
    output_records = "resultados_campos_sned.csv"
    output_tables = "resultados_tabla_sned.csv"
    output_unified = "resultados_unificados_sned.csv"
    
    df_records.to_csv(output_records, index=False, encoding="utf-8")
    df_tables.to_csv(output_tables, index=False, encoding="utf-8")
    df_unified.to_csv(output_unified, index=False, encoding="utf-8")
    
    print(f"\nSe han guardado los resultados en los archivos:")
    print(f"- {os.path.abspath(output_records)}")
    print(f"- {os.path.abspath(output_tables)}")
    print(f"- {os.path.abspath(output_unified)}")

if __name__ == "__main__":
    archivo_txt = "../Listado EE SNED DAEM TALCA.txt"
    if os.path.exists(archivo_txt):
        process_sned_file(archivo_txt)
    else:
        print(f"Error: No se encontró el archivo en la ruta {archivo_txt}")
