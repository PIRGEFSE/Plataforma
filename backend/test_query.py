import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def main():
    engine = create_async_engine("postgresql+asyncpg://pirgefse:pirgefse@localhost/pirgefse")
    query_text = """
        WITH rem AS (
            SELECT rbd,
                   anio AS periodo,
                   SUM(monto) AS gasto_rem
            FROM remuneraciones
            WHERE sostenedor = 69110400
              AND cuenta_alias IN ('410101', '410102', '410104', '410105', '410116', '410119', '410121', '410124', '410128', '410129', '410401', '410402', '410403', '410404', '410304', '410309', '410501', '410803')
            GROUP BY rbd, anio
        ),
        ing AS (
            SELECT rbd,
                   periodo,
                   SUM(monto_declarado) AS ingreso_total
            FROM estado_resultado
            WHERE sost_id = 69110400
              AND desc_tipo_cuenta ILIKE '%ingreso%'
              AND UPPER(TRIM(desc_estado)) = 'RENDIDO'
              AND cuenta_alias_padre LIKE '3%'
            GROUP BY rbd, periodo
        ),
        joined AS (
            SELECT COALESCE(r.rbd, i.rbd) AS rbd,
                   COALESCE(r.periodo, i.periodo) AS periodo,
                   COALESCE(r.gasto_rem, 0) AS gasto_rem,
                   COALESCE(i.ingreso_total, 0) AS ingreso_total
            FROM rem r
            FULL JOIN ing i ON r.rbd IS NOT DISTINCT FROM i.rbd AND r.periodo = i.periodo
            WHERE COALESCE(r.gasto_rem, 0) > 0 OR COALESCE(i.ingreso_total, 0) > 0
        )
        SELECT * FROM joined
    """
    
    try:
        async with engine.connect() as conn:
            q = await conn.execute(text(query_text))
            res = q.mappings().all()
            print(f"Got {len(res)} results.")
            for r in res[:5]:
                print(dict(r))
    except Exception as e:
        print("ERROR:", e)

if __name__ == '__main__':
    asyncio.run(main())
