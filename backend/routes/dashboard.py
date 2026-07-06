from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional

from database import get_db
from auth import get_current_user, require_admin
from models import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# ── KPIs Generales ─────────────────────────────────────────────────────────
# Usa mv_resumen_anual y mv_rem_anual (respuesta <100ms)

@router.get("/resumen")
async def resumen(
    periodo: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if periodo:
        doc_q = await db.execute(text("""
            SELECT
                COALESCE(monto_total_documentos, 0) AS monto_total_documentos,
                COALESCE(n_documentos, 0)           AS n_documentos,
                COALESCE(n_establecimientos, 0)     AS n_establecimientos,
                COALESCE(n_sostenedores, 0)         AS n_sostenedores
            FROM mv_resumen_anual
            WHERE periodo = :p
        """), {"p": periodo})
        doc = doc_q.mappings().one_or_none() or {
            "monto_total_documentos": 0, "n_documentos": 0,
            "n_establecimientos": 0, "n_sostenedores": 0
        }

        rem_q = await db.execute(text("""
            SELECT
                COALESCE(liquido_total, 0)  AS total_liquido,
                COALESCE(n_remuneraciones, 0) AS n_remuneraciones,
                COALESCE(n_funcionarios, 0) AS n_funcionarios
            FROM mv_rem_anual
            WHERE anio = :p
        """), {"p": periodo})
        rem = rem_q.mappings().one_or_none() or {
            "total_liquido": 0, "n_remuneraciones": 0, "n_funcionarios": 0
        }
    else:
        doc_q = await db.execute(text("""
            SELECT
                COALESCE(monto_total_documentos, 0) AS monto_total_documentos,
                COALESCE(n_documentos, 0)           AS n_documentos,
                COALESCE(n_establecimientos, 0)     AS n_establecimientos,
                COALESCE(n_sostenedores, 0)         AS n_sostenedores
            FROM mv_resumen_global
        """))
        doc = doc_q.mappings().one_or_none() or {
            "monto_total_documentos": 0, "n_documentos": 0,
            "n_establecimientos": 0, "n_sostenedores": 0
        }

        rem_q = await db.execute(text("""
            SELECT
                COALESCE(liquido_total, 0)    AS total_liquido,
                COALESCE(n_remuneraciones, 0) AS n_remuneraciones,
                COALESCE(n_funcionarios, 0)   AS n_funcionarios
            FROM mv_rem_global
        """))
        rem = rem_q.mappings().one_or_none() or {
            "total_liquido": 0, "n_remuneraciones": 0, "n_funcionarios": 0
        }

    return {
        "monto_total_documentos": float(doc["monto_total_documentos"]),
        "n_documentos": doc["n_documentos"],
        "n_establecimientos": doc["n_establecimientos"],
        "n_sostenedores": doc["n_sostenedores"],
        "total_liquido_remuneraciones": float(rem["total_liquido"]),
        "n_remuneraciones": rem["n_remuneraciones"],
        "n_funcionarios": rem["n_funcionarios"],
    }

# ── Tendencia financiera ────────────────────────────────────────────────────

@router.get("/tendencia")
async def tendencia(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    docs_q = await db.execute(text("""
        SELECT periodo AS anio,
               monto_total_documentos AS monto_documentos,
               n_documentos
        FROM mv_resumen_anual
        ORDER BY periodo
    """))
    docs = [dict(r) for r in docs_q.mappings()]

    rem_q = await db.execute(text("""
        SELECT anio, liquido_total, haber_total
        FROM mv_rem_anual
        ORDER BY anio
    """))
    rem = [dict(r) for r in rem_q.mappings()]

    return {"documentos": docs, "remuneraciones": rem}

# ── Tendencia mensual (drill-down) ──────────────────────────────────────────

@router.get("/tendencia-mensual")
async def tendencia_mensual(
    periodo: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if periodo:
        q = await db.execute(text("""
            SELECT periodo, mes, monto_total, n_documentos
            FROM mv_tendencia_mensual
            WHERE periodo = :p
            ORDER BY mes
        """), {"p": periodo})
    else:
        q = await db.execute(text("""
            SELECT periodo, mes, monto_total, n_documentos
            FROM mv_tendencia_mensual
            ORDER BY periodo, mes
        """))
    return [dict(r) for r in q.mappings()]

# ── Distribución por Subvención ─────────────────────────────────────────────

@router.get("/subvencion")
async def subvencion(
    periodo: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if periodo:
        q = await db.execute(text("""
            SELECT subvencion_alias, monto_total, n_documentos
            FROM mv_subvencion_anual
            WHERE periodo = :p
            ORDER BY monto_total DESC
            LIMIT 20
        """), {"p": periodo})
    else:
        q = await db.execute(text("""
            SELECT subvencion_alias, monto_total, n_documentos
            FROM mv_subvencion_global
            ORDER BY monto_total DESC
            LIMIT 20
        """))
    return [dict(r) for r in q.mappings()]

# ── Distribución por Subvención — Sostenedor específico ─────────────────────

@router.get("/subvencion-sostenedor")
async def subvencion_sostenedor(
    sost_id: int = Query(...),
    periodo: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Distribución de subvenciones filtrada por sostenedor (usa tabla documentos)."""
    if periodo:
        q = await db.execute(text("""
            SELECT subvencion_alias, SUM(monto_declarado) AS monto_total, COUNT(id) AS n_documentos
            FROM documentos
            WHERE sost_id = :sid
              AND subvencion_alias IS NOT NULL AND subvencion_alias <> ''
              AND periodo = :p
            GROUP BY subvencion_alias
            ORDER BY monto_total DESC
            LIMIT 20
        """), {"sid": sost_id, "p": periodo})
    else:
        q = await db.execute(text("""
            SELECT subvencion_alias, SUM(monto_declarado) AS monto_total, COUNT(id) AS n_documentos
            FROM documentos
            WHERE sost_id = :sid
              AND subvencion_alias IS NOT NULL AND subvencion_alias <> ''
            GROUP BY subvencion_alias
            ORDER BY monto_total DESC
            LIMIT 20
        """), {"sid": sost_id})
    return [dict(r) for r in q.mappings()]

# ── Top Sostenedores ────────────────────────────────────────────────────────

@router.get("/sostenedores")
async def top_sostenedores(
    periodo: Optional[int] = None,
    limit: int = Query(default=10, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if periodo:
        q = await db.execute(text("""
            SELECT sost_id, nombre_sost, monto_total, n_establecimientos
            FROM mv_sostenedores_anual
            WHERE periodo = :p
            ORDER BY monto_total DESC
            LIMIT :lim
        """), {"p": periodo, "lim": limit})
    else:
        q = await db.execute(text("""
            SELECT sost_id, nombre_sost, monto_total, n_establecimientos
            FROM mv_sostenedores_global
            ORDER BY monto_total DESC
            LIMIT :lim
        """), {"lim": limit})
    return [dict(r) for r in q.mappings()]

# ── Remuneraciones — SOLO ADMIN ─────────────────────────────────────────────

@router.get("/remuneraciones")
async def remuneraciones_detalle(
    anio: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    if anio:
        q = await db.execute(text("""
            SELECT anio, promedio_liquido, promedio_haber, promedio_descuento,
                   n_funcionarios, liquido_total AS total_liquido
            FROM mv_rem_anual
            WHERE anio = :a
        """), {"a": anio})
    else:
        q = await db.execute(text("""
            SELECT anio, promedio_liquido, promedio_haber, promedio_descuento,
                   n_funcionarios, liquido_total AS total_liquido
            FROM mv_rem_anual
            ORDER BY anio
        """))
    por_anio = [dict(r) for r in q.mappings()]

    if anio:
        q2 = await db.execute(text("""
            SELECT tip, n_registros, promedio_liquido
            FROM mv_rem_por_tipo
            WHERE anio = :a
            ORDER BY n_registros DESC
            LIMIT 15
        """), {"a": anio})
    else:
        q2 = await db.execute(text("""
            SELECT tip,
                   SUM(n_registros) AS n_registros,
                   ROUND(AVG(promedio_liquido), 0) AS promedio_liquido
            FROM mv_rem_por_tipo
            GROUP BY tip
            ORDER BY n_registros DESC
            LIMIT 15
        """))
    por_tipo = [dict(r) for r in q2.mappings()]

    return {"por_anio": por_anio, "por_tipo": por_tipo}

# ── Estado de Resultado — SOLO ADMIN ───────────────────────────────────────

@router.get("/estado-resultado")
async def estado_resultado(
    periodo: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    if periodo:
        q = await db.execute(text("""
            SELECT periodo, desc_tipo_cuenta, monto_declarado
            FROM mv_estado_resultado
            WHERE periodo = :p
            ORDER BY desc_tipo_cuenta
        """), {"p": periodo})
    else:
        q = await db.execute(text("""
            SELECT periodo, desc_tipo_cuenta, monto_declarado
            FROM mv_estado_resultado
            ORDER BY periodo, desc_tipo_cuenta
        """))
    return [dict(r) for r in q.mappings()]

# ── Filtros disponibles ─────────────────────────────────────────────────────

@router.get("/filtros/periodos")
async def periodos_disponibles(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = await db.execute(text("""
        SELECT DISTINCT periodo FROM mv_resumen_anual ORDER BY periodo
    """))
    return [r[0] for r in q.fetchall()]

@router.get("/filtros/regiones")
async def regiones(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = await db.execute(text("SELECT codigo_region, nombre_region FROM dim_region ORDER BY codigo_region"))
    return [dict(r) for r in q.mappings()]

# ── Eficiencia y estructura del gasto ──────────────────────────────────────

@router.get("/eficiencia-gasto")
async def eficiencia_gasto(
    periodo: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Concentración del Gasto Administrativo.
    Clasifica gastos de estado_resultado por categoría:
      410xx → Gasto en Aula
      411xx → Gasto Administrativo
      700xx → Otros Gastos
    """
    # ── Totales por categoría y período (para barras apiladas y serie temporal)
    if periodo:
        q_resumen = await db.execute(text("""
            SELECT periodo, categoria_gasto,
                   SUM(monto_total) AS monto_total,
                   SUM(n_registros) AS n_registros
            FROM mv_eficiencia_gasto
            WHERE periodo = :p
            GROUP BY periodo, categoria_gasto
            ORDER BY periodo, categoria_gasto
        """), {"p": periodo})
    else:
        q_resumen = await db.execute(text("""
            SELECT periodo, categoria_gasto,
                   SUM(monto_total) AS monto_total,
                   SUM(n_registros) AS n_registros
            FROM mv_eficiencia_gasto
            GROUP BY periodo, categoria_gasto
            ORDER BY periodo, categoria_gasto
        """))
    por_periodo = [dict(r) for r in q_resumen.mappings()]

    # ── Totales globales por categoría (para torta y KPIs)
    if periodo:
        q_global = await db.execute(text("""
            SELECT categoria_gasto,
                   SUM(monto_total)        AS monto_total,
                   SUM(n_establecimientos) AS n_establecimientos,
                   SUM(n_sostenedores)     AS n_sostenedores
            FROM mv_eficiencia_gasto
            WHERE periodo = :p
            GROUP BY categoria_gasto
            ORDER BY monto_total DESC
        """), {"p": periodo})
    else:
        q_global = await db.execute(text("""
            SELECT categoria_gasto,
                   SUM(monto_total)        AS monto_total,
                   SUM(n_establecimientos) AS n_establecimientos,
                   SUM(n_sostenedores)     AS n_sostenedores
            FROM mv_eficiencia_gasto
            GROUP BY categoria_gasto
            ORDER BY monto_total DESC
        """))
    por_categoria = [dict(r) for r in q_global.mappings()]

    # ── Calcular índice de concentración del gasto administrativo
    total_gasto = sum(float(r["monto_total"] or 0) for r in por_categoria)
    admin_row   = next((r for r in por_categoria if r["categoria_gasto"] == "Gasto Administrativo"), None)
    aula_row    = next((r for r in por_categoria if r["categoria_gasto"] == "Gasto en Aula"), None)
    otros_row   = next((r for r in por_categoria if r["categoria_gasto"] == "Otros Gastos"), None)

    concentracion_admin = (
        float(admin_row["monto_total"]) / total_gasto * 100 if admin_row and total_gasto else 0
    )
    ratio_aula_admin = (
        float(aula_row["monto_total"]) / float(admin_row["monto_total"])
        if aula_row and admin_row and float(admin_row["monto_total"]) > 0 else None
    )

    return {
        "por_periodo":          por_periodo,
        "por_categoria":        por_categoria,
        "total_gasto":          total_gasto,
        "concentracion_admin":  round(concentracion_admin, 2),
        "ratio_aula_admin":     round(ratio_aula_admin, 2) if ratio_aula_admin else None,
        "monto_admin":          float(admin_row["monto_total"]) if admin_row else 0,
        "monto_aula":           float(aula_row["monto_total"]) if aula_row else 0,
        "monto_otros":          float(otros_row["monto_total"]) if otros_row else 0,
    }

# ── Innovación Pedagógica ───────────────────────────────────────────────────

@router.get("/innovacion-pedagogica")
async def innovacion_pedagogica(
    periodo: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    % Gasto en Innovación Pedagógica.
    Cuentas de innovación: 410500, 410600, 410700.
    Gasto no remuneracional: excluye cuentas de nómina (lista 2024).
    """
    # ── Serie temporal por período ──────────────────────────────────────────
    if periodo:
        q_serie = await db.execute(text("""
            SELECT periodo, monto_innovacion, total_gasto,
                   gasto_no_remuneracional, gasto_remuneracional,
                   pct_innovacion_total, pct_innovacion_no_rem,
                   n_registros
            FROM mv_innovacion_pedagogica
            WHERE periodo = :p
        """), {"p": periodo})
    else:
        q_serie = await db.execute(text("""
            SELECT periodo, monto_innovacion, total_gasto,
                   gasto_no_remuneracional, gasto_remuneracional,
                   pct_innovacion_total, pct_innovacion_no_rem,
                   n_registros
            FROM mv_innovacion_pedagogica
            ORDER BY periodo
        """))
    serie = [dict(r) for r in q_serie.mappings()]

    # ── Detalle de cuentas de innovación ───────────────────────────────────
    if periodo:
        q_det = await db.execute(text("""
            SELECT cuenta_alias, monto_total, n_establecimientos
            FROM mv_innovacion_detalle
            WHERE periodo = :p
              AND tipo_cuenta = 'Innovación Pedagógica'
            ORDER BY monto_total DESC
        """), {"p": periodo})
    else:
        q_det = await db.execute(text("""
            SELECT cuenta_alias,
                   SUM(monto_total)        AS monto_total,
                   SUM(n_establecimientos) AS n_establecimientos
            FROM mv_innovacion_detalle
            WHERE tipo_cuenta = 'Innovación Pedagógica'
            GROUP BY cuenta_alias
            ORDER BY monto_total DESC
        """))
    detalle_innovacion = [dict(r) for r in q_det.mappings()]

    # ── Totales globales ────────────────────────────────────────────────────
    if serie:
        total_innovacion   = sum(float(r["monto_innovacion"] or 0) for r in serie)
        total_gasto        = sum(float(r["total_gasto"] or 0) for r in serie)
        total_no_rem       = sum(float(r["gasto_no_remuneracional"] or 0) for r in serie)
        total_rem          = sum(float(r["gasto_remuneracional"] or 0) for r in serie)
        pct_total          = (total_innovacion / total_gasto * 100) if total_gasto else 0
        pct_no_rem         = (total_innovacion / total_no_rem * 100) if total_no_rem else 0
    else:
        total_innovacion = total_gasto = total_no_rem = total_rem = pct_total = pct_no_rem = 0

    return {
        "serie":              serie,
        "detalle_innovacion": detalle_innovacion,
        "total_innovacion":   total_innovacion,
        "total_gasto":        total_gasto,
        "total_no_rem":       total_no_rem,
        "total_rem":          total_rem,
        "pct_sobre_total":    round(pct_total, 2),
        "pct_sobre_no_rem":   round(pct_no_rem, 2),
    }

# ── Riesgo Estructural — Gasto Remuneracional / Ingreso Depurado ─────────

@router.get("/gasto-rem-ingreso")
async def gasto_rem_ingreso(
    periodo: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Ratio Gasto Remuneracional / Ingreso Depurado por sostenedor.
    Numerador : tabla remuneraciones con cuentas de nómina 2024.
    Denominador: estado_resultado ingresos RENDIDO.
    """
    # ── Resumen por período y nivel de riesgo ────────────────────────────────
    if periodo:
        q_resumen = await db.execute(text("""
            SELECT periodo, nivel_riesgo, orden_riesgo,
                   n_sostenedores, avg_ratio, min_ratio, max_ratio,
                   total_gasto_rem, total_ingreso
            FROM mv_ratio_rem_resumen
            WHERE periodo = :p
            ORDER BY orden_riesgo
        """), {"p": periodo})
    else:
        q_resumen = await db.execute(text("""
            SELECT periodo, nivel_riesgo, orden_riesgo,
                   n_sostenedores, avg_ratio, min_ratio, max_ratio,
                   total_gasto_rem, total_ingreso
            FROM mv_ratio_rem_resumen
            ORDER BY periodo, orden_riesgo
        """))
    por_nivel = [dict(r) for r in q_resumen.mappings()]

    # ── Top sostenedores con ratio más alto (mayor riesgo) ───────────────────
    if periodo:
        q_top = await db.execute(text("""
            SELECT sost_id, ratio_pct, nivel_riesgo, orden_riesgo,
                   gasto_rem, ingreso_total
            FROM mv_ratio_rem_ingreso
            WHERE periodo = :p AND ratio_pct IS NOT NULL
            ORDER BY ratio_pct DESC
            LIMIT 20
        """), {"p": periodo})
    else:
        q_top = await db.execute(text("""
            SELECT sost_id, nivel_riesgo,
                   ROUND(AVG(ratio_pct)::NUMERIC, 2)  AS ratio_pct,
                   MAX(orden_riesgo)                  AS orden_riesgo,
                   SUM(gasto_rem)                     AS gasto_rem,
                   SUM(ingreso_total)                 AS ingreso_total
            FROM mv_ratio_rem_ingreso
            WHERE ratio_pct IS NOT NULL
            GROUP BY sost_id, nivel_riesgo
            ORDER BY AVG(ratio_pct) DESC
            LIMIT 20
        """))
    top_sost = [dict(r) for r in q_top.mappings()]

    # ── KPIs globales ─────────────────────────────────────────────────────────
    if periodo:
        q_kpi = await db.execute(text("""
            SELECT
                ROUND(AVG(ratio_pct)::NUMERIC, 2)    AS avg_ratio,
                SUM(gasto_rem)                        AS total_gasto_rem,
                SUM(ingreso_total)                    AS total_ingreso,
                COUNT(DISTINCT sost_id)               AS total_sost
            FROM mv_ratio_rem_ingreso
            WHERE periodo = :p AND ratio_pct IS NOT NULL
        """), {"p": periodo})
    else:
        q_kpi = await db.execute(text("""
            SELECT
                ROUND(AVG(ratio_pct)::NUMERIC, 2)    AS avg_ratio,
                SUM(gasto_rem)                        AS total_gasto_rem,
                SUM(ingreso_total)                    AS total_ingreso,
                COUNT(DISTINCT sost_id)               AS total_sost
            FROM mv_ratio_rem_ingreso
            WHERE ratio_pct IS NOT NULL
        """))
    row = q_kpi.mappings().one_or_none()
    avg_ratio     = float(row["avg_ratio"] or 0) if row else 0
    total_rem     = float(row["total_gasto_rem"] or 0) if row else 0
    total_ing     = float(row["total_ingreso"] or 0) if row else 0
    total_sost    = int(row["total_sost"] or 0) if row else 0
    ratio_global  = round(total_rem / total_ing * 100, 2) if total_ing else 0

    sost_alto_crit = sum(
        r["n_sostenedores"] for r in por_nivel
        if r["nivel_riesgo"] in ("Riesgo Alto", "Riesgo Crítico")
        and (not periodo or r["periodo"] == periodo)
    )

    return {
        "por_nivel":       por_nivel,
        "top_sost":        top_sost,
        "avg_ratio":       avg_ratio,
        "ratio_global":    ratio_global,
        "total_rem":       total_rem,
        "total_ingreso":   total_ing,
        "total_sost":      total_sost,
        "sost_alto_crit":  sost_alto_crit,
    }

# ── Comportamiento Financiero — Gasto Remuneracional por Establecimiento ─────────

@router.get("/gasto-rem-ingreso-establecimiento")
async def gasto_rem_ingreso_establecimiento(
    sost_id: int = Query(...),
    periodo: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Ratio Gasto Remuneracional / Ingreso Depurado por Establecimiento (RBD) para un sostenedor.
    Numerador : tabla remuneraciones con cuentas de nómina 2024.
    Denominador: estado_resultado ingresos RENDIDO.
    """
    query_text = """
        WITH rem AS (
            SELECT COALESCE(rbd, -1) AS rbd,
                   anio AS periodo,
                   SUM(monto) AS gasto_rem
            FROM remuneraciones
            WHERE sostenedor = :sid
              AND cuenta_alias IN ('410101', '410102', '410104', '410105', '410116', '410119', '410121', '410124', '410128', '410129', '410401', '410402', '410403', '410404', '410304', '410309', '410501', '410803')
            GROUP BY COALESCE(rbd, -1), anio
        ),
        ing AS (
            SELECT COALESCE(rbd, -1) AS rbd,
                   periodo,
                   SUM(monto_declarado) AS ingreso_total
            FROM estado_resultado
            WHERE sost_id = :sid
              AND desc_tipo_cuenta ILIKE '%ingreso%'
              AND UPPER(TRIM(desc_estado)) = 'RENDIDO'
              AND cuenta_alias_padre LIKE '3%'
            GROUP BY COALESCE(rbd, -1), periodo
        ),
        joined AS (
            SELECT COALESCE(r.rbd, i.rbd) AS rbd,
                   COALESCE(r.periodo, i.periodo) AS periodo,
                   COALESCE(r.gasto_rem, 0) AS gasto_rem,
                   COALESCE(i.ingreso_total, 0) AS ingreso_total
            FROM rem r
            FULL JOIN ing i ON r.rbd = i.rbd AND r.periodo = i.periodo
            WHERE COALESCE(r.gasto_rem, 0) > 0 OR COALESCE(i.ingreso_total, 0) > 0
        ),
        con_ratio AS (
            SELECT rbd,
                   periodo,
                   gasto_rem,
                   ingreso_total,
                   CASE
                       WHEN ingreso_total > 0 THEN ROUND((gasto_rem / ingreso_total) * 100, 2)
                       ELSE NULL
                   END AS ratio_pct
            FROM joined
        )
        SELECT rbd,
               periodo,
               gasto_rem,
               ingreso_total,
               ratio_pct,
               CASE
                   WHEN ratio_pct IS NULL THEN 'Sin Datos'
                   WHEN ratio_pct < 70 THEN 'Riesgo Bajo'
                   WHEN ratio_pct < 85 THEN 'Riesgo Medio'
                   WHEN ratio_pct < 95 THEN 'Riesgo Alto'
                   ELSE 'Riesgo Crítico'
               END AS nivel_riesgo,
               CASE
                   WHEN ratio_pct IS NULL THEN 0
                   WHEN ratio_pct < 70 THEN 1
                   WHEN ratio_pct < 85 THEN 2
                   WHEN ratio_pct < 95 THEN 3
                   ELSE 4
               END AS orden_riesgo
        FROM con_ratio
        WHERE (periodo = :p OR :p IS NULL)
        ORDER BY orden_riesgo DESC, ratio_pct DESC NULLS LAST
    """
    
    q = await db.execute(text(query_text), {"sid": sost_id, "p": periodo})
    resultados = [dict(r) for r in q.mappings()]
    
    # Resumen por período y nivel de riesgo
    from collections import defaultdict
    summary = defaultdict(lambda: {"n_establecimientos": 0, "sum_ratio": 0, "count_ratio": 0, "min_ratio": None, "max_ratio": None, "total_gasto_rem": 0, "total_ingreso": 0})
    
    for r in resultados:
        k = (r["periodo"], r["nivel_riesgo"], r["orden_riesgo"])
        s = summary[k]
        s["n_establecimientos"] += 1
        s["total_gasto_rem"] += float(r["gasto_rem"] or 0)
        s["total_ingreso"] += float(r["ingreso_total"] or 0)
        if r["ratio_pct"] is not None:
            val = float(r["ratio_pct"])
            s["sum_ratio"] += val
            s["count_ratio"] += 1
            if s["min_ratio"] is None or val < s["min_ratio"]: s["min_ratio"] = val
            if s["max_ratio"] is None or val > s["max_ratio"]: s["max_ratio"] = val

    por_nivel = []
    for (per, niv, ord_r), s in summary.items():
        por_nivel.append({
            "periodo": per,
            "nivel_riesgo": niv,
            "orden_riesgo": ord_r,
            "n_establecimientos": s["n_establecimientos"],
            "avg_ratio": round(s["sum_ratio"] / s["count_ratio"], 2) if s["count_ratio"] > 0 else None,
            "min_ratio": s["min_ratio"],
            "max_ratio": s["max_ratio"],
            "total_gasto_rem": s["total_gasto_rem"],
            "total_ingreso": s["total_ingreso"]
        })
    
    por_nivel.sort(key=lambda x: (x["periodo"], x["orden_riesgo"]))
    
    # Nombres de RBD
    rbds = [r["rbd"] for r in resultados if r["rbd"] is not None]
    nombres_rbd = {}
    if rbds:
        q_names = await db.execute(text("SELECT DISTINCT ON (rbd) rbd, nom_rbd FROM dim_establecimiento_oficial WHERE rbd = ANY(:rbds) ORDER BY rbd, agno DESC"), {"rbds": list(set(rbds))})
        for row in q_names.mappings():
            nombres_rbd[row["rbd"]] = row["nom_rbd"]
            
    for r in resultados:
        if r["rbd"] == -1 or r["rbd"] is None:
            r["nom_rbd"] = "Adm. Central"
            r["rbd"] = None
        else:
            r["nom_rbd"] = nombres_rbd.get(r["rbd"], f"RBD {r['rbd']}")
        
    valid_ratios = [float(r["ratio_pct"]) for r in resultados if r["ratio_pct"] is not None]
    avg_ratio = round(sum(valid_ratios)/len(valid_ratios), 2) if valid_ratios else 0
    total_rem = sum(float(r["gasto_rem"] or 0) for r in resultados)
    total_ing = sum(float(r["ingreso_total"] or 0) for r in resultados)
    total_estab = len(set(r["rbd"] for r in resultados))
    ratio_global = round(total_rem / total_ing * 100, 2) if total_ing else 0
    estab_alto_crit = sum(1 for r in resultados if r["nivel_riesgo"] in ("Riesgo Alto", "Riesgo Crítico"))
    
    return {
        "por_nivel": por_nivel,
        "top_estab": resultados,
        "avg_ratio": avg_ratio,
        "ratio_global": ratio_global,
        "total_rem": total_rem,
        "total_ingreso": total_ing,
        "total_estab": total_estab,
        "estab_alto_crit": estab_alto_crit,
    }


# ── Sostenibilidad y Riesgo Financiero — HHI ───────────────────────────────

@router.get("/hhi-fuentes")
async def hhi_fuentes(
    periodo: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    HHI de Fuentes de Ingreso.
    Mide concentración de financiamiento por sostenedor.
    Fuente: estado_resultado con desc_tipo_cuenta ILIKE '%ingreso%'
            y UPPER(TRIM(desc_estado)) = 'RENDIDO', clasificado por subvencion_alias.
    """
    # ── Resumen global por nivel de concentración y período ─────────────────
    if periodo:
        q_resumen = await db.execute(text("""
            SELECT periodo, nivel_concentracion, orden_concentracion,
                   n_sostenedores, avg_hhi, min_hhi, max_hhi, monto_total
            FROM mv_hhi_resumen
            WHERE periodo = :p
            ORDER BY orden_concentracion
        """), {"p": periodo})
    else:
        q_resumen = await db.execute(text("""
            SELECT periodo, nivel_concentracion, orden_concentracion,
                   n_sostenedores, avg_hhi, min_hhi, max_hhi, monto_total
            FROM mv_hhi_resumen
            ORDER BY periodo, orden_concentracion
        """))
    por_nivel = [dict(r) for r in q_resumen.mappings()]

    # ── Fuentes de ingreso globales ─────────────────────────────────────────
    if periodo:
        q_fuentes = await db.execute(text("""
            SELECT subvencion_alias, monto_total,
                   n_sostenedores, pct_participacion_global
            FROM mv_hhi_fuentes_global
            WHERE periodo = :p
            ORDER BY monto_total DESC
        """), {"p": periodo})
    else:
        q_fuentes = await db.execute(text("""
            SELECT subvencion_alias,
                   SUM(monto_total)         AS monto_total,
                   SUM(n_sostenedores)      AS n_sostenedores,
                   ROUND(AVG(pct_participacion_global)::NUMERIC, 2) AS pct_participacion_global
            FROM mv_hhi_fuentes_global
            GROUP BY subvencion_alias
            ORDER BY monto_total DESC
        """))
    fuentes = [dict(r) for r in q_fuentes.mappings()]

    # ── Top sostenedores con mayor HHI (mayor concentración/riesgo) ─────────
    if periodo:
        q_top = await db.execute(text("""
            SELECT sost_id, hhi, nivel_concentracion, n_fuentes,
                   monto_total, fuente_principal, pct_fuente_principal
            FROM mv_hhi_fuentes
            WHERE periodo = :p
            ORDER BY hhi DESC
            LIMIT 20
        """), {"p": periodo})
    else:
        q_top = await db.execute(text("""
            SELECT sost_id,
                   ROUND(AVG(hhi)::NUMERIC, 2)          AS hhi,
                   MAX(nivel_concentracion)              AS nivel_concentracion,
                   ROUND(AVG(n_fuentes)::NUMERIC, 1)    AS n_fuentes,
                   SUM(monto_total)                      AS monto_total,
                   MAX(fuente_principal)                 AS fuente_principal,
                   ROUND(AVG(pct_fuente_principal)::NUMERIC, 2) AS pct_fuente_principal
            FROM mv_hhi_fuentes
            GROUP BY sost_id
            ORDER BY AVG(hhi) DESC
            LIMIT 20
        """))
    top_sost = [dict(r) for r in q_top.mappings()]

    # ── KPIs globales ────────────────────────────────────────────────────────
    if por_nivel:
        total_sost  = sum(r["n_sostenedores"] for r in por_nivel if r["periodo"] == (periodo or r["periodo"]))
        # Para "todos los períodos" el denominador puede tener duplicados → usar distinct
        if not periodo:
            q_total = await db.execute(text("SELECT COUNT(DISTINCT sost_id) AS n FROM mv_hhi_fuentes"))
            total_sost = q_total.scalar()
    else:
        total_sost = 0

    if periodo:
        q_avg = await db.execute(text("""
            SELECT ROUND(AVG(hhi)::NUMERIC, 2) AS avg_hhi
            FROM mv_hhi_fuentes WHERE periodo = :p
        """), {"p": periodo})
    else:
        q_avg = await db.execute(text("SELECT ROUND(AVG(hhi)::NUMERIC, 2) AS avg_hhi FROM mv_hhi_fuentes"))
    avg_hhi = q_avg.scalar() or 0

    sost_alta = sum(
        r["n_sostenedores"] for r in por_nivel
        if r["nivel_concentracion"] == "Concentración Alta"
        and (not periodo or r["periodo"] == periodo)
    )

    return {
        "por_nivel":     por_nivel,
        "fuentes":       fuentes,
        "top_sost":      top_sost,
        "avg_hhi":       float(avg_hhi),
        "total_sost":    total_sost,
        "sost_alta":     sost_alta,
    }

# ── HHI de Fuentes de Ingreso — vista filtrada por sostenedor ───────────────

@router.get("/hhi-fuentes-sostenedor")
async def hhi_fuentes_sostenedor(
    sost_id: int,
    periodo: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    HHI de Fuentes de Ingreso para un sostenedor específico.
    Devuelve serie temporal de HHI, distribución de fuentes y detalle
    por período, filtrando mv_hhi_fuentes y estado_resultado por sost_id.
    """
    # ── Serie temporal HHI del sostenedor ────────────────────────────────────
    if periodo:
        q_hhi = await db.execute(text("""
            SELECT periodo, hhi, nivel_concentracion, orden_concentracion,
                   n_fuentes, monto_total, fuente_principal, pct_fuente_principal
            FROM mv_hhi_fuentes
            WHERE sost_id = :sid AND periodo = :p
            ORDER BY periodo
        """), {"sid": sost_id, "p": periodo})
    else:
        q_hhi = await db.execute(text("""
            SELECT periodo, hhi, nivel_concentracion, orden_concentracion,
                   n_fuentes, monto_total, fuente_principal, pct_fuente_principal
            FROM mv_hhi_fuentes
            WHERE sost_id = :sid
            ORDER BY periodo
        """), {"sid": sost_id})
    hhi_serie = [dict(r) for r in q_hhi.mappings()]

    # ── Fuentes de ingreso del sostenedor (participación por fuente) ──────────
    if periodo:
        q_fuentes = await db.execute(text("""
            SELECT subvencion_alias,
                   SUM(monto_declarado)  AS monto_total,
                   ROUND(
                       SUM(monto_declarado) * 100.0 /
                       NULLIF(SUM(SUM(monto_declarado)) OVER (), 0)
                   , 2) AS pct_participacion
            FROM estado_resultado
            WHERE sost_id = :sid
              AND periodo  = :p
              AND UPPER(TRIM(desc_tipo_cuenta)) LIKE '%INGRESO%'
              AND UPPER(TRIM(desc_estado))      = 'RENDIDO'
              AND cuenta_alias_padre LIKE '3%'
              AND subvencion_alias IS NOT NULL
              AND subvencion_alias <> ''
            GROUP BY subvencion_alias
            ORDER BY monto_total DESC
        """), {"sid": sost_id, "p": periodo})
    else:
        q_fuentes = await db.execute(text("""
            SELECT subvencion_alias,
                   SUM(monto_declarado) AS monto_total,
                   ROUND(
                       SUM(monto_declarado) * 100.0 /
                       NULLIF(SUM(SUM(monto_declarado)) OVER (), 0)
                   , 2) AS pct_participacion
            FROM estado_resultado
            WHERE sost_id = :sid
              AND UPPER(TRIM(desc_tipo_cuenta)) LIKE '%INGRESO%'
              AND UPPER(TRIM(desc_estado))      = 'RENDIDO'
              AND cuenta_alias_padre LIKE '3%'
              AND subvencion_alias IS NOT NULL
              AND subvencion_alias <> ''
            GROUP BY subvencion_alias
            ORDER BY monto_total DESC
        """), {"sid": sost_id})
    fuentes = [dict(r) for r in q_fuentes.mappings()]

    # ── KPIs ────────────────────────────────────────────────────────────────
    ultimo = hhi_serie[-1] if hhi_serie else None
    avg_hhi = (
        sum(float(r["hhi"] or 0) for r in hhi_serie) / len(hhi_serie)
        if hhi_serie else 0
    )

    return {
        "hhi_serie":    hhi_serie,
        "fuentes":      fuentes,
        "avg_hhi":      round(avg_hhi, 2),
        "ultimo":       ultimo,
        "n_periodos":   len(hhi_serie),
    }

# ── Admin: refrescar vistas materializadas ──────────────────────────────────

@router.get("/acreditacion-saldos")
async def acreditacion_saldos(
    periodo: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Indicador Acreditación de Saldos.
    Clasifica sostenedores por nivel de riesgo según su % de rendición.
    """
    # ── Totales globales por estado ─────────────────────────────────────────
    if periodo:
        q_global = await db.execute(text("""
            SELECT estado_norm, SUM(n_registros) AS n_registros,
                   SUM(monto_total) AS monto_total
            FROM mv_acreditacion_global
            WHERE periodo = :p
            GROUP BY estado_norm
        """), {"p": periodo})
    else:
        q_global = await db.execute(text("""
            SELECT estado_norm, SUM(n_registros) AS n_registros,
                   SUM(monto_total) AS monto_total
            FROM mv_acreditacion_global
            GROUP BY estado_norm
        """))
    global_data = [dict(r) for r in q_global.mappings()]

    # ── Distribución de riesgo por período ──────────────────────────────────
    if periodo:
        q_riesgo = await db.execute(text("""
            SELECT periodo, nivel_riesgo, orden_riesgo,
                   n_sostenedores, monto_total, monto_no_rendido,
                   n_no_rendido_total, avg_pct_rendido
            FROM mv_acreditacion_resumen_riesgo
            WHERE periodo = :p
            ORDER BY orden_riesgo
        """), {"p": periodo})
    else:
        q_riesgo = await db.execute(text("""
            SELECT periodo, nivel_riesgo, orden_riesgo,
                   n_sostenedores, monto_total, monto_no_rendido,
                   n_no_rendido_total, avg_pct_rendido
            FROM mv_acreditacion_resumen_riesgo
            ORDER BY periodo, orden_riesgo
        """))
    por_riesgo = [dict(r) for r in q_riesgo.mappings()]

    # ── Top sostenedores con mayor monto no rendido ─────────────────────────
    if periodo:
        q_top = await db.execute(text("""
            SELECT sost_id, nivel_riesgo, pct_rendido, pct_no_rendido,
                   monto_total, monto_no_rendido, monto_rendido,
                   n_no_rendido, total_reg, region_rbd
            FROM mv_acreditacion_riesgo
            WHERE periodo = :p AND monto_no_rendido > 0
            ORDER BY monto_no_rendido DESC
            LIMIT 20
        """), {"p": periodo})
    else:
        q_top = await db.execute(text("""
            SELECT sost_id, nivel_riesgo,
                   ROUND(AVG(pct_rendido)::NUMERIC, 2)    AS pct_rendido,
                   ROUND(AVG(pct_no_rendido)::NUMERIC, 2) AS pct_no_rendido,
                   SUM(monto_total)                        AS monto_total,
                   SUM(monto_no_rendido)                   AS monto_no_rendido,
                   SUM(monto_rendido)                      AS monto_rendido,
                   SUM(n_no_rendido)                       AS n_no_rendido,
                   SUM(total_reg)                          AS total_reg,
                   MAX(region_rbd)                         AS region_rbd
            FROM mv_acreditacion_riesgo
            WHERE monto_no_rendido > 0
            GROUP BY sost_id, nivel_riesgo
            ORDER BY monto_no_rendido DESC
            LIMIT 20
        """))
    top_sost = [dict(r) for r in q_top.mappings()]

    # ── KPIs globales ───────────────────────────────────────────────────────
    n_total    = sum(r["n_registros"] for r in global_data)
    m_total    = sum(float(r["monto_total"] or 0) for r in global_data)
    r_rendido  = next((r for r in global_data if r["estado_norm"] == "Rendido"), None)
    r_no_rend  = next((r for r in global_data if r["estado_norm"] == "No rendido"), None)

    n_rendido      = r_rendido["n_registros"] if r_rendido else 0
    n_no_rendido   = r_no_rend["n_registros"] if r_no_rend else 0
    m_no_rendido   = float(r_no_rend["monto_total"] or 0) if r_no_rend else 0
    pct_rendido    = round(n_rendido / n_total * 100, 2) if n_total else 0
    pct_no_rendido = round(n_no_rendido / n_total * 100, 2) if n_total else 0

    # Nº de sostenedores en riesgo alto / crítico (global o filtrado)
    if periodo:
        q_sost_riesgo = await db.execute(text("""
            SELECT nivel_riesgo, COUNT(DISTINCT sost_id) AS n
            FROM mv_acreditacion_riesgo
            WHERE periodo = :p
            GROUP BY nivel_riesgo
        """), {"p": periodo})
    else:
        q_sost_riesgo = await db.execute(text("""
            SELECT nivel_riesgo, COUNT(DISTINCT sost_id) AS n
            FROM mv_acreditacion_riesgo
            GROUP BY nivel_riesgo
        """))
    sost_por_nivel = {r["nivel_riesgo"]: r["n"] for r in q_sost_riesgo.mappings()}

    return {
        "global":              global_data,
        "por_riesgo":          por_riesgo,
        "top_sostenedores":    top_sost,
        "n_total":             n_total,
        "n_rendido":           n_rendido,
        "n_no_rendido":        n_no_rendido,
        "monto_total":         m_total,
        "monto_no_rendido":    m_no_rendido,
        "pct_rendido":         pct_rendido,
        "pct_no_rendido":      pct_no_rendido,
        "sost_por_nivel":      sost_por_nivel,
    }

@router.post("/refresh-mv")
async def refresh_materialized_views(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Refresca todas las vistas materializadas. Solo admin. Tarda varios minutos."""
    result = await db.execute(text("SELECT refresh_mv_all()"))
    await db.execute(text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_eficiencia_gasto') THEN
                REFRESH MATERIALIZED VIEW mv_eficiencia_gasto;
                REFRESH MATERIALIZED VIEW mv_eficiencia_resumen;
            END IF;
            IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_innovacion_pedagogica') THEN
                REFRESH MATERIALIZED VIEW mv_innovacion_pedagogica;
                REFRESH MATERIALIZED VIEW mv_innovacion_detalle;
            END IF;
            IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_acreditacion_global') THEN
                REFRESH MATERIALIZED VIEW mv_acreditacion_global;
                REFRESH MATERIALIZED VIEW mv_acreditacion_riesgo;
                REFRESH MATERIALIZED VIEW mv_acreditacion_resumen_riesgo;
            END IF;
            IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_hhi_fuentes') THEN
                REFRESH MATERIALIZED VIEW mv_hhi_fuentes;
                REFRESH MATERIALIZED VIEW mv_hhi_resumen;
                REFRESH MATERIALIZED VIEW mv_hhi_fuentes_global;
            END IF;
        END $$;
    """))
    msg = result.scalar()
    await db.commit()
    return {"status": "ok", "message": msg}



# ── Ficha Sostenedor ────────────────────────────────────────────────────────

@router.get("/ficha-sostenedor")
async def ficha_sostenedor(
    sost_id: int = Query(...),
    periodo: int = Query(default=2024),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Perfil del sostenedor y listado de establecimientos.
    Usa dim_sostenedor_oficial para el perfil y dim_establecimiento_oficial para los colegios.
    """
    # ── Años disponibles en las tablas de dimensión ───────────────────────────
    # Usamos los años que tengan datos de establecimientos para el selector
    per_dim_q = await db.execute(text("""
        SELECT DISTINCT agno FROM dim_establecimiento_oficial
        WHERE rut_sostenedor = :sid
        ORDER BY agno DESC
    """), {"sid": sost_id})
    periodos_dim = [r[0] for r in per_dim_q.fetchall()]

    # Si el año solicitado no existe en dim_establecimiento, usar el más cercano
    agno_ee = periodo if periodo in periodos_dim else (periodos_dim[0] if periodos_dim else periodo)

    # Para dim_sostenedor_oficial puede haber más años
    per_sost_q = await db.execute(text("""
        SELECT DISTINCT agno FROM dim_sostenedor_oficial
        WHERE rut_sost = :sid
        ORDER BY agno DESC
    """), {"sid": sost_id})
    periodos_sost = [r[0] for r in per_sost_q.fetchall()]
    agno_sost = periodo if periodo in periodos_sost else (periodos_sost[0] if periodos_sost else periodo)

    # Períodos disponibles = unión de ambas fuentes (para el selector de año)
    periodos_disponibles = sorted(set(periodos_dim) | set(periodos_sost), reverse=True)

    # ── Perfil del sostenedor (filtrado por año) ───────────────────────────────
    perfil_q = await db.execute(text("""
        SELECT
            rut_sost,
            nombre_sost,
            cod_reg_sost,
            nom_com_sost,
            num_rbd,
            num_rbd_tot,
            mat_total,
            num_c_doc,
            num_c_asis
        FROM dim_sostenedor_oficial
        WHERE rut_sost = :sid
          AND agno = :agno
        LIMIT 1
    """), {"sid": sost_id, "agno": agno_sost})
    perfil_row = perfil_q.mappings().one_or_none()

    if perfil_row is None:
        return {"perfil": None, "establecimientos": [], "periodos_disponibles": periodos_disponibles}

    perfil = {
        "sost_id": sost_id,
        "rut_sost": perfil_row["rut_sost"],
        "nombre_sost": perfil_row["nombre_sost"],
        "cod_reg_sost": perfil_row["cod_reg_sost"],
        "nom_com_sost": perfil_row["nom_com_sost"],
        "num_rbd": int(perfil_row["num_rbd"] or 0),
        "num_rbd_tot": int(perfil_row["num_rbd_tot"] or 0),
        "mat_total": int(perfil_row["mat_total"] or 0),
        "num_c_doc": int(perfil_row["num_c_doc"] or 0),
        "num_c_asis": int(perfil_row["num_c_asis"] or 0),
        "agno": int(agno_sost),
    }

    # ── Listado de establecimientos (filtrado por año) ─────────────────────────
    ee_q = await db.execute(text("""
        SELECT
            rbd, nom_rbd, estado_estab, matricula,
            mat_total, rural_rbd, convenio_pie, pace,
            ens_01, ens_02, ens_03, ens_04, ens_05,
            ens_06, ens_07, ens_08, ens_09, ens_10, ens_11
        FROM dim_establecimiento_oficial
        WHERE rut_sostenedor = :sid
          AND agno = :agno
        ORDER BY nom_rbd
    """), {"sid": sost_id, "agno": agno_ee})
    establecimientos = [dict(r) for r in ee_q.mappings()]

    return {
        "perfil": perfil,
        "establecimientos": establecimientos,
        "periodos_disponibles": periodos_disponibles,
    }


@router.get("/ficha-sostenedor/detalle-rbd")
async def ficha_sostenedor_detalle_rbd(
    sost_id: int = Query(...),
    periodo: int = Query(default=2024),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Detalle financiero por RBD para un sostenedor específico."""

    # ── Períodos disponibles (unión de fuentes financieras y de dimensión) ─────
    per_q = await db.execute(text("""
        SELECT DISTINCT periodo FROM mv_resumen_anual ORDER BY periodo DESC
    """))
    periodos_disponibles = [r[0] for r in per_q.fetchall()]

    # ── Financiero por RBD ────────────────────────────────────────────────────
    fin_q = await db.execute(text("""
        SELECT
            er.rbd,
            eo.nom_rbd,
            SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%INGRESO%'
                     AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                     AND er.cuenta_alias_padre LIKE '3%'
                     THEN er.monto_declarado ELSE 0 END) AS ingreso,
            SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
                     AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                     THEN er.monto_declarado ELSE 0 END) AS gasto,
            SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%INGRESO%'
                     AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                     AND er.cuenta_alias_padre LIKE '3%'
                     THEN er.monto_declarado
                     WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
                     AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                     THEN -er.monto_declarado ELSE 0 END) AS superavit
        FROM estado_resultado er
        JOIN dim_establecimiento_oficial eo ON eo.rbd = er.rbd AND eo.agno = er.periodo
        WHERE er.sost_id = :sid
          AND er.periodo = :per
        GROUP BY er.rbd, eo.nom_rbd
        ORDER BY ingreso DESC
    """), {"sid": sost_id, "per": periodo})
    financiero_rbd = [dict(r) for r in fin_q.mappings()]

    # ── Remuneraciones por RBD ────────────────────────────────────────────────
    rem_q = await db.execute(text("""
        SELECT
            r.rbd,
            eo.nom_rbd,
            COUNT(DISTINCT r.rut) AS funcionarios,
            SUM(r.liquido) AS total_liquido,
            ROUND(AVG(r.liquido), 0) AS promedio_liquido
        FROM remuneraciones r
        JOIN dim_establecimiento_oficial eo ON eo.rbd = r.rbd AND eo.agno = r.anio
        WHERE r.sostenedor = :sid
          AND r.anio = :per
        GROUP BY r.rbd, eo.nom_rbd
        ORDER BY total_liquido DESC
    """), {"sid": sost_id, "per": periodo})
    remuneraciones_rbd = [dict(r) for r in rem_q.mappings()]

    # ── Eficiencia del gasto por RBD ──────────────────────────────────────────
    ef_q = await db.execute(text("""
        SELECT
            er.rbd,
            eo.nom_rbd,
            SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                  AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
            ) AS total_gasto,
            ROUND(100.0 * SUM(er.monto_declarado) FILTER (
                    WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                      AND er.cuenta_alias LIKE '410%'
                ) / NULLIF(SUM(er.monto_declarado) FILTER (
                    WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                      AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
                ), 0), 1) AS pct_aula,
            ROUND(100.0 * SUM(er.monto_declarado) FILTER (
                    WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                      AND er.cuenta_alias LIKE '411%'
                ) / NULLIF(SUM(er.monto_declarado) FILTER (
                    WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                      AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
                ), 0), 1) AS pct_admin,
            ROUND(100.0 * SUM(er.monto_declarado) FILTER (
                    WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                      AND er.cuenta_alias LIKE '700%'
                ) / NULLIF(SUM(er.monto_declarado) FILTER (
                    WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                      AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
                ), 0), 1) AS pct_otros
        FROM estado_resultado er
        JOIN dim_establecimiento_oficial eo ON eo.rbd = er.rbd AND eo.agno = er.periodo
        WHERE er.sost_id = :sid
          AND er.periodo = :per
        GROUP BY er.rbd, eo.nom_rbd
        HAVING SUM(er.monto_declarado) FILTER (
            WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
              AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
        ) > 0
        ORDER BY total_gasto DESC
    """), {"sid": sost_id, "per": periodo})
    eficiencia_raw = [dict(r) for r in ef_q.mappings()]

    eficiencia_rbd = []
    for row in eficiencia_raw:
        pct = float(row.get("pct_admin") or 0)
        nivel = "Elevado" if pct > 25 else ("Moderado" if pct > 15 else "Optimo")
        eficiencia_rbd.append({**row, "nivel_eficiencia": nivel})

    # ── Acreditación de saldos por RBD ────────────────────────────────────────
    acred_q = await db.execute(text("""
        SELECT
            er.rbd,
            eo.nom_rbd,
            COALESCE(docs.total_docs, 0) AS total_docs,
            SUM(er.monto_declarado) AS monto_total,
            COALESCE(SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
            ), 0) AS monto_rendido,
            COALESCE(SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) != 'RENDIDO'
            ), 0) AS monto_no_rendido,
            ROUND(100.0 * COALESCE(SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
            ), 0) / NULLIF(SUM(er.monto_declarado), 0), 1) AS pct_rendido,
            ROUND(100.0 * COALESCE(SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) != 'RENDIDO'
            ), 0) / NULLIF(SUM(er.monto_declarado), 0), 1) AS pct_no_rendido
        FROM estado_resultado er
        JOIN dim_establecimiento_oficial eo ON eo.rbd = er.rbd AND eo.agno = er.periodo
        LEFT JOIN (
            SELECT rbd, COUNT(*) AS total_docs
            FROM documentos
            WHERE sost_id = :sid
              AND periodo = :per
            GROUP BY rbd
        ) docs ON docs.rbd = er.rbd
        WHERE er.sost_id = :sid
          AND er.periodo = :per
        GROUP BY er.rbd, eo.nom_rbd, docs.total_docs
        HAVING SUM(er.monto_declarado) > 0
        ORDER BY pct_rendido ASC NULLS LAST
    """), {"sid": sost_id, "per": periodo})
    acred_raw = [dict(r) for r in acred_q.mappings()]

    acreditacion_rbd = []
    for row in acred_raw:
        pct = float(row.get("pct_rendido") or 0)
        nivel = "Riesgo Bajo" if pct >= 90 else ("Riesgo Moderado" if pct >= 70 else "Riesgo Alto")
        acreditacion_rbd.append({**row, "nivel_riesgo": nivel})

    return {
        "financiero_rbd": financiero_rbd,
        "remuneraciones_rbd": remuneraciones_rbd,
        "eficiencia_rbd": eficiencia_rbd,
        "acreditacion_rbd": acreditacion_rbd,
        "periodos_disponibles": periodos_disponibles,
    }


# ── Ficha Establecimiento (rol: establecimiento) ─────────────────────────────

@router.get("/ficha-sostenedor/territorio")
async def ficha_sostenedor_territorio(
    sost_id: int = Query(...),
    periodo: int = Query(default=2024),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Datos de Territorio para un sostenedor específico.
    Combina dim_ive con dim_establecimiento_oficial para mostrar
    IVE por establecimiento, distribución por nivel, ruralidad y comuna.
    """

    # ── Períodos disponibles (IVE + dim_establecimiento) ────────────────────
    per_q = await db.execute(text("""
        SELECT DISTINCT ive.periodo
        FROM dim_ive ive
        JOIN dim_establecimiento_oficial eo ON eo.rbd = ive.rbd AND eo.agno = ive.periodo
        WHERE eo.rut_sostenedor = :sid
        ORDER BY ive.periodo DESC
    """), {"sid": sost_id})
    periodos_disponibles = [r[0] for r in per_q.fetchall()]

    # Usar el período más cercano disponible si el solicitado no existe
    agno = periodo if periodo in periodos_disponibles else (periodos_disponibles[0] if periodos_disponibles else periodo)

    # ── Lista de establecimientos con IVE ────────────────────────────────────
    ee_q = await db.execute(text("""
        SELECT
            ive.rbd,
            ive.nom_establecimiento,
            ive.nivel,
            ive.nom_region,
            ive.nom_provincia,
            ive.nom_comuna,
            ive.nom_ruralidad,
            ive.nom_tipo_dependencia,
            ive.primera_prioridad,
            ive.segunda_prioridad,
            ive.tercera_prioridad,
            ive.no_priorizado,
            ive.sin_informacion,
            ive.total_matricula,
            ROUND(CAST(ive.ive_sinae AS NUMERIC), 4) AS ive_sinae,
            eo.rural_rbd,
            eo.convenio_pie,
            eo.pace
        FROM dim_ive ive
        JOIN dim_establecimiento_oficial eo ON eo.rbd = ive.rbd AND eo.agno = ive.periodo
        WHERE eo.rut_sostenedor = :sid
          AND ive.periodo = :agno
        ORDER BY ive.ive_sinae DESC NULLS LAST, ive.nom_establecimiento
    """), {"sid": sost_id, "agno": agno})
    ive_establecimientos = [dict(r) for r in ee_q.mappings()]

    # Convertir Decimal a float
    for row in ive_establecimientos:
        if row.get("ive_sinae") is not None:
            row["ive_sinae"] = float(row["ive_sinae"])

    # ── Resumen estadístico ──────────────────────────────────────────────────
    total_ee = len(ive_establecimientos)
    total_mat = sum(r.get("total_matricula") or 0 for r in ive_establecimientos)
    ives = [r["ive_sinae"] for r in ive_establecimientos if r.get("ive_sinae") is not None]
    prom_ive = round(sum(ives) / len(ives), 4) if ives else 0

    # Distribución por nivel
    por_nivel: dict[str, dict] = {}
    for r in ive_establecimientos:
        nv = r.get("nivel") or "Sin info"
        if nv not in por_nivel:
            por_nivel[nv] = {"nivel": nv, "n_establecimientos": 0, "total_matricula": 0, "ive_promedio": []}
        por_nivel[nv]["n_establecimientos"] += 1
        por_nivel[nv]["total_matricula"] += r.get("total_matricula") or 0
        if r.get("ive_sinae") is not None:
            por_nivel[nv]["ive_promedio"].append(r["ive_sinae"])

    nivel_resumen = []
    for nv, d in por_nivel.items():
        prom = round(sum(d["ive_promedio"]) / len(d["ive_promedio"]), 4) if d["ive_promedio"] else 0
        nivel_resumen.append({
            "nivel": nv,
            "n_establecimientos": d["n_establecimientos"],
            "total_matricula": d["total_matricula"],
            "ive_promedio": prom,
        })

    # Distribución por ruralidad
    por_ruralidad: dict[str, int] = {}
    for r in ive_establecimientos:
        rural = r.get("nom_ruralidad") or "Sin info"
        por_ruralidad[rural] = por_ruralidad.get(rural, 0) + 1

    # Distribución por comuna (agrupado, promedio IVE y total matrícula)
    por_comuna_map: dict[str, dict] = {}
    for r in ive_establecimientos:
        com = r.get("nom_comuna") or "Sin info"
        if com not in por_comuna_map:
            por_comuna_map[com] = {"nom_comuna": com, "n_establecimientos": 0, "total_matricula": 0, "ive_vals": []}
        por_comuna_map[com]["n_establecimientos"] += 1
        por_comuna_map[com]["total_matricula"] += r.get("total_matricula") or 0
        if r.get("ive_sinae") is not None:
            por_comuna_map[com]["ive_vals"].append(r["ive_sinae"])

    por_comuna = []
    for com, d in por_comuna_map.items():
        prom = round(sum(d["ive_vals"]) / len(d["ive_vals"]), 4) if d["ive_vals"] else 0
        por_comuna.append({
            "nom_comuna": com,
            "n_establecimientos": d["n_establecimientos"],
            "total_matricula": d["total_matricula"],
            "ive_promedio": prom,
        })
    por_comuna.sort(key=lambda x: x["ive_promedio"], reverse=True)

    # Distribución de prioridades (suma total)
    total_1p = sum(r.get("primera_prioridad") or 0 for r in ive_establecimientos)
    total_2p = sum(r.get("segunda_prioridad") or 0 for r in ive_establecimientos)
    total_3p = sum(r.get("tercera_prioridad") or 0 for r in ive_establecimientos)
    total_np = sum(r.get("no_priorizado") or 0 for r in ive_establecimientos)
    total_si = sum(r.get("sin_informacion") or 0 for r in ive_establecimientos)

    return {
        "ive_establecimientos": ive_establecimientos,
        "nivel_resumen": nivel_resumen,
        "por_ruralidad": [{"nom_ruralidad": k, "n_establecimientos": v} for k, v in por_ruralidad.items()],
        "por_comuna": por_comuna,
        "total_establecimientos": total_ee,
        "total_matricula": total_mat,
        "ive_promedio": prom_ive,
        "prioridades": {
            "primera": total_1p,
            "segunda": total_2p,
            "tercera": total_3p,
            "no_priorizado": total_np,
            "sin_informacion": total_si,
        },
        "periodos_disponibles": periodos_disponibles,
        "periodo_usado": agno,
    }


@router.get("/ficha-sostenedor/gasto-educativo")
async def ficha_sostenedor_gasto_educativo(
    sost_id: int = Query(...),
    periodo: int = Query(default=2024),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Datos de Gasto Educativo para un sostenedor.
    Utiliza la tabla documentos agrupada por nombre_rbd para manejar
    casos donde el rbd no está asignado (ej. Administración Central).
    """
    
    # ── Gasto por Establecimiento / Centro de costo ───────────────────────────
    q_ee = await db.execute(text("""
        SELECT 
            d.rbd, 
            d.nombre_rbd, 
            SUM(d.monto_declarado) as total_gasto,
            COUNT(d.id) as num_documentos,
            eo.estado_estab, 
            eo.matricula,
            eo.rural_rbd,
            eo.cod_com_rbd,
            eo.nom_com_rbd
        FROM documentos d
        LEFT JOIN dim_establecimiento_oficial eo ON eo.rbd = d.rbd AND eo.agno = d.periodo
        WHERE d.sost_id = :sid AND d.periodo = :agno
        GROUP BY d.rbd, d.nombre_rbd, eo.estado_estab, eo.matricula, eo.rural_rbd, eo.cod_com_rbd, eo.nom_com_rbd
        ORDER BY total_gasto DESC NULLS LAST
    """), {"sid": sost_id, "agno": periodo})
    
    gasto_establecimientos = []
    for r in q_ee.mappings():
        row_dict = dict(r)
        if row_dict.get("total_gasto") is not None:
            row_dict["total_gasto"] = float(row_dict["total_gasto"])
        gasto_establecimientos.append(row_dict)

    # ── Gasto por Cuenta Padre ────────────────────────────────────────────────
    q_cuenta = await db.execute(text("""
        SELECT 
            COALESCE(desc_cuenta_padre, 'SIN INFORMACIÓN') as categoria, 
            SUM(monto_declarado) as total_gasto
        FROM documentos
        WHERE sost_id = :sid AND periodo = :agno
        GROUP BY COALESCE(desc_cuenta_padre, 'SIN INFORMACIÓN')
        ORDER BY total_gasto DESC NULLS LAST
    """), {"sid": sost_id, "agno": periodo})
    
    gasto_por_cuenta = []
    for r in q_cuenta.mappings():
        row_dict = dict(r)
        if row_dict.get("total_gasto") is not None:
            row_dict["total_gasto"] = float(row_dict["total_gasto"])
        gasto_por_cuenta.append(row_dict)

    # ── Resumen ───────────────────────────────────────────────────────────────
    total_gasto = sum(r.get("total_gasto") or 0 for r in gasto_establecimientos)
    total_docs = sum(r.get("num_documentos") or 0 for r in gasto_establecimientos)
    total_centros = len(gasto_establecimientos)

    return {
        "gasto_establecimientos": gasto_establecimientos,
        "gasto_por_cuenta": gasto_por_cuenta,
        "resumen": {
            "total_gasto": total_gasto,
            "total_documentos": total_docs,
            "total_centros": total_centros
        },
        "periodo_usado": periodo
    }

@router.get("/ficha-sostenedor/costo-alumno")
async def ficha_sostenedor_costo_alumno(
    sost_id: int = Query(...),
    periodo: int = Query(default=2024),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Datos de Costo por Alumno (Eficiencia).
    Excluye registros sin RBD y cruza con matrícula.
    Divide el gasto en Docencia y Operacional.
    """
    query = await db.execute(text("""
        WITH gastos AS (
            SELECT 
                d.rbd,
                d.nombre_rbd,
                SUM(d.monto_declarado) as total_gasto,
                SUM(CASE WHEN d.desc_cuenta_padre IN (
                    'GASTOS EN EQUIPAMIENTO DE APOYO PEDAGÓGICO', 
                    'GASTOS EN RECURSOS DE APRENDIZAJE', 
                    'OTROS GASTOS EN PERSONAL', 
                    'GASTOS EN ALUMNOS', 
                    'GASTOS BIENESTAR ALUMNOS',
                    'ASESORÍA TÉCNICA Y ACTIVIDADES DE INFORMACIÓN Y ORIENTACIÓN'
                ) THEN d.monto_declarado ELSE 0 END) as gasto_docencia,
                SUM(CASE WHEN d.desc_cuenta_padre NOT IN (
                    'GASTOS EN EQUIPAMIENTO DE APOYO PEDAGÓGICO', 
                    'GASTOS EN RECURSOS DE APRENDIZAJE', 
                    'OTROS GASTOS EN PERSONAL', 
                    'GASTOS EN ALUMNOS', 
                    'GASTOS BIENESTAR ALUMNOS',
                    'ASESORÍA TÉCNICA Y ACTIVIDADES DE INFORMACIÓN Y ORIENTACIÓN'
                ) THEN d.monto_declarado ELSE 0 END) as gasto_operacional
            FROM documentos d
            WHERE d.sost_id = :sid AND d.periodo = :agno AND d.rbd IS NOT NULL
            GROUP BY d.rbd, d.nombre_rbd
        )
        SELECT 
            g.rbd,
            g.nombre_rbd,
            g.total_gasto,
            g.gasto_docencia,
            g.gasto_operacional,
            eo.mat_total,
            CASE WHEN eo.mat_total > 0 THEN g.total_gasto / eo.mat_total ELSE 0 END as costo_por_alumno
        FROM gastos g
        LEFT JOIN dim_establecimiento_oficial eo ON g.rbd = eo.rbd AND eo.agno = :agno
        ORDER BY costo_por_alumno DESC NULLS LAST
    """), {"sid": sost_id, "agno": periodo})

    costo_establecimientos = []
    total_gasto = 0
    total_docencia = 0
    total_operacional = 0
    total_matricula_evaluada = 0

    for r in query.mappings():
        row_dict = dict(r)
        
        # Parse to float
        for k in ["total_gasto", "gasto_docencia", "gasto_operacional", "costo_por_alumno"]:
            if row_dict.get(k) is not None:
                row_dict[k] = float(row_dict[k])
                
        costo_establecimientos.append(row_dict)
        
        total_gasto += row_dict.get("total_gasto") or 0
        total_docencia += row_dict.get("gasto_docencia") or 0
        total_operacional += row_dict.get("gasto_operacional") or 0
        total_matricula_evaluada += row_dict.get("mat_total") or 0

    costo_promedio_general = total_gasto / total_matricula_evaluada if total_matricula_evaluada > 0 else 0

    return {
        "costo_establecimientos": costo_establecimientos,
        "resumen": {
            "total_gasto": total_gasto,
            "total_docencia": total_docencia,
            "total_operacional": total_operacional,
            "total_matricula_evaluada": total_matricula_evaluada,
            "costo_promedio_general": costo_promedio_general
        }
    }


@router.get("/ficha-sostenedor/gasto-administrativo")
async def ficha_sostenedor_gasto_administrativo(
    sost_id: int = Query(...),
    periodo: int = Query(default=2024),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Datos de Gasto Administrativo / Remuneraciones (Eficiencia).
    Usa la tabla remuneraciones filtrando cuenta_alias LIKE '4101%'.
    Agrupa por RBD y FUN.
    """
    # 1. Gasto por establecimiento y desglosado por las principales funciones
    q_ee = await db.execute(text("""
        WITH base AS (
            SELECT 
                r.rbd,
                eo.nom_rbd,
                SUM(r.monto) as total_gasto,
                SUM(CASE WHEN r.fun = 'DOCAUL' THEN r.monto ELSE 0 END) as gasto_docaul,
                SUM(CASE WHEN r.fun = 'ASIPAR' THEN r.monto ELSE 0 END) as gasto_asipar,
                SUM(CASE WHEN r.fun = 'DOCDIR' THEN r.monto ELSE 0 END) as gasto_docdir,
                SUM(CASE WHEN r.fun NOT IN ('DOCAUL', 'ASIPAR', 'DOCDIR') THEN r.monto ELSE 0 END) as gasto_otros
            FROM remuneraciones r
            LEFT JOIN dim_establecimiento_oficial eo ON r.rbd = eo.rbd AND eo.agno = :agno
            WHERE r.sostenedor = :sid AND r.anio = :agno AND r.cuenta_alias LIKE '4101%'
            GROUP BY r.rbd, eo.nom_rbd
        )
        SELECT * FROM base ORDER BY total_gasto DESC NULLS LAST
    """), {"sid": sost_id, "agno": periodo})

    gasto_por_establecimiento = []
    for r in q_ee.mappings():
        d = dict(r)
        if not d.get("rbd"):
            d["nom_rbd"] = "ADMINISTRACIÓN CENTRAL"
        for k in ["total_gasto", "gasto_docaul", "gasto_asipar", "gasto_docdir", "gasto_otros"]:
            if d.get(k) is not None:
                d[k] = float(d[k])
        gasto_por_establecimiento.append(d)

    # 2. Gasto total por Función (Top 10)
    q_fun = await db.execute(text("""
        SELECT 
            COALESCE('(' || df.dependencia_funcion || ') ' || df.descripcion, r.fun, 'SIN FUN') as fun, 
            SUM(r.monto) as total
        FROM remuneraciones r
        LEFT JOIN dim_funcion df ON r.fun = df.abrev
        WHERE r.sostenedor = :sid AND r.anio = :agno AND r.cuenta_alias LIKE '4101%'
        GROUP BY COALESCE('(' || df.dependencia_funcion || ') ' || df.descripcion, r.fun, 'SIN FUN')
        ORDER BY total DESC
        LIMIT 10
    """), {"sid": sost_id, "agno": periodo})
    
    gasto_por_funcion = []
    for r in q_fun.mappings():
        d = dict(r)
        if d.get("total") is not None:
            d["total"] = float(d["total"])
        gasto_por_funcion.append(d)

    # 3. Gasto por Cuenta (Top 10)
    q_cuenta = await db.execute(text("""
        SELECT 
            COALESCE(dc.desc_cuenta, r.cuenta_alias) as cuenta_alias, 
            SUM(r.monto) as total
        FROM remuneraciones r
        LEFT JOIN dim_cuenta dc ON r.cuenta_alias = dc.cuenta_alias
        WHERE r.sostenedor = :sid AND r.anio = :agno AND r.cuenta_alias LIKE '4101%'
        GROUP BY COALESCE(dc.desc_cuenta, r.cuenta_alias)
        ORDER BY total DESC
        LIMIT 10
    """), {"sid": sost_id, "agno": periodo})

    gasto_por_cuenta = []
    for r in q_cuenta.mappings():
        d = dict(r)
        if d.get("total") is not None:
            d["total"] = float(d["total"])
        gasto_por_cuenta.append(d)

    total_gasto = sum(e.get("total_gasto", 0) for e in gasto_por_establecimiento)
    total_docaul = sum(e.get("gasto_docaul", 0) for e in gasto_por_establecimiento)

    return {
        "gasto_por_establecimiento": gasto_por_establecimiento,
        "gasto_por_funcion": gasto_por_funcion,
        "gasto_por_cuenta": gasto_por_cuenta,
        "resumen": {
            "total_gasto": total_gasto,
            "total_docaul": total_docaul,
            "centros": len(gasto_por_establecimiento)
        }
    }


@router.get("/ficha-rbd")

async def ficha_rbd(
    rbd: int = Query(...),
    periodo: int = Query(default=2024),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Perfil de un establecimiento unico. Retorna datos del EE y los periodos disponibles."""
    per_q = await db.execute(text("""
        SELECT DISTINCT agno FROM dim_establecimiento_oficial
        WHERE rbd = :rbd ORDER BY agno DESC
    """), {"rbd": rbd})
    periodos_disponibles = [r[0] for r in per_q.fetchall()]
    agno = periodo if periodo in periodos_disponibles else (periodos_disponibles[0] if periodos_disponibles else periodo)

    perfil_q = await db.execute(text("""
        SELECT rbd, nom_rbd, rut_sostenedor, estado_estab, matricula,
               mat_total, rural_rbd, convenio_pie, pace,
               ens_01, ens_02, ens_03, ens_04, ens_05,
               ens_06, ens_07, ens_08, ens_09, ens_10, ens_11
        FROM dim_establecimiento_oficial
        WHERE rbd = :rbd AND agno = :agno LIMIT 1
    """), {"rbd": rbd, "agno": agno})
    row = perfil_q.mappings().one_or_none()
    if row is None:
        return {"perfil": None, "periodos_disponibles": periodos_disponibles}

    sost_q = await db.execute(text("""
        SELECT nombre_sost FROM dim_sostenedor_oficial
        WHERE rut_sost = :sid AND agno = :agno LIMIT 1
    """), {"sid": row["rut_sostenedor"], "agno": agno})
    sost_row = sost_q.mappings().one_or_none()

    perfil = {
        "rbd": row["rbd"], "nom_rbd": row["nom_rbd"],
        "rut_sostenedor": row["rut_sostenedor"],
        "nombre_sostenedor": sost_row["nombre_sost"] if sost_row else None,
        "estado_estab": row["estado_estab"], "matricula": row["matricula"],
        "mat_total": int(row["mat_total"] or 0),
        "rural_rbd": bool(row["rural_rbd"]), "convenio_pie": bool(row["convenio_pie"]), "pace": bool(row["pace"]),
        "ens_01": row["ens_01"], "ens_02": row["ens_02"], "ens_03": row["ens_03"],
        "ens_04": row["ens_04"], "ens_05": row["ens_05"], "ens_06": row["ens_06"],
        "ens_07": row["ens_07"], "ens_08": row["ens_08"], "ens_09": row["ens_09"],
        "ens_10": row["ens_10"], "ens_11": row["ens_11"], "agno": int(agno),
    }
    return {"perfil": perfil, "periodos_disponibles": periodos_disponibles}


@router.get("/ficha-rbd/detalle")
async def ficha_rbd_detalle(
    rbd: int = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Serie temporal de financiero, eficiencia y acreditacion para un RBD."""

    fin_q = await db.execute(text("""
        SELECT er.periodo,
            SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%INGRESO%'
                     AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                     AND er.cuenta_alias_padre LIKE '3%'
                     THEN er.monto_declarado ELSE 0 END) AS ingreso,
            SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
                     AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                     THEN er.monto_declarado ELSE 0 END) AS gasto,
            SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%INGRESO%'
                     AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                     AND er.cuenta_alias_padre LIKE '3%'
                     THEN er.monto_declarado
                     WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
                     AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                     THEN -er.monto_declarado ELSE 0 END) AS superavit
        FROM estado_resultado er
        WHERE er.rbd = :rbd
        GROUP BY er.periodo ORDER BY er.periodo
    """), {"rbd": rbd})
    financiero_serie = [dict(r) for r in fin_q.mappings()]

    rem_q = await db.execute(text("""
        SELECT r.anio AS periodo, COUNT(*) AS funcionarios,
               SUM(r.liquido) AS total_liquido,
               ROUND(AVG(r.liquido), 0) AS promedio_liquido
        FROM remuneraciones r WHERE r.rbd = :rbd
        GROUP BY r.anio ORDER BY r.anio
    """), {"rbd": rbd})
    remuneraciones_serie = [dict(r) for r in rem_q.mappings()]

    ef_q = await db.execute(text("""
        SELECT er.periodo,
            SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                  AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
            ) AS total_gasto,
            ROUND(100.0 * SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO' AND er.cuenta_alias LIKE '410%'
            ) / NULLIF(SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO' AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
            ), 0), 1) AS pct_aula,
            ROUND(100.0 * SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO' AND er.cuenta_alias LIKE '411%'
            ) / NULLIF(SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO' AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
            ), 0), 1) AS pct_admin,
            ROUND(100.0 * SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO' AND er.cuenta_alias LIKE '700%'
            ) / NULLIF(SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO' AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
            ), 0), 1) AS pct_otros
        FROM estado_resultado er WHERE er.rbd = :rbd
        GROUP BY er.periodo
        HAVING SUM(er.monto_declarado) FILTER (
            WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
              AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%') > 0
        ORDER BY er.periodo
    """), {"rbd": rbd})
    eficiencia_raw = [dict(r) for r in ef_q.mappings()]
    eficiencia_serie = []
    for row in eficiencia_raw:
        pct = float(row.get("pct_admin") or 0)
        nivel = "Elevado" if pct > 25 else ("Moderado" if pct > 15 else "Optimo")
        eficiencia_serie.append({**row, "nivel_eficiencia": nivel})

    acred_q = await db.execute(text("""
        SELECT er.periodo,
            COALESCE(docs.total_docs, 0) AS total_docs,
            SUM(er.monto_declarado) AS monto_total,
            COALESCE(SUM(er.monto_declarado) FILTER (WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'), 0) AS monto_rendido,
            COALESCE(SUM(er.monto_declarado) FILTER (WHERE UPPER(TRIM(er.desc_estado)) != 'RENDIDO'), 0) AS monto_no_rendido,
            ROUND(100.0 * COALESCE(SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'), 0) / NULLIF(SUM(er.monto_declarado), 0), 1) AS pct_rendido,
            ROUND(100.0 * COALESCE(SUM(er.monto_declarado) FILTER (
                WHERE UPPER(TRIM(er.desc_estado)) != 'RENDIDO'), 0) / NULLIF(SUM(er.monto_declarado), 0), 1) AS pct_no_rendido
        FROM estado_resultado er
        LEFT JOIN (
            SELECT periodo, COUNT(*) AS total_docs FROM documentos WHERE rbd = :rbd GROUP BY periodo
        ) docs ON docs.periodo = er.periodo
        WHERE er.rbd = :rbd
        GROUP BY er.periodo, docs.total_docs
        HAVING SUM(er.monto_declarado) > 0
        ORDER BY er.periodo
    """), {"rbd": rbd})
    acred_raw = [dict(r) for r in acred_q.mappings()]
    acreditacion_serie = []
    for row in acred_raw:
        pct = float(row.get("pct_rendido") or 0)
        nivel = "Riesgo Bajo" if pct >= 90 else ("Riesgo Moderado" if pct >= 70 else "Riesgo Alto")
        acreditacion_serie.append({**row, "nivel_riesgo": nivel})

    return {
        "financiero_serie": financiero_serie,
        "remuneraciones_serie": remuneraciones_serie,
        "eficiencia_serie": eficiencia_serie,
        "acreditacion_serie": acreditacion_serie,
    }


@router.get("/subvencion-rbd")
async def subvencion_rbd(
    rbd: int = Query(...),
    periodo: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Distribucion de subvenciones para un RBD desde tabla documentos."""
    if periodo:
        q = await db.execute(text("""
            SELECT subvencion_alias, SUM(monto_declarado) AS monto_total, COUNT(id) AS n_documentos
            FROM documentos
            WHERE rbd = :rbd AND subvencion_alias IS NOT NULL AND subvencion_alias <> ''
              AND periodo = :p
            GROUP BY subvencion_alias ORDER BY monto_total DESC LIMIT 20
        """), {"rbd": rbd, "p": periodo})
    else:
        q = await db.execute(text("""
            SELECT subvencion_alias, SUM(monto_declarado) AS monto_total, COUNT(id) AS n_documentos
            FROM documentos
            WHERE rbd = :rbd AND subvencion_alias IS NOT NULL AND subvencion_alias <> ''
            GROUP BY subvencion_alias ORDER BY monto_total DESC LIMIT 20
        """), {"rbd": rbd})
    return [dict(r) for r in q.mappings()]


# ── Análisis Rendición — por sostenedor ──────────────────────────────────────

@router.get("/ficha-sostenedor/analisis-rendicion")
async def ficha_sostenedor_analisis_rendicion(
    sost_id: int = Query(...),
    periodo: int = Query(default=2024),
    mes: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Análisis de rendición para un sostenedor.
    Consulta la tabla documentos agrupando monto_declarado por año/mes de
    fecha_documento, desc_cuenta_padre, desc_cuenta, subvencion_alias,
    tipo_docs_alias, desc_libro y rbd.
    El parámetro `periodo` corresponde al año global del header.
    """

    params: dict = {"sid": sost_id, "anio": periodo}
    mes_filter = "AND EXTRACT(MONTH FROM d.fecha_documento) = :mes" if mes else ""
    if mes:
        params["mes"] = mes

    # ── 1. Detalle agrupado ────────────────────────────────────────────────────
    detalle_q = await db.execute(text(f"""
        SELECT
            EXTRACT(YEAR  FROM d.fecha_documento)::int  AS anio,
            EXTRACT(MONTH FROM d.fecha_documento)::int  AS mes,
            d.rbd,
            d.rut_sost,
            COALESCE(d.desc_cuenta_padre, 'Sin información') AS desc_cuenta_padre,
            COALESCE(d.desc_cuenta,       'Sin información') AS desc_cuenta,
            COALESCE(d.subvencion_alias,  'Sin información') AS subvencion_alias,
            COALESCE(d.tipo_docs_alias,   'Sin información') AS tipo_docs_alias,
            COALESCE(d.desc_libro,        'Sin información') AS desc_libro,
            SUM(d.monto_declarado)                           AS monto_declarado,
            COUNT(d.id)                                      AS n_docs
        FROM documentos d
        WHERE d.sost_id = :sid
          AND EXTRACT(YEAR FROM d.fecha_documento) = :anio
          {mes_filter}
        GROUP BY
            EXTRACT(YEAR  FROM d.fecha_documento),
            EXTRACT(MONTH FROM d.fecha_documento),
            d.rbd, d.rut_sost,
            d.desc_cuenta_padre, d.desc_cuenta,
            d.subvencion_alias, d.tipo_docs_alias, d.desc_libro
        ORDER BY monto_declarado DESC NULLS LAST
    """), params)

    detalle_raw = []
    for r in detalle_q.mappings():
        row = dict(r)
        for k in ["monto_declarado"]:
            if row.get(k) is not None:
                row[k] = float(row[k])
        detalle_raw.append(row)

    # ── 2. Serie mensual (monto y n_docs por mes del año seleccionado) ─────────
    serie_q = await db.execute(text(f"""
        SELECT
            EXTRACT(MONTH FROM d.fecha_documento)::int AS mes,
            SUM(d.monto_declarado)                     AS total_monto,
            COUNT(d.id)                                AS n_docs
        FROM documentos d
        WHERE d.sost_id = :sid
          AND EXTRACT(YEAR FROM d.fecha_documento) = :anio
        GROUP BY EXTRACT(MONTH FROM d.fecha_documento)
        ORDER BY mes
    """), {"sid": sost_id, "anio": periodo})

    serie_mensual = []
    for r in serie_q.mappings():
        row = dict(r)
        if row.get("total_monto") is not None:
            row["total_monto"] = float(row["total_monto"])
        serie_mensual.append(row)

    # ── 3. Por cuenta padre ────────────────────────────────────────────────────
    cuenta_q = await db.execute(text(f"""
        SELECT
            COALESCE(desc_cuenta_padre, 'Sin información') AS desc_cuenta_padre,
            SUM(monto_declarado)  AS total_monto,
            COUNT(id)             AS n_docs
        FROM documentos
        WHERE sost_id = :sid
          AND EXTRACT(YEAR FROM fecha_documento) = :anio
          {mes_filter}
        GROUP BY COALESCE(desc_cuenta_padre, 'Sin información')
        ORDER BY total_monto DESC NULLS LAST
    """), params)

    por_cuenta_padre = []
    for r in cuenta_q.mappings():
        row = dict(r)
        if row.get("total_monto") is not None:
            row["total_monto"] = float(row["total_monto"])
        por_cuenta_padre.append(row)

    # ── 4. Por subvención ──────────────────────────────────────────────────────
    subv_q = await db.execute(text(f"""
        SELECT
            COALESCE(subvencion_alias, 'Sin información') AS subvencion_alias,
            SUM(monto_declarado) AS total_monto,
            COUNT(id)            AS n_docs
        FROM documentos
        WHERE sost_id = :sid
          AND EXTRACT(YEAR FROM fecha_documento) = :anio
          {mes_filter}
        GROUP BY COALESCE(subvencion_alias, 'Sin información')
        ORDER BY total_monto DESC NULLS LAST
        LIMIT 15
    """), params)

    por_subvencion = []
    for r in subv_q.mappings():
        row = dict(r)
        if row.get("total_monto") is not None:
            row["total_monto"] = float(row["total_monto"])
        por_subvencion.append(row)

    # ── 5. Por tipo de documento ───────────────────────────────────────────────
    tipo_q = await db.execute(text(f"""
        SELECT
            COALESCE(tipo_docs_alias, 'Sin información') AS tipo_docs_alias,
            SUM(monto_declarado) AS total_monto,
            COUNT(id)            AS n_docs
        FROM documentos
        WHERE sost_id = :sid
          AND EXTRACT(YEAR FROM fecha_documento) = :anio
          {mes_filter}
        GROUP BY COALESCE(tipo_docs_alias, 'Sin información')
        ORDER BY total_monto DESC NULLS LAST
    """), params)

    por_tipo_doc = []
    for r in tipo_q.mappings():
        row = dict(r)
        if row.get("total_monto") is not None:
            row["total_monto"] = float(row["total_monto"])
        por_tipo_doc.append(row)

    # ── 6. Por libro ───────────────────────────────────────────────────────────
    libro_q = await db.execute(text(f"""
        SELECT
            COALESCE(desc_libro, 'Sin información') AS desc_libro,
            SUM(monto_declarado) AS total_monto,
            COUNT(id)            AS n_docs
        FROM documentos
        WHERE sost_id = :sid
          AND EXTRACT(YEAR FROM fecha_documento) = :anio
          {mes_filter}
        GROUP BY COALESCE(desc_libro, 'Sin información')
        ORDER BY total_monto DESC NULLS LAST
    """), params)

    por_libro = []
    for r in libro_q.mappings():
        row = dict(r)
        if row.get("total_monto") is not None:
            row["total_monto"] = float(row["total_monto"])
        por_libro.append(row)

    # ── 7. Años disponibles ────────────────────────────────────────────────────
    anios_q = await db.execute(text("""
        SELECT DISTINCT EXTRACT(YEAR FROM fecha_documento)::int AS anio
        FROM documentos
        WHERE sost_id = :sid
          AND fecha_documento IS NOT NULL
        ORDER BY anio DESC
    """), {"sid": sost_id})
    anios_disponibles = [r[0] for r in anios_q.fetchall()]

    # ── 8. Resumen ─────────────────────────────────────────────────────────────
    total_monto = sum(r.get("total_monto") or 0 for r in por_cuenta_padre)
    total_docs  = sum(r.get("n_docs")      or 0 for r in por_cuenta_padre)
    n_rbd       = len(set(r.get("rbd") for r in detalle_raw if r.get("rbd") is not None))

    return {
        "detalle":          detalle_raw,
        "serie_mensual":    serie_mensual,
        "por_cuenta_padre": por_cuenta_padre,
        "por_subvencion":   por_subvencion,
        "por_tipo_doc":     por_tipo_doc,
        "por_libro":        por_libro,
        "resumen": {
            "total_monto":       total_monto,
            "total_docs":        total_docs,
            "n_rbd":             n_rbd,
            "anios_disponibles": anios_disponibles,
            "periodo_usado":     periodo,
            "mes_usado":         mes,
        },
    }


# ── SNED Sostenedor — cruce SNED + Financiero por Establecimiento ───────────

@router.get("/sned-sostenedor")
async def sned_sostenedor(
    sost_id: int = Query(...),
    periodo: int = Query(2024),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Cruza datos SNED (Ficha_SNED + Tabla_SNED) con datos financieros
    (estado_resultado) para los establecimientos del sostenedor.

    Los datos SNED son bienales:
      2020 o 2021  → agno_sned = 2020
      2022 o 2023  → agno_sned = 2022
      2024 o 2025  → agno_sned = 2024
    El periodo financiero se usa tal cual.
    """
    # Mapeo año financiero → año SNED
    if periodo <= 2021:
        agno_sned = 2020
    elif periodo <= 2023:
        agno_sned = 2022
    else:
        agno_sned = 2024

    # ── 1. RBDs del sostenedor ───────────────────────────────────────────────
    q_rbds = await db.execute(text("""
        SELECT DISTINCT ON (rbd) rbd, nom_rbd
        FROM dim_establecimiento_oficial
        WHERE rut_sostenedor = :sid
        ORDER BY rbd, agno DESC
    """), {"sid": sost_id})
    rbds_rows = q_rbds.mappings().all()
    rbds_list = [r["rbd"] for r in rbds_rows]
    nom_map = {r["rbd"]: r["nom_rbd"] for r in rbds_rows}

    if not rbds_list:
        return {"ficha": [], "puntajes": [], "financiero": [], "agno_sned": agno_sned, "periodo_fin": periodo}

    # ── 2. Ficha SNED ────────────────────────────────────────────────────────
    q_ficha = await db.execute(text("""
        SELECT nro AS rbd, agno, grupo_homogeneo, posicion_gh,
               n_establecimientos_gh, seleccionado_sned
        FROM "Ficha_SNED"
        WHERE nro = ANY(:rbds) AND agno = :agno
        ORDER BY nro
    """), {"rbds": rbds_list, "agno": agno_sned})
    ficha_rows = [dict(r) for r in q_ficha.mappings()]

    # ── 3. Tabla SNED (puntajes pivot) ───────────────────────────────────────
    # Traemos todas las filas y pivotamos en Python
    q_tabla = await db.execute(text("""
        SELECT nro_establecimiento AS rbd, agno, resultados_sned,
               ind_sned, e, s, i, m, ig, int_val
        FROM "Tabla_SNED"
        WHERE nro_establecimiento = ANY(:rbds) AND agno = :agno
        ORDER BY nro_establecimiento, resultados_sned
    """), {"rbds": rbds_list, "agno": agno_sned})
    tabla_rows = [dict(r) for r in q_tabla.mappings()]

    # Pivot: una fila por RBD con columnas para cada tipo de resultado
    TIPOS = {
        "Puntaje Establecimiento":          "estab",
        "Puntaje Promedio Grupo Homogéneo": "prom_gh",
        "Puntaje Máximo Grupo Homogéneo":   "max_gh",
        "Puntaje Mínimo Grupo Homogéneo":   "min_gh",
        "Ranking dentro del Grupo Homogéneo": "ranking_gh",
    }
    puntajes_pivot = {}
    for row in tabla_rows:
        rbd = row["rbd"]
        tipo_key = TIPOS.get(row["resultados_sned"])
        if tipo_key is None:
            continue
        if rbd not in puntajes_pivot:
            puntajes_pivot[rbd] = {"rbd": rbd}
        for col in ["ind_sned", "e", "s", "i", "m", "ig", "int_val"]:
            puntajes_pivot[rbd][f"{tipo_key}_{col}"] = float(row[col]) if row[col] is not None else None

    puntajes = list(puntajes_pivot.values())

    # ── 4. Datos financieros por RBD ─────────────────────────────────────────
    q_fin = await db.execute(text("""
        SELECT
            rbd,
            SUM(CASE WHEN desc_tipo_cuenta ILIKE '%ingreso%' THEN monto_declarado ELSE 0 END) AS ingreso,
            SUM(CASE WHEN desc_tipo_cuenta ILIKE '%gasto%'   THEN monto_declarado ELSE 0 END) AS gasto
        FROM estado_resultado
        WHERE sost_id = :sid
          AND periodo  = :p
          AND UPPER(TRIM(desc_estado)) = 'RENDIDO'
          AND rbd = ANY(:rbds)
        GROUP BY rbd
    """), {"sid": sost_id, "p": periodo, "rbds": rbds_list})
    fin_rows = {r["rbd"]: dict(r) for r in q_fin.mappings()}

    # ── 5. Combinar todo ─────────────────────────────────────────────────────
    # Mapa ficha por RBD
    ficha_map = {r["rbd"]: r for r in ficha_rows}
    # Mapa puntajes por RBD
    punt_map  = {r["rbd"]: r for r in puntajes}

    resultado = []
    for rbd in rbds_list:
        ficha = ficha_map.get(rbd, {})
        punt  = punt_map.get(rbd, {})
        fin   = fin_rows.get(rbd, {})

        ingreso   = float(fin["ingreso"]) if fin.get("ingreso") else None
        gasto     = float(fin["gasto"])   if fin.get("gasto")   else None
        superavit = (ingreso - gasto)     if ingreso is not None and gasto is not None else None

        # Normalizar estado premiado
        sned_estado = (ficha.get("seleccionado_sned") or "").strip()
        sned_lower = sned_estado.lower()
        # Premiado si contiene "subvención" o ("premiado" sin "no" antes)
        premiado = (
            "subvenci" in sned_lower and "no premiado" not in sned_lower
        ) or (
            "premiado" in sned_lower and not sned_lower.startswith("no") and "no premiado" not in sned_lower
        )

        resultado.append({
            "rbd":                   rbd,
            "nom_rbd":               nom_map.get(rbd, f"RBD {rbd}"),
            "agno_sned":             agno_sned,
            "grupo_homogeneo":       ficha.get("grupo_homogeneo"),
            "posicion_gh":           ficha.get("posicion_gh"),
            "n_establecimientos_gh": ficha.get("n_establecimientos_gh"),
            "seleccionado_sned":     sned_estado or None,
            "premiado":              premiado,
            # Puntaje establecimiento
            "ind_sned":   punt.get("estab_ind_sned"),
            "e":          punt.get("estab_e"),
            "s":          punt.get("estab_s"),
            "i":          punt.get("estab_i"),
            "m":          punt.get("estab_m"),
            "ig":         punt.get("estab_ig"),
            "int_val":    punt.get("estab_int_val"),
            # Promedio del GH
            "prom_gh_ind_sned": punt.get("prom_gh_ind_sned"),
            "prom_gh_e":        punt.get("prom_gh_e"),
            "prom_gh_s":        punt.get("prom_gh_s"),
            "prom_gh_i":        punt.get("prom_gh_i"),
            "prom_gh_m":        punt.get("prom_gh_m"),
            "prom_gh_ig":       punt.get("prom_gh_ig"),
            "prom_gh_int_val":  punt.get("prom_gh_int_val"),
            # Ranking
            "ranking_gh": punt.get("ranking_gh_ind_sned"),
            # Financiero
            "ingreso":    ingreso,
            "gasto":      gasto,
            "superavit":  superavit,
        })

    # ── 6. KPIs globales ─────────────────────────────────────────────────────
    con_sned      = sum(1 for r in resultado if r["ind_sned"] is not None)
    premiados     = sum(1 for r in resultado if r["premiado"])
    sobre_prom    = sum(1 for r in resultado if r["ind_sned"] is not None and r["prom_gh_ind_sned"] is not None and r["ind_sned"] >= r["prom_gh_ind_sned"])
    total_ingreso = sum(r["ingreso"] for r in resultado if r["ingreso"])

    return {
        "establecimientos": resultado,
        "agno_sned":        agno_sned,
        "periodo_fin":      periodo,
        "kpis": {
            "total_ee":       len(rbds_list),
            "con_sned":       con_sned,
            "premiados":      premiados,
            "sobre_prom_gh":  sobre_prom,
            "total_ingreso":  total_ingreso,
        },
    }

# ── Resumen Personalizado — Pins del Sostenedor ─────────────────────────────

from pydantic import BaseModel as PydanticBase
from typing import List as TypingList

class PinsPayload(PydanticBase):
    pins: TypingList[str]

@router.get("/resumen-pins")
async def get_resumen_pins(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna los pins del tab Resumen del usuario actual."""
    result = await db.execute(
        text("SELECT resumen_pins FROM app_users WHERE id = :uid"),
        {"uid": current_user.id},
    )
    row = result.mappings().one_or_none()
    pins = row["resumen_pins"] if row and row["resumen_pins"] is not None else []
    return {"pins": pins}

@router.put("/resumen-pins")
async def save_resumen_pins(
    payload: PinsPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Guarda (reemplaza) la lista de pins del tab Resumen del usuario actual."""
    import json
    await db.execute(
        text(
            "UPDATE app_users SET resumen_pins = :pins::jsonb WHERE id = :uid"
        ),
        {"pins": json.dumps(payload.pins), "uid": current_user.id},
    )
    await db.commit()
    return {"ok": True, "pins": payload.pins}
