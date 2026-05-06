#!/usr/bin/env bash
# =============================================================
# import_sostenedores.sh
# Importa el Directorio Oficial de Sostenedores 2024 desde CSV
# a la tabla dim_sostenedor_oficial en PostgreSQL.
#
# Uso: bash import_sostenedores.sh
# Requiere: Docker container pirgefse_db corriendo
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../.env"

CSV_FILE="${SCRIPT_DIR}/../../BBDD/Directorio-Oficial-Sostenedores-2024/20241002_Directorio_Oficial_Sostenedores_2024_20240430_PUBL.csv"
CONTAINER="pirgefse_db"

echo "=============================================="
echo " PIRGEFSE — Importando dim_sostenedor_oficial"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# ---- 1. Verificar que el container esté corriendo ----
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "ERROR: El contenedor '${CONTAINER}' no está corriendo."
    echo "       Ejecuta: docker compose up -d"
    exit 1
fi

# ---- 2. Verificar que el CSV existe ----
if [ ! -f "${CSV_FILE}" ]; then
    echo "ERROR: No se encontró el archivo CSV:"
    echo "       ${CSV_FILE}"
    exit 1
fi

echo ""
echo ">>> [1/3] Creando tabla dim_sostenedor_oficial..."
docker exec -i "${CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
DROP TABLE IF EXISTS dim_sostenedor_oficial;

CREATE TABLE dim_sostenedor_oficial (
    -- Identificación
    agno            SMALLINT        NOT NULL,
    p_juridica      SMALLINT        NOT NULL,   -- 0=persona natural, 1=persona jurídica
    mrun            BIGINT,                     -- RUN persona natural (NULL si jurídica)
    rut_sost        BIGINT,                     -- RUT sostenedor (NULL si persona natural)
    nombre_sost     TEXT,

    -- Municipio / SLE
    id_municipal    SMALLINT        NOT NULL DEFAULT 0,
    id_sle          SMALLINT        NOT NULL DEFAULT 0,
    nom_sle         TEXT,

    -- Ubicación
    cod_reg_sost    VARCHAR(10),
    cod_pro_sost    VARCHAR(10),
    cod_com_sost    VARCHAR(10),
    nom_com_sost    TEXT,

    -- Conteo de RBD por dependencia
    num_rbd_corp_mun        SMALLINT NOT NULL DEFAULT 0,
    num_rbd_mun_daem        SMALLINT NOT NULL DEFAULT 0,
    num_rbd_part_subv       SMALLINT NOT NULL DEFAULT 0,
    num_rbd_part_pag        SMALLINT NOT NULL DEFAULT 0,
    num_rbd_adm_del         SMALLINT NOT NULL DEFAULT 0,
    num_rbd_serv_loc        SMALLINT NOT NULL DEFAULT 0,
    num_rbd                 SMALLINT NOT NULL DEFAULT 0,
    num_rbd_en_funcion_sin_mat SMALLINT NOT NULL DEFAULT 0,
    num_rbd_en_receso       SMALLINT NOT NULL DEFAULT 0,
    num_rbd_cerrado         SMALLINT NOT NULL DEFAULT 0,
    num_rbd_aut_sin_matricula SMALLINT NOT NULL DEFAULT 0,
    num_rbd_tot             SMALLINT NOT NULL DEFAULT 0,

    -- Matrícula por dependencia
    mat_corp_mun    INTEGER NOT NULL DEFAULT 0,
    mat_mun_daem    INTEGER NOT NULL DEFAULT 0,
    mat_part_subv   INTEGER NOT NULL DEFAULT 0,
    mat_part_pag    INTEGER NOT NULL DEFAULT 0,
    mat_adm_del     INTEGER NOT NULL DEFAULT 0,
    mat_serv_loc    INTEGER NOT NULL DEFAULT 0,
    mat_total       INTEGER NOT NULL DEFAULT 0,

    -- Conteo docentes
    num_c_doc       INTEGER NOT NULL DEFAULT 0,
    num_c_asis      INTEGER NOT NULL DEFAULT 0,

    -- RBD individuales (hasta 136)
    rbd_001 INTEGER, rbd_002 INTEGER, rbd_003 INTEGER, rbd_004 INTEGER,
    rbd_005 INTEGER, rbd_006 INTEGER, rbd_007 INTEGER, rbd_008 INTEGER,
    rbd_009 INTEGER, rbd_010 INTEGER, rbd_011 INTEGER, rbd_012 INTEGER,
    rbd_013 INTEGER, rbd_014 INTEGER, rbd_015 INTEGER, rbd_016 INTEGER,
    rbd_017 INTEGER, rbd_018 INTEGER, rbd_019 INTEGER, rbd_020 INTEGER,
    rbd_021 INTEGER, rbd_022 INTEGER, rbd_023 INTEGER, rbd_024 INTEGER,
    rbd_025 INTEGER, rbd_026 INTEGER, rbd_027 INTEGER, rbd_028 INTEGER,
    rbd_029 INTEGER, rbd_030 INTEGER, rbd_031 INTEGER, rbd_032 INTEGER,
    rbd_033 INTEGER, rbd_034 INTEGER, rbd_035 INTEGER, rbd_036 INTEGER,
    rbd_037 INTEGER, rbd_038 INTEGER, rbd_039 INTEGER, rbd_040 INTEGER,
    rbd_041 INTEGER, rbd_042 INTEGER, rbd_043 INTEGER, rbd_044 INTEGER,
    rbd_045 INTEGER, rbd_046 INTEGER, rbd_047 INTEGER, rbd_048 INTEGER,
    rbd_049 INTEGER, rbd_050 INTEGER, rbd_051 INTEGER, rbd_052 INTEGER,
    rbd_053 INTEGER, rbd_054 INTEGER, rbd_055 INTEGER, rbd_056 INTEGER,
    rbd_057 INTEGER, rbd_058 INTEGER, rbd_059 INTEGER, rbd_060 INTEGER,
    rbd_061 INTEGER, rbd_062 INTEGER, rbd_063 INTEGER, rbd_064 INTEGER,
    rbd_065 INTEGER, rbd_066 INTEGER, rbd_067 INTEGER, rbd_068 INTEGER,
    rbd_069 INTEGER, rbd_070 INTEGER, rbd_071 INTEGER, rbd_072 INTEGER,
    rbd_073 INTEGER, rbd_074 INTEGER, rbd_075 INTEGER, rbd_076 INTEGER,
    rbd_077 INTEGER, rbd_078 INTEGER, rbd_079 INTEGER, rbd_080 INTEGER,
    rbd_081 INTEGER, rbd_082 INTEGER, rbd_083 INTEGER, rbd_084 INTEGER,
    rbd_085 INTEGER, rbd_086 INTEGER, rbd_087 INTEGER, rbd_088 INTEGER,
    rbd_089 INTEGER, rbd_090 INTEGER, rbd_091 INTEGER, rbd_092 INTEGER,
    rbd_093 INTEGER, rbd_094 INTEGER, rbd_095 INTEGER, rbd_096 INTEGER,
    rbd_097 INTEGER, rbd_098 INTEGER, rbd_099 INTEGER, rbd_100 INTEGER,
    rbd_101 INTEGER, rbd_102 INTEGER, rbd_103 INTEGER, rbd_104 INTEGER,
    rbd_105 INTEGER, rbd_106 INTEGER, rbd_107 INTEGER, rbd_108 INTEGER,
    rbd_109 INTEGER, rbd_110 INTEGER, rbd_111 INTEGER, rbd_112 INTEGER,
    rbd_113 INTEGER, rbd_114 INTEGER, rbd_115 INTEGER, rbd_116 INTEGER,
    rbd_117 INTEGER, rbd_118 INTEGER, rbd_119 INTEGER, rbd_120 INTEGER,
    rbd_121 INTEGER, rbd_122 INTEGER, rbd_123 INTEGER, rbd_124 INTEGER,
    rbd_125 INTEGER, rbd_126 INTEGER, rbd_127 INTEGER, rbd_128 INTEGER,
    rbd_129 INTEGER, rbd_130 INTEGER, rbd_131 INTEGER, rbd_132 INTEGER,
    rbd_133 INTEGER, rbd_134 INTEGER, rbd_135 INTEGER, rbd_136 INTEGER
);

\echo '✅ Tabla dim_sostenedor_oficial creada.'
SQL

# ---- 3. Copiar CSV al container ----
echo ""
echo ">>> [2/3] Copiando CSV al container..."
docker cp "${CSV_FILE}" "${CONTAINER}:/tmp/sostenedores.csv"

# ---- 4. Cargar usando tabla staging + INSERT con casting ----
echo ""
echo ">>> [3/3] Cargando datos (staging → tabla final)..."
docker exec -i "${CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'

-- =========================================================
-- PASO A: Tabla staging con todas las columnas como TEXT
-- Esto permite que COPY acepte espacios y BOM sin errores.
-- =========================================================
DROP TABLE IF EXISTS _stg_sostenedores;

CREATE TEMP TABLE _stg_sostenedores (
    agno TEXT, p_juridica TEXT, mrun TEXT, rut_sost TEXT, nombre_sost TEXT,
    id_municipal TEXT, id_sle TEXT, nom_sle TEXT,
    cod_reg_sost TEXT, cod_pro_sost TEXT, cod_com_sost TEXT, nom_com_sost TEXT,
    num_rbd_corp_mun TEXT, num_rbd_mun_daem TEXT, num_rbd_part_subv TEXT,
    num_rbd_part_pag TEXT, num_rbd_adm_del TEXT, num_rbd_serv_loc TEXT,
    num_rbd TEXT, num_rbd_en_funcion_sin_mat TEXT, num_rbd_en_receso TEXT,
    num_rbd_cerrado TEXT, num_rbd_aut_sin_matricula TEXT, num_rbd_tot TEXT,
    mat_corp_mun TEXT, mat_mun_daem TEXT, mat_part_subv TEXT, mat_part_pag TEXT,
    mat_adm_del TEXT, mat_serv_loc TEXT, mat_total TEXT,
    num_c_doc TEXT, num_c_asis TEXT,
    rbd_001 TEXT, rbd_002 TEXT, rbd_003 TEXT, rbd_004 TEXT,
    rbd_005 TEXT, rbd_006 TEXT, rbd_007 TEXT, rbd_008 TEXT,
    rbd_009 TEXT, rbd_010 TEXT, rbd_011 TEXT, rbd_012 TEXT,
    rbd_013 TEXT, rbd_014 TEXT, rbd_015 TEXT, rbd_016 TEXT,
    rbd_017 TEXT, rbd_018 TEXT, rbd_019 TEXT, rbd_020 TEXT,
    rbd_021 TEXT, rbd_022 TEXT, rbd_023 TEXT, rbd_024 TEXT,
    rbd_025 TEXT, rbd_026 TEXT, rbd_027 TEXT, rbd_028 TEXT,
    rbd_029 TEXT, rbd_030 TEXT, rbd_031 TEXT, rbd_032 TEXT,
    rbd_033 TEXT, rbd_034 TEXT, rbd_035 TEXT, rbd_036 TEXT,
    rbd_037 TEXT, rbd_038 TEXT, rbd_039 TEXT, rbd_040 TEXT,
    rbd_041 TEXT, rbd_042 TEXT, rbd_043 TEXT, rbd_044 TEXT,
    rbd_045 TEXT, rbd_046 TEXT, rbd_047 TEXT, rbd_048 TEXT,
    rbd_049 TEXT, rbd_050 TEXT, rbd_051 TEXT, rbd_052 TEXT,
    rbd_053 TEXT, rbd_054 TEXT, rbd_055 TEXT, rbd_056 TEXT,
    rbd_057 TEXT, rbd_058 TEXT, rbd_059 TEXT, rbd_060 TEXT,
    rbd_061 TEXT, rbd_062 TEXT, rbd_063 TEXT, rbd_064 TEXT,
    rbd_065 TEXT, rbd_066 TEXT, rbd_067 TEXT, rbd_068 TEXT,
    rbd_069 TEXT, rbd_070 TEXT, rbd_071 TEXT, rbd_072 TEXT,
    rbd_073 TEXT, rbd_074 TEXT, rbd_075 TEXT, rbd_076 TEXT,
    rbd_077 TEXT, rbd_078 TEXT, rbd_079 TEXT, rbd_080 TEXT,
    rbd_081 TEXT, rbd_082 TEXT, rbd_083 TEXT, rbd_084 TEXT,
    rbd_085 TEXT, rbd_086 TEXT, rbd_087 TEXT, rbd_088 TEXT,
    rbd_089 TEXT, rbd_090 TEXT, rbd_091 TEXT, rbd_092 TEXT,
    rbd_093 TEXT, rbd_094 TEXT, rbd_095 TEXT, rbd_096 TEXT,
    rbd_097 TEXT, rbd_098 TEXT, rbd_099 TEXT, rbd_100 TEXT,
    rbd_101 TEXT, rbd_102 TEXT, rbd_103 TEXT, rbd_104 TEXT,
    rbd_105 TEXT, rbd_106 TEXT, rbd_107 TEXT, rbd_108 TEXT,
    rbd_109 TEXT, rbd_110 TEXT, rbd_111 TEXT, rbd_112 TEXT,
    rbd_113 TEXT, rbd_114 TEXT, rbd_115 TEXT, rbd_116 TEXT,
    rbd_117 TEXT, rbd_118 TEXT, rbd_119 TEXT, rbd_120 TEXT,
    rbd_121 TEXT, rbd_122 TEXT, rbd_123 TEXT, rbd_124 TEXT,
    rbd_125 TEXT, rbd_126 TEXT, rbd_127 TEXT, rbd_128 TEXT,
    rbd_129 TEXT, rbd_130 TEXT, rbd_131 TEXT, rbd_132 TEXT,
    rbd_133 TEXT, rbd_134 TEXT, rbd_135 TEXT, rbd_136 TEXT
);

-- =========================================================
-- PASO B: COPY al staging (acepta cualquier valor como texto)
-- NULL '' cubre cadenas vacías; TRIM en el INSERT cubre espacios.
-- =========================================================
COPY _stg_sostenedores FROM '/tmp/sostenedores.csv'
WITH (FORMAT CSV, HEADER TRUE, DELIMITER ';', NULL '', ENCODING 'UTF8');

\echo 'Staging cargado. Filas en staging:'
SELECT COUNT(*) FROM _stg_sostenedores;

-- =========================================================
-- PASO C: INSERT con TRIM + NULLIF para convertir a tipos
-- =========================================================
INSERT INTO dim_sostenedor_oficial
SELECT
    TRIM(agno)::SMALLINT,
    TRIM(p_juridica)::SMALLINT,
    NULLIF(TRIM(mrun),  '')::BIGINT,
    NULLIF(TRIM(rut_sost), '')::BIGINT,
    NULLIF(TRIM(nombre_sost), ''),
    TRIM(id_municipal)::SMALLINT,
    TRIM(id_sle)::SMALLINT,
    NULLIF(TRIM(nom_sle), ''),
    NULLIF(TRIM(cod_reg_sost), ''),
    NULLIF(TRIM(cod_pro_sost), ''),
    NULLIF(TRIM(cod_com_sost), ''),
    NULLIF(TRIM(nom_com_sost), ''),
    TRIM(num_rbd_corp_mun)::SMALLINT,
    TRIM(num_rbd_mun_daem)::SMALLINT,
    TRIM(num_rbd_part_subv)::SMALLINT,
    TRIM(num_rbd_part_pag)::SMALLINT,
    TRIM(num_rbd_adm_del)::SMALLINT,
    TRIM(num_rbd_serv_loc)::SMALLINT,
    TRIM(num_rbd)::SMALLINT,
    TRIM(num_rbd_en_funcion_sin_mat)::SMALLINT,
    TRIM(num_rbd_en_receso)::SMALLINT,
    TRIM(num_rbd_cerrado)::SMALLINT,
    TRIM(num_rbd_aut_sin_matricula)::SMALLINT,
    TRIM(num_rbd_tot)::SMALLINT,
    TRIM(mat_corp_mun)::INTEGER,
    TRIM(mat_mun_daem)::INTEGER,
    TRIM(mat_part_subv)::INTEGER,
    TRIM(mat_part_pag)::INTEGER,
    TRIM(mat_adm_del)::INTEGER,
    TRIM(mat_serv_loc)::INTEGER,
    TRIM(mat_total)::INTEGER,
    TRIM(num_c_doc)::INTEGER,
    TRIM(num_c_asis)::INTEGER,
    NULLIF(TRIM(rbd_001),'')::INTEGER, NULLIF(TRIM(rbd_002),'')::INTEGER,
    NULLIF(TRIM(rbd_003),'')::INTEGER, NULLIF(TRIM(rbd_004),'')::INTEGER,
    NULLIF(TRIM(rbd_005),'')::INTEGER, NULLIF(TRIM(rbd_006),'')::INTEGER,
    NULLIF(TRIM(rbd_007),'')::INTEGER, NULLIF(TRIM(rbd_008),'')::INTEGER,
    NULLIF(TRIM(rbd_009),'')::INTEGER, NULLIF(TRIM(rbd_010),'')::INTEGER,
    NULLIF(TRIM(rbd_011),'')::INTEGER, NULLIF(TRIM(rbd_012),'')::INTEGER,
    NULLIF(TRIM(rbd_013),'')::INTEGER, NULLIF(TRIM(rbd_014),'')::INTEGER,
    NULLIF(TRIM(rbd_015),'')::INTEGER, NULLIF(TRIM(rbd_016),'')::INTEGER,
    NULLIF(TRIM(rbd_017),'')::INTEGER, NULLIF(TRIM(rbd_018),'')::INTEGER,
    NULLIF(TRIM(rbd_019),'')::INTEGER, NULLIF(TRIM(rbd_020),'')::INTEGER,
    NULLIF(TRIM(rbd_021),'')::INTEGER, NULLIF(TRIM(rbd_022),'')::INTEGER,
    NULLIF(TRIM(rbd_023),'')::INTEGER, NULLIF(TRIM(rbd_024),'')::INTEGER,
    NULLIF(TRIM(rbd_025),'')::INTEGER, NULLIF(TRIM(rbd_026),'')::INTEGER,
    NULLIF(TRIM(rbd_027),'')::INTEGER, NULLIF(TRIM(rbd_028),'')::INTEGER,
    NULLIF(TRIM(rbd_029),'')::INTEGER, NULLIF(TRIM(rbd_030),'')::INTEGER,
    NULLIF(TRIM(rbd_031),'')::INTEGER, NULLIF(TRIM(rbd_032),'')::INTEGER,
    NULLIF(TRIM(rbd_033),'')::INTEGER, NULLIF(TRIM(rbd_034),'')::INTEGER,
    NULLIF(TRIM(rbd_035),'')::INTEGER, NULLIF(TRIM(rbd_036),'')::INTEGER,
    NULLIF(TRIM(rbd_037),'')::INTEGER, NULLIF(TRIM(rbd_038),'')::INTEGER,
    NULLIF(TRIM(rbd_039),'')::INTEGER, NULLIF(TRIM(rbd_040),'')::INTEGER,
    NULLIF(TRIM(rbd_041),'')::INTEGER, NULLIF(TRIM(rbd_042),'')::INTEGER,
    NULLIF(TRIM(rbd_043),'')::INTEGER, NULLIF(TRIM(rbd_044),'')::INTEGER,
    NULLIF(TRIM(rbd_045),'')::INTEGER, NULLIF(TRIM(rbd_046),'')::INTEGER,
    NULLIF(TRIM(rbd_047),'')::INTEGER, NULLIF(TRIM(rbd_048),'')::INTEGER,
    NULLIF(TRIM(rbd_049),'')::INTEGER, NULLIF(TRIM(rbd_050),'')::INTEGER,
    NULLIF(TRIM(rbd_051),'')::INTEGER, NULLIF(TRIM(rbd_052),'')::INTEGER,
    NULLIF(TRIM(rbd_053),'')::INTEGER, NULLIF(TRIM(rbd_054),'')::INTEGER,
    NULLIF(TRIM(rbd_055),'')::INTEGER, NULLIF(TRIM(rbd_056),'')::INTEGER,
    NULLIF(TRIM(rbd_057),'')::INTEGER, NULLIF(TRIM(rbd_058),'')::INTEGER,
    NULLIF(TRIM(rbd_059),'')::INTEGER, NULLIF(TRIM(rbd_060),'')::INTEGER,
    NULLIF(TRIM(rbd_061),'')::INTEGER, NULLIF(TRIM(rbd_062),'')::INTEGER,
    NULLIF(TRIM(rbd_063),'')::INTEGER, NULLIF(TRIM(rbd_064),'')::INTEGER,
    NULLIF(TRIM(rbd_065),'')::INTEGER, NULLIF(TRIM(rbd_066),'')::INTEGER,
    NULLIF(TRIM(rbd_067),'')::INTEGER, NULLIF(TRIM(rbd_068),'')::INTEGER,
    NULLIF(TRIM(rbd_069),'')::INTEGER, NULLIF(TRIM(rbd_070),'')::INTEGER,
    NULLIF(TRIM(rbd_071),'')::INTEGER, NULLIF(TRIM(rbd_072),'')::INTEGER,
    NULLIF(TRIM(rbd_073),'')::INTEGER, NULLIF(TRIM(rbd_074),'')::INTEGER,
    NULLIF(TRIM(rbd_075),'')::INTEGER, NULLIF(TRIM(rbd_076),'')::INTEGER,
    NULLIF(TRIM(rbd_077),'')::INTEGER, NULLIF(TRIM(rbd_078),'')::INTEGER,
    NULLIF(TRIM(rbd_079),'')::INTEGER, NULLIF(TRIM(rbd_080),'')::INTEGER,
    NULLIF(TRIM(rbd_081),'')::INTEGER, NULLIF(TRIM(rbd_082),'')::INTEGER,
    NULLIF(TRIM(rbd_083),'')::INTEGER, NULLIF(TRIM(rbd_084),'')::INTEGER,
    NULLIF(TRIM(rbd_085),'')::INTEGER, NULLIF(TRIM(rbd_086),'')::INTEGER,
    NULLIF(TRIM(rbd_087),'')::INTEGER, NULLIF(TRIM(rbd_088),'')::INTEGER,
    NULLIF(TRIM(rbd_089),'')::INTEGER, NULLIF(TRIM(rbd_090),'')::INTEGER,
    NULLIF(TRIM(rbd_091),'')::INTEGER, NULLIF(TRIM(rbd_092),'')::INTEGER,
    NULLIF(TRIM(rbd_093),'')::INTEGER, NULLIF(TRIM(rbd_094),'')::INTEGER,
    NULLIF(TRIM(rbd_095),'')::INTEGER, NULLIF(TRIM(rbd_096),'')::INTEGER,
    NULLIF(TRIM(rbd_097),'')::INTEGER, NULLIF(TRIM(rbd_098),'')::INTEGER,
    NULLIF(TRIM(rbd_099),'')::INTEGER, NULLIF(TRIM(rbd_100),'')::INTEGER,
    NULLIF(TRIM(rbd_101),'')::INTEGER, NULLIF(TRIM(rbd_102),'')::INTEGER,
    NULLIF(TRIM(rbd_103),'')::INTEGER, NULLIF(TRIM(rbd_104),'')::INTEGER,
    NULLIF(TRIM(rbd_105),'')::INTEGER, NULLIF(TRIM(rbd_106),'')::INTEGER,
    NULLIF(TRIM(rbd_107),'')::INTEGER, NULLIF(TRIM(rbd_108),'')::INTEGER,
    NULLIF(TRIM(rbd_109),'')::INTEGER, NULLIF(TRIM(rbd_110),'')::INTEGER,
    NULLIF(TRIM(rbd_111),'')::INTEGER, NULLIF(TRIM(rbd_112),'')::INTEGER,
    NULLIF(TRIM(rbd_113),'')::INTEGER, NULLIF(TRIM(rbd_114),'')::INTEGER,
    NULLIF(TRIM(rbd_115),'')::INTEGER, NULLIF(TRIM(rbd_116),'')::INTEGER,
    NULLIF(TRIM(rbd_117),'')::INTEGER, NULLIF(TRIM(rbd_118),'')::INTEGER,
    NULLIF(TRIM(rbd_119),'')::INTEGER, NULLIF(TRIM(rbd_120),'')::INTEGER,
    NULLIF(TRIM(rbd_121),'')::INTEGER, NULLIF(TRIM(rbd_122),'')::INTEGER,
    NULLIF(TRIM(rbd_123),'')::INTEGER, NULLIF(TRIM(rbd_124),'')::INTEGER,
    NULLIF(TRIM(rbd_125),'')::INTEGER, NULLIF(TRIM(rbd_126),'')::INTEGER,
    NULLIF(TRIM(rbd_127),'')::INTEGER, NULLIF(TRIM(rbd_128),'')::INTEGER,
    NULLIF(TRIM(rbd_129),'')::INTEGER, NULLIF(TRIM(rbd_130),'')::INTEGER,
    NULLIF(TRIM(rbd_131),'')::INTEGER, NULLIF(TRIM(rbd_132),'')::INTEGER,
    NULLIF(TRIM(rbd_133),'')::INTEGER, NULLIF(TRIM(rbd_134),'')::INTEGER,
    NULLIF(TRIM(rbd_135),'')::INTEGER, NULLIF(TRIM(rbd_136),'')::INTEGER
FROM _stg_sostenedores;

DROP TABLE _stg_sostenedores;

\echo ''
\echo '=== Verificación ==='
SELECT COUNT(*) AS total_filas FROM dim_sostenedor_oficial;

SELECT
    CASE p_juridica
        WHEN 0 THEN 'Persona Natural'
        WHEN 1 THEN 'Persona Jurídica'
        ELSE 'Otro'
    END AS tipo,
    COUNT(*) AS cantidad
FROM dim_sostenedor_oficial
GROUP BY p_juridica
ORDER BY p_juridica;

SELECT
    SUM(mat_total) AS matricula_total,
    COUNT(DISTINCT rut_sost) AS sostenedores_juridicos,
    COUNT(DISTINCT mrun) AS sostenedores_naturales
FROM dim_sostenedor_oficial;

\echo ''
\echo '✅ Importación de dim_sostenedor_oficial completada.'
SQL

echo ""
echo "=============================================="
echo " ✅ dim_sostenedor_oficial cargada exitosamente"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
