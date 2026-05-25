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
                     THEN er.monto_declarado ELSE 0 END) AS ingreso,
            SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
                     AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                     THEN er.monto_declarado ELSE 0 END) AS gasto,
            SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%INGRESO%'
                     AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
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
                     THEN er.monto_declarado ELSE 0 END) AS ingreso,
            SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
                     AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
                     THEN er.monto_declarado ELSE 0 END) AS gasto,
            SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%INGRESO%'
                     AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
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
