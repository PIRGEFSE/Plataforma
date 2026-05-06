-- =============================================================
-- PIRGEFSE — Schema PostgreSQL
-- Sin Foreign Key constraints para máxima velocidad de importación
-- =============================================================

-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================
-- TABLAS DE DIMENSIÓN (catálogos)
-- =============================================================

CREATE TABLE IF NOT EXISTS dim_region (
    codigo_region   NUMERIC,
    nombre_region   TEXT,
    PRIMARY KEY (codigo_region)
);

CREATE TABLE IF NOT EXISTS dim_dependencia (
    codigo_dependencia  TEXT,
    descripcion         TEXT,
    PRIMARY KEY (codigo_dependencia)
);

CREATE TABLE IF NOT EXISTS dim_subvencion (
    subvencion_alias    TEXT,
    descripcion         TEXT,
    PRIMARY KEY (subvencion_alias)
);

CREATE TABLE IF NOT EXISTS dim_cuenta (
    cuenta_alias        TEXT,
    desc_cuenta         TEXT,
    cuenta_alias_padre  TEXT,
    desc_cuenta_padre   TEXT,
    PRIMARY KEY (cuenta_alias)
);

CREATE TABLE IF NOT EXISTS dim_tipo_documento (
    tipo_docs_alias TEXT,
    desc_libro      TEXT,
    PRIMARY KEY (tipo_docs_alias)
);

CREATE TABLE IF NOT EXISTS dim_sostenedor (
    sost_id     BIGINT,
    rut_sost    TEXT,
    nombre_sost TEXT,
    PRIMARY KEY (sost_id)
);

CREATE TABLE IF NOT EXISTS dim_establecimiento (
    rbd             INTEGER,
    nombre_rbd      TEXT,
    region_rbd      NUMERIC,
    dependencia_rbd TEXT,
    sost_id         BIGINT,
    PRIMARY KEY (rbd)
);

-- =============================================================
-- TABLA DE HECHOS: documentos
-- Fuente: Documentos.txt (~5.3 GB)
-- Separador: ~
-- =============================================================

CREATE TABLE IF NOT EXISTS documentos (
    id                    BIGSERIAL PRIMARY KEY,
    periodo               INTEGER,
    sost_id               BIGINT,
    rut_sost              TEXT,
    nombre_sost           TEXT,
    rbd                   INTEGER,
    nombre_rbd            TEXT,
    region_rbd            NUMERIC,
    dependencia_rbd       TEXT,
    subvencion_alias      TEXT,
    desc_libro            TEXT,
    tipo_docs_alias       TEXT,
    cuenta_alias          TEXT,
    desc_cuenta           TEXT,
    desc_cuenta_padre     TEXT,
    cuenta_alias_padre    TEXT,
    numero_documento      NUMERIC,
    nombre_documento      TEXT,
    detalle_documento     TEXT,
    fecha_documento       DATE,
    monto_total           NUMERIC(18,2),
    monto_declarado       NUMERIC(18,2),
    fecha_pago_documento  DATE,
    rut_documento         TEXT
);

-- =============================================================
-- TABLA DE HECHOS: estado_resultado
-- Fuente: Estado_resultado.txt (~3 GB)
-- Separador: ~
-- =============================================================

CREATE TABLE IF NOT EXISTS estado_resultado (
    id                  BIGSERIAL PRIMARY KEY,
    desc_tipo_cuenta    TEXT,
    cuenta_alias        TEXT,
    desc_cuenta         TEXT,
    cuenta_alias_padre  TEXT,
    desc_cuenta_padre   TEXT,
    monto_declarado     NUMERIC(18,2),
    periodo             INTEGER,
    subvencion_alias    TEXT,
    sost_id             BIGINT,
    rbd                 INTEGER,
    region_rbd          NUMERIC,
    dependencia_rbd     TEXT,
    desc_estado         TEXT
);

-- =============================================================
-- TABLA DE HECHOS: remuneraciones
-- Fuente: Remuneraciones_2020..2024.txt (~35 GB total)
-- Separador: ~
-- Particionada por anio para mejor rendimiento
-- =============================================================

CREATE TABLE IF NOT EXISTS remuneraciones (
    id              BIGSERIAL,
    rut             TEXT,
    periodo         INTEGER,
    sostenedor      BIGINT,
    rbd             INTEGER,
    dgv             TEXT,
    tip             TEXT,
    hc              NUMERIC(10,2),
    fei             DATE,
    fun             TEXT,
    mes             INTEGER,
    anio            INTEGER,
    habernorend     NUMERIC(18,2),
    totalhaber      NUMERIC(18,2),
    pre             NUMERIC(18,2),
    aaf             NUMERIC(18,2),
    sal             NUMERIC(18,2),
    asa             NUMERIC(18,2),
    imp             NUMERIC(18,2),
    cca             NUMERIC(18,2),
    dif             NUMERIC(18,2),
    dis             NUMERIC(18,2),
    rej             NUMERIC(18,2),
    sce             NUMERIC(18,2),
    ant             NUMERIC(18,2),
    odv             NUMERIC(18,2),
    totaldescuento  NUMERIC(18,2),
    liquido         NUMERIC(18,2),
    subvencion_alias TEXT,
    cuenta_alias    TEXT,
    monto           NUMERIC(18,2),
    PRIMARY KEY (id, anio)
) PARTITION BY LIST (anio);

-- Particiones por año
CREATE TABLE IF NOT EXISTS remuneraciones_2020 PARTITION OF remuneraciones FOR VALUES IN (2020);
CREATE TABLE IF NOT EXISTS remuneraciones_2021 PARTITION OF remuneraciones FOR VALUES IN (2021);
CREATE TABLE IF NOT EXISTS remuneraciones_2022 PARTITION OF remuneraciones FOR VALUES IN (2022);
CREATE TABLE IF NOT EXISTS remuneraciones_2023 PARTITION OF remuneraciones FOR VALUES IN (2023);
CREATE TABLE IF NOT EXISTS remuneraciones_2024 PARTITION OF remuneraciones FOR VALUES IN (2024);

-- =============================================================
-- ÍNDICES (creados al final, más eficiente con datos cargados)
-- =============================================================

-- documentos
CREATE INDEX IF NOT EXISTS idx_doc_periodo        ON documentos(periodo);
CREATE INDEX IF NOT EXISTS idx_doc_rbd            ON documentos(rbd);
CREATE INDEX IF NOT EXISTS idx_doc_sost_id        ON documentos(sost_id);
CREATE INDEX IF NOT EXISTS idx_doc_subvencion     ON documentos(subvencion_alias);
CREATE INDEX IF NOT EXISTS idx_doc_cuenta         ON documentos(cuenta_alias);
CREATE INDEX IF NOT EXISTS idx_doc_fecha          ON documentos(fecha_documento);

-- estado_resultado
CREATE INDEX IF NOT EXISTS idx_er_periodo         ON estado_resultado(periodo);
CREATE INDEX IF NOT EXISTS idx_er_rbd             ON estado_resultado(rbd);
CREATE INDEX IF NOT EXISTS idx_er_sost_id         ON estado_resultado(sost_id);
CREATE INDEX IF NOT EXISTS idx_er_subvencion      ON estado_resultado(subvencion_alias);
CREATE INDEX IF NOT EXISTS idx_er_cuenta          ON estado_resultado(cuenta_alias);

-- remuneraciones (aplicados a cada partición automáticamente)
CREATE INDEX IF NOT EXISTS idx_rem_rut            ON remuneraciones(rut);
CREATE INDEX IF NOT EXISTS idx_rem_rbd            ON remuneraciones(rbd);
CREATE INDEX IF NOT EXISTS idx_rem_sostenedor     ON remuneraciones(sostenedor);
CREATE INDEX IF NOT EXISTS idx_rem_mes_anio       ON remuneraciones(anio, mes);
CREATE INDEX IF NOT EXISTS idx_rem_subvencion     ON remuneraciones(subvencion_alias);
CREATE INDEX IF NOT EXISTS idx_rem_cuenta         ON remuneraciones(cuenta_alias);
