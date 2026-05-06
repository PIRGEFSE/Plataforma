# PIRGEFSE — Base de Datos PostgreSQL en Docker

## Requisitos
- [Docker](https://docs.docker.com/get-docker/) y [Docker Compose](https://docs.docker.com/compose/)

## Estructura
```
docker/
├── docker-compose.yml          # Configuración del contenedor
├── .env                        # Variables de entorno (credenciales)
├── init/
│   └── 01_schema.sql           # DDL: tablas, particiones e índices
└── scripts/
    ├── import_all.sh           # Orquestador principal
    ├── import_documentos.sh    # Importa Documentos.txt
    ├── import_estado.sh        # Importa Estado_resultado.txt
    └── import_remuneraciones.sh # Importa Remuneraciones_YYYY.txt
```

## 1. Levantar el contenedor

```bash
cd /home/andres/Documentos/PIRGEFSE/Plataforma/docker
docker compose up -d
docker compose ps   # verificar que está running
```

## 2. Importar datos

### Opción A — Importar todo (puede tardar varias horas por el volumen)
```bash
bash scripts/import_all.sh
```

### Opción B — Importar solo Documentos y Estado (los más rápidos)
```bash
bash scripts/import_all.sh --skip-remuneraciones
```

### Opción C — Importar un año de Remuneraciones como piloto
```bash
bash scripts/import_remuneraciones.sh 2020
```

### Opción D — Importar un año específico desde el orquestador
```bash
bash scripts/import_all.sh --skip-remuneraciones  # primero docs y estado
bash scripts/import_all.sh --only-year 2022        # luego el año deseado
```

## 3. Conectarse a la base de datos

```bash
# CLI dentro del contenedor
docker compose exec db psql -U pirgefse -d pirgefse_db

# Con psql local (si está instalado)
psql -h localhost -p 5432 -U pirgefse -d pirgefse_db
```

Credenciales (definidas en `.env`):
| Parámetro | Valor |
|---|---|
| Host | `localhost` |
| Puerto | `5432` |
| Base de datos | `pirgefse_db` |
| Usuario | `pirgefse` |
| Contraseña | `pirgefse2024` |

## 4. Detener / Eliminar el contenedor

```bash
docker compose down          # Detiene (datos persistentes se conservan)
docker compose down -v       # ⚠️ Detiene Y ELIMINA los volúmenes de datos
```

## 5. Modelo de Datos

### Tablas de Dimensión
| Tabla | Descripción |
|---|---|
| `dim_sostenedor` | Sostenedores educacionales |
| `dim_establecimiento` | Establecimientos / colegios (RBD) |
| `dim_cuenta` | Plan de cuentas contables |
| `dim_subvencion` | Tipos de subvención |
| `dim_tipo_documento` | Tipos de documentos |
| `dim_region` | Regiones |
| `dim_dependencia` | Tipos de dependencia |

### Tablas de Hechos
| Tabla | Fuente | Tamaño aprox. |
|---|---|---|
| `documentos` | `Documentos.txt` | 5.3 GB |
| `estado_resultado` | `Estado_resultado.txt` | 3.0 GB |
| `remuneraciones` | `Remuneraciones_2020..2024.txt` | ~35 GB |

> **Nota:** `remuneraciones` está particionada por `anio` (LIST partitioning).
> Cada partición (`remuneraciones_2020`, ..., `remuneraciones_2024`) se puede
> consultar directamente o a través de la tabla padre.

## 6. Consultas de ejemplo

```sql
-- Gasto total por establecimiento en 2024
SELECT rbd, nombre_rbd, SUM(monto_total) AS gasto_total
FROM documentos
WHERE periodo = 2024
GROUP BY rbd, nombre_rbd
ORDER BY gasto_total DESC
LIMIT 20;

-- Total declarado por subvención y año
SELECT periodo, subvencion_alias, SUM(monto_declarado) AS total
FROM estado_resultado
GROUP BY periodo, subvencion_alias
ORDER BY periodo, total DESC;

-- Total remuneraciones por sostenedor en 2022
SELECT sostenedor, SUM(totalhaber) AS total_haberes
FROM remuneraciones_2022
GROUP BY sostenedor
ORDER BY total_haberes DESC
LIMIT 10;
```

## 7. Estimación de tiempos de importación

| Archivo | Tamaño | Tiempo estimado* |
|---|---|---|
| `Documentos.txt` | 5.3 GB | 20–40 min |
| `Estado_resultado.txt` | 3.0 GB | 15–25 min |
| `Remuneraciones_YYYY.txt` (c/u) | 6–7.8 GB | 40–90 min |

*Depende del hardware (CPU, disco, RAM disponible).
