from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional

from database import get_db
from auth import get_current_user
from models import User

router = APIRouter(prefix="/sostenibilidad", tags=["sostenibilidad"])

def get_base_filters(prefix="", usar_rbds=False):
    p = f"{prefix}." if prefix else ""
    if usar_rbds:
        return f"""
            WHERE {p}rbd = ANY(:rbds)
              AND (CAST(:rbd_filter AS INTEGER) IS NULL OR {p}rbd = CAST(:rbd_filter AS INTEGER))
              AND (CAST(:cod_ense_filter AS INTEGER) IS NULL OR {p}cod_ense = CAST(:cod_ense_filter AS INTEGER))
              AND (CAST(:cod_espe_filter AS INTEGER) IS NULL OR {p}cod_espe = CAST(:cod_espe_filter AS INTEGER))
        """
    return f"""
        WHERE {p}sost_id = :sost_id
          AND (CAST(:rbd_filter AS INTEGER) IS NULL OR {p}rbd = CAST(:rbd_filter AS INTEGER))
          AND (CAST(:cod_ense_filter AS INTEGER) IS NULL OR {p}cod_ense = CAST(:cod_ense_filter AS INTEGER))
          AND (CAST(:cod_espe_filter AS INTEGER) IS NULL OR {p}cod_espe = CAST(:cod_espe_filter AS INTEGER))
    """

@router.get("/metricas")
async def metricas(
    sost_id: int = Query(...),
    rbd: Optional[int] = None,
    cod_ense: Optional[int] = None,
    cod_espe: Optional[int] = None,
    rbds_contexto: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    usar_rbds = False
    rbds_list = []
    if rbds_contexto:
        try:
            rbds_list = [int(r.strip()) for r in rbds_contexto.split(",") if r.strip()]
            usar_rbds = len(rbds_list) > 0
        except ValueError:
            pass

    filters = get_base_filters(prefix="mv", usar_rbds=usar_rbds)
    query = f"""
    SELECT 
        CAST(ROUND(SUM(mv.matricula)::numeric / NULLIF(COUNT(DISTINCT mv.agno), 0), 0) AS BIGINT) AS matricula_total,
        SUM(mv.registros_asistencia) AS total_registros,
        SUM(mv.sum_tasas_total) AS sum_tasas
    FROM mv_sostenibilidad_riesgo mv
    {filters}
    """
    params = {"sost_id": sost_id, "rbd_filter": rbd, "cod_ense_filter": cod_ense, "cod_espe_filter": cod_espe}
    if usar_rbds:
        params["rbds"] = rbds_list
    res = await db.execute(text(query), params)
    row = res.mappings().one_or_none()
    
    matricula_total = row["matricula_total"] if row and row["matricula_total"] else 0
    total_registros = row["total_registros"] if row and row["total_registros"] else 0
    sum_tasas = row["sum_tasas"] if row and row["sum_tasas"] else 0
    
    amp = (sum_tasas / (total_registros * 10)) * 100 if total_registros > 0 else 0
    tasa_riesgo = max(0, 100 - amp) if amp > 0 else 0

    # Para alerta desproporción necesitamos la evolución
    evo_query = f"""
    SELECT agno, 3 AS mes, SUM(matricula) AS mat, SUM(sum_tasa_3)/NULLIF(SUM(cnt_tasa_3), 0) AS asis FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 4, SUM(matricula), SUM(sum_tasa_4)/NULLIF(SUM(cnt_tasa_4), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 5, SUM(matricula), SUM(sum_tasa_5)/NULLIF(SUM(cnt_tasa_5), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 6, SUM(matricula), SUM(sum_tasa_6)/NULLIF(SUM(cnt_tasa_6), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 7, SUM(matricula), SUM(sum_tasa_7)/NULLIF(SUM(cnt_tasa_7), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 8, SUM(matricula), SUM(sum_tasa_8)/NULLIF(SUM(cnt_tasa_8), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 9, SUM(matricula), SUM(sum_tasa_9)/NULLIF(SUM(cnt_tasa_9), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 10, SUM(matricula), SUM(sum_tasa_10)/NULLIF(SUM(cnt_tasa_10), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 11, SUM(matricula), SUM(sum_tasa_11)/NULLIF(SUM(cnt_tasa_11), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 12, SUM(matricula), SUM(sum_tasa_12)/NULLIF(SUM(cnt_tasa_12), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    ORDER BY agno, mes
    """
    res_evo = await db.execute(text(evo_query), params)
    evo_rows = res_evo.mappings().all()

    alerta_desproporcion = 0
    if len(evo_rows) > 1:
        prev = evo_rows[-2]
        curr = evo_rows[-1]
        var_mat = ((curr["mat"] / prev["mat"]) - 1) * 100 if prev["mat"] else 0
        var_asis = ((curr["asis"] / prev["asis"]) - 1) * 100 if prev["asis"] and curr["asis"] else 0
        alerta_desproporcion = var_mat - var_asis

    return {
        "matricula_total": matricula_total,
        "amp": round(amp, 2),
        "tasa_riesgo": round(tasa_riesgo, 2),
        "alerta_desproporcion": round(alerta_desproporcion, 2)
    }

@router.get("/evolucion")
async def evolucion(
    sost_id: int = Query(...),
    rbd: Optional[int] = None,
    cod_ense: Optional[int] = None,
    cod_espe: Optional[int] = None,
    rbds_contexto: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    usar_rbds = False
    rbds_list = []
    if rbds_contexto:
        try:
            rbds_list = [int(r.strip()) for r in rbds_contexto.split(",") if r.strip()]
            usar_rbds = len(rbds_list) > 0
        except ValueError:
            pass

    filters = get_base_filters(prefix="mv", usar_rbds=usar_rbds)
    evo_query = f"""
    SELECT agno, 3 AS mes, SUM(matricula) AS matricula, SUM(sum_tasa_3)/NULLIF(SUM(cnt_tasa_3), 0) AS asistencia FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 4, SUM(matricula), SUM(sum_tasa_4)/NULLIF(SUM(cnt_tasa_4), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 5, SUM(matricula), SUM(sum_tasa_5)/NULLIF(SUM(cnt_tasa_5), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 6, SUM(matricula), SUM(sum_tasa_6)/NULLIF(SUM(cnt_tasa_6), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 7, SUM(matricula), SUM(sum_tasa_7)/NULLIF(SUM(cnt_tasa_7), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 8, SUM(matricula), SUM(sum_tasa_8)/NULLIF(SUM(cnt_tasa_8), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 9, SUM(matricula), SUM(sum_tasa_9)/NULLIF(SUM(cnt_tasa_9), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 10, SUM(matricula), SUM(sum_tasa_10)/NULLIF(SUM(cnt_tasa_10), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 11, SUM(matricula), SUM(sum_tasa_11)/NULLIF(SUM(cnt_tasa_11), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    UNION ALL SELECT agno, 12, SUM(matricula), SUM(sum_tasa_12)/NULLIF(SUM(cnt_tasa_12), 0) FROM mv_sostenibilidad_riesgo mv {filters} GROUP BY agno
    ORDER BY agno, mes
    """
    params = {"sost_id": sost_id, "rbd_filter": rbd, "cod_ense_filter": cod_ense, "cod_espe_filter": cod_espe}
    if usar_rbds:
        params["rbds"] = rbds_list
    res = await db.execute(text(evo_query), params)
    
    data = []
    for row in res.mappings():
        m = int(row["mes"])
        mes_name = ["Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][m-3]
        data.append({
            "periodo": f"{row['agno']}-{mes_name}",
            "agno": row["agno"],
            "mes": m,
            "matricula": row["matricula"] or 0,
            "asistencia": round(float(row["asistencia"]) * 100, 2) if row["asistencia"] else 0
        })
    return data

@router.get("/ranking")
async def ranking(
    sost_id: int = Query(...),
    rbd: Optional[int] = None,
    cod_ense: Optional[int] = None,
    cod_espe: Optional[int] = None,
    rbds_contexto: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    usar_rbds = False
    rbds_list = []
    if rbds_contexto:
        try:
            rbds_list = [int(r.strip()) for r in rbds_contexto.split(",") if r.strip()]
            usar_rbds = len(rbds_list) > 0
        except ValueError:
            pass

    filters = get_base_filters(prefix="r", usar_rbds=usar_rbds)
    query = f"""
    WITH ranking_base AS (
        SELECT 
            r.rbd,
            MAX(eo.nom_rbd) AS nom_rbd,
            ARRAY_AGG(DISTINCT r.cod_ense) AS ensenanzas,
            ARRAY_AGG(DISTINCT r.cod_espe) AS especialidades,
            CAST(ROUND(SUM(r.matricula)::numeric / NULLIF(COUNT(DISTINCT r.agno), 0), 0) AS BIGINT) AS matricula_total,
            SUM(r.registros_asistencia) AS total_registros,
            SUM(r.sum_tasas_total) AS sum_tasas,
            CASE WHEN MAX(r.sost_id) = :sost_id THEN true ELSE false END as es_propio
        FROM mv_sostenibilidad_riesgo r
        LEFT JOIN (SELECT rbd, MAX(nom_rbd) as nom_rbd FROM dim_establecimiento_oficial GROUP BY rbd) eo ON eo.rbd = r.rbd
        {filters}
        GROUP BY r.rbd
    ),
    ingresos AS (
        SELECT rbd, periodo, SUM(monto_declarado) as total_ingreso
        FROM estado_resultado
        WHERE sost_id = :sost_id
          AND subvencion_alias = 'GENERAL'
          AND cuenta_alias_padre != '500000'
          AND UPPER(desc_tipo_cuenta) = 'INGRESO'
          AND periodo IN (2022, 2023, 2024)
        GROUP BY rbd, periodo
    ),
    asistencia AS (
        SELECT rbd, agno, SUM(tasa_asistencia_anual) as total_asistencia
        FROM dim_asistencia_anual
        WHERE agno IN (2022, 2023, 2024)
        GROUP BY rbd, agno
    )
    SELECT 
        rb.*,
        i22.total_ingreso AS ing_22, i23.total_ingreso AS ing_23, i24.total_ingreso AS ing_24,
        a22.total_asistencia AS asis_22, a23.total_asistencia AS asis_23, a24.total_asistencia AS asis_24
    FROM ranking_base rb
    LEFT JOIN ingresos i22 ON rb.rbd = i22.rbd AND i22.periodo = 2022
    LEFT JOIN ingresos i23 ON rb.rbd = i23.rbd AND i23.periodo = 2023
    LEFT JOIN ingresos i24 ON rb.rbd = i24.rbd AND i24.periodo = 2024
    LEFT JOIN asistencia a22 ON rb.rbd = a22.rbd AND a22.agno = 2022
    LEFT JOIN asistencia a23 ON rb.rbd = a23.rbd AND a23.agno = 2023
    LEFT JOIN asistencia a24 ON rb.rbd = a24.rbd AND a24.agno = 2024
    """
    params = {"sost_id": sost_id, "rbd_filter": rbd, "cod_ense_filter": cod_ense, "cod_espe_filter": cod_espe}
    if usar_rbds:
        params["rbds"] = rbds_list
    res = await db.execute(text(query), params)
    
    def calc_elasticidad(ing_curr, ing_prev, asis_curr, asis_prev):
        if None in (ing_curr, ing_prev, asis_curr, asis_prev):
            return None
        ing_curr, ing_prev = float(ing_curr), float(ing_prev)
        asis_curr, asis_prev = float(asis_curr), float(asis_prev)
        if ing_prev == 0 or asis_prev == 0:
            return None
        var_ing = (ing_curr - ing_prev) / ing_prev
        var_asis = (asis_curr - asis_prev) / asis_prev
        if var_asis == 0:
            return None
        return var_ing / var_asis

    data = []
    for row in res.mappings():
        total_reg = row["total_registros"] or 0
        sum_tasas = row["sum_tasas"] or 0
        amp = (sum_tasas / (total_reg * 10)) * 100 if total_reg > 0 else 0
        tasa_riesgo = max(0, 100 - amp) if amp > 0 else 0
        
        elast_23 = calc_elasticidad(row["ing_23"], row["ing_22"], row["asis_23"], row["asis_22"])
        elast_24 = calc_elasticidad(row["ing_24"], row["ing_23"], row["asis_24"], row["asis_23"])
        
        data.append({
            "rbd": row["rbd"],
            "nom_rbd": row["nom_rbd"] or "Desconocido",
            "ensenanzas": row["ensenanzas"] or [],
            "especialidades": [e for e in (row["especialidades"] or []) if e != 0],
            "matricula": row["matricula_total"],
            "amp": round(amp, 2),
            "tasa_riesgo": round(tasa_riesgo, 2),
            "es_propio": row["es_propio"],
            "ingresos_2023": float(row["ing_23"]) if row["ing_23"] is not None else None,
            "asistencia_2023": float(row["asis_23"]) if row["asis_23"] is not None else None,
            "ingresos_2024": float(row["ing_24"]) if row["ing_24"] is not None else None,
            "asistencia_2024": float(row["asis_24"]) if row["asis_24"] is not None else None,
            "elasticidad_2023": round(elast_23, 2) if elast_23 is not None else None,
            "elasticidad_2024": round(elast_24, 2) if elast_24 is not None else None
        })
        
    data.sort(key=lambda x: x["tasa_riesgo"], reverse=True)
    return data  # Return all, frontend paginates
