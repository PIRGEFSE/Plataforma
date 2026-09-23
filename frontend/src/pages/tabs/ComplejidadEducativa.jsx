import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import SqlViewer from '../../components/SqlViewer'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt, KPICard, fmtN } from '../../components/DashboardWidgets'
import { WidgetWrapper } from './FichaSostenedor'

export function RenderComplejidadEducativa({ data, periodo, widgetFilter = null }) {
  const C = useChartColors()
  const { fmtAmt, fmtAxisAmt } = useMoneyFmt()
  const [search, setSearch] = useState('')
  const [nivelFilter, setNivelFilter] = useState('all')
  const [ruralFilter, setRuralFilter] = useState('all')
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 10


  useEffect(() => { setPage(1) }, [search, nivelFilter, ruralFilter, data, periodo])

  if (!data) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗺️</div>
      <p>Sin datos de complejidad disponibles para este período.</p>
    </div>
  )

  const { ive_establecimientos = [], nivel_resumen = [], por_comuna = [], prioridades = {}, financiero_por_rbd = [] } = data

  // Mapa rbd → datos financieros agregados y jerárquicos
  const finMapRaw = {}
  for (const f of financiero_por_rbd) {
    const k = f.rbd
    if (!finMapRaw[k]) {
      finMapRaw[k] = {
        ingreso: 0, gasto: 0,
        tipos: {
          'INGRESO': { total: 0, subvs: {} },
          'GASTO': { total: 0, subvs: {} }
        }
      }
    }

    finMapRaw[k].ingreso += f.ingreso ?? 0
    finMapRaw[k].gasto += f.gasto ?? 0

    const isIngreso = (f.desc_tipo_cuenta || '').toUpperCase().includes('INGRESO')
    const tKey = isIngreso ? 'INGRESO' : 'GASTO'
    const monto = f.monto_declarado ?? (isIngreso ? (f.ingreso ?? 0) : (f.gasto ?? 0))
    const subv = f.subvencion_alias || 'Sin Subvención'
    const cuenta = f.desc_cuenta_padre || 'Sin Cuenta'

    if (monto !== 0) {
      const tNode = finMapRaw[k].tipos[tKey]
      tNode.total += monto

      if (!tNode.subvs[subv]) tNode.subvs[subv] = { total: 0, cuentas: {} }
      tNode.subvs[subv].total += monto

      if (!tNode.subvs[subv].cuentas[cuenta]) tNode.subvs[subv].cuentas[cuenta] = 0
      tNode.subvs[subv].cuentas[cuenta] += monto
    }
  }
  const finMap = finMapRaw

  const filterText = search.toLowerCase().trim()
  const filtered = ive_establecimientos.filter(ee => {
    const matchName = (ee.nom_establecimiento ?? '').toLowerCase().includes(filterText)
    const matchNivel = nivelFilter === 'all' ? true : ee.nivel === nivelFilter
    const matchRural = ruralFilter === 'all' ? true : ruralFilter === 'rural' ? ee.rural_rbd === 1 : ee.rural_rbd !== 1
    return matchName && matchNivel && matchRural
  })

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  const inpSt = { padding: '0.35rem 0.75rem', backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', fontSize: '0.8rem' }
  const pgBtn = (dis) => ({ padding: '0.3rem 0.75rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', background: dis ? 'var(--surface-base)' : 'var(--surface-overlay)', color: dis ? 'var(--text-disabled)' : 'var(--text-primary)', cursor: dis ? 'not-allowed' : 'pointer', fontSize: '0.8rem' })
  const iveColor = (v) => v >= 0.9 ? '#ef4444' : v >= 0.7 ? '#f59e0b' : '#10b981'
  const iveLabel = (v) => v >= 0.9 ? 'Alto' : v >= 0.7 ? 'Medio' : 'Bajo'

  const prom_ive = data.ive_promedio ?? 0
  const total_ee = data.total_establecimientos ?? 0
  const total_mat = data.total_matricula ?? 0
  const altoVuln = ive_establecimientos.filter(e => (e.ive_sinae ?? 0) >= 0.9).length

  const prioData = [
    { name: '1ª Prioridad', value: prioridades.primera ?? 0, color: '#ef4444' },
    { name: '2ª Prioridad', value: prioridades.segunda ?? 0, color: '#f59e0b' },
    { name: '3ª Prioridad', value: prioridades.tercera ?? 0, color: '#facc15' },
    { name: 'No Priorizado', value: prioridades.no_priorizado ?? 0, color: '#10b981' },
    { name: 'Sin Info', value: prioridades.sin_informacion ?? 0, color: 'var(--text-muted)' },
  ]
  const prioOption = {
    aria: { decal: { show: true } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip },
    legend: { data: prioData.map(d => d.name), textStyle: { color: C.axisLabel, fontSize: 10 }, top: 0 },
    grid: { left: 20, right: 20, top: 40, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtN(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: ['Consolidado'], axisLabel: { color: C.axisLabel, fontSize: 11 } },
    series: prioData.map(d => ({ name: d.name, type: 'bar', stack: 'prio', barMaxWidth: 40, data: [d.value], itemStyle: { color: d.color }, label: { show: d.value > 0, position: 'inside', formatter: p => fmtN(p.value), fontSize: 10, color: '#fff', fontWeight: 600 } })),
    backgroundColor: 'transparent',
  }

  // ── Nuevos gráficos IVE × Financiero ──────────────────────────────────────
  // Solo establecimientos con IVE y datos financieros disponibles
  const iveFinData = ive_establecimientos
    .filter(e => e.ive_sinae != null && finMap[e.rbd])
    .map(e => ({ ...e, ingreso: finMap[e.rbd]?.ingreso ?? 0, gasto: finMap[e.rbd]?.gasto ?? 0 }))

  const scatterIveFinOption = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'item', ...C.tooltip,
      formatter: p => {
        const d = p.data
        return `<b>${d[3]}</b> (${d[4]})<br/>IVE: <b style="color:${iveColor(d[0])}">${(d[0] * 100).toFixed(1)}%</b><br/>Ingreso: <b style="color:#10b981">${fmtAmt(d[1])}</b><br/>Gasto: <b style="color:#ef4444">${fmtAmt(d[2])}</b><br/>Nivel: ${d[5]}`
      }
    },
    legend: { data: ['BASICA', 'MEDIA'], textStyle: { color: C.axisLabel, fontSize: 10 }, top: 0 },
    grid: { left: 70, right: 20, top: 40, bottom: 50 },
    xAxis: { type: 'value', name: 'IVE SINAE', nameLocation: 'middle', nameGap: 30, min: 0, max: 1, axisLabel: { color: C.axisLabel, formatter: v => `${(v * 100).toFixed(0)}%` }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'value', name: 'Ingreso', nameLocation: 'middle', nameGap: 60, axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: ['BASICA', 'MEDIA'].map(nv => ({
      name: nv,
      type: 'scatter',
      symbolSize: d => Math.max(8, Math.min(28, Math.sqrt((d[6] ?? 100) / 4))),
      data: iveFinData.filter(e => e.nivel === nv).map(e => [e.ive_sinae, e.ingreso, e.gasto, e.nom_establecimiento, e.rbd, e.nivel, e.total_matricula ?? 100]),
      itemStyle: { color: nv === 'BASICA' ? '#60a5fa' : '#34d399', opacity: 0.75 },
      emphasis: { scale: 1.4 }
    })),
    backgroundColor: 'transparent',
  }

  const sqlStr = `SELECT
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
    eo.pace,
    fin.ingreso,
    fin.gasto,
    fin.desc_tipo_cuenta,
    fin.subvencion_alias,
    fin.cuenta_alias_padre,
    fin.desc_cuenta_padre
FROM dim_ive ive
JOIN dim_establecimiento_oficial eo ON eo.rbd = ive.rbd AND eo.agno = ive.periodo
LEFT JOIN (
    SELECT
        er.rbd,
        er.cuenta_alias_padre,
        er.desc_cuenta_padre,
        er.desc_tipo_cuenta,
        er.subvencion_alias,
        SUM(er.monto_declarado) AS monto_declarado,
        SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%INGRESO%'
                 THEN er.monto_declarado ELSE 0 END) AS ingreso,
        SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
                 THEN er.monto_declarado ELSE 0 END) AS gasto
    FROM estado_resultado er
    WHERE er.sost_id = :sid
      AND er.periodo  = :agno
      AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
      AND er.monto_declarado <> 0
    GROUP BY
        er.rbd, er.cuenta_alias_padre, er.desc_cuenta_padre,
        er.desc_tipo_cuenta, er.subvencion_alias
) fin ON fin.rbd = ive.rbd
WHERE eo.rut_sostenedor = :sid
  AND ive.periodo = :agno
ORDER BY ive.ive_sinae DESC NULLS LAST, ive.nom_establecimiento`

  // ── Early return para el tab Resumen (solo fragmento específico) ─────────────
  if (widgetFilter === 'te_complejidad_prioridades') {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Distribución de Prioridades de Vulnerabilidad — {periodo}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.75rem' }}>Suma total de alumnos por categoría de prioridad IVE-SINAE.</p>
        <ReactECharts option={prioOption} style={{ height: 100 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
          {prioData.map(p => (
            <div key={p.name} style={{ textAlign: 'center', background: 'var(--surface-overlay)', borderRadius: '0.5rem', padding: '0.6rem', border: '1px solid var(--line-subtle)' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: p.color }}>{fmtN(p.value)}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{p.name}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (widgetFilter === 'te_complejidad_scatter') {
    return (
      <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="chart-title">IVE vs Ingreso por Establecimiento — {periodo}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
          Relación entre vulnerabilidad educativa (IVE SINAE) e ingresos rendidos. Tamaño proporcional a matrícula.
          <span style={{ marginLeft: 12, color: '#60a5fa' }}>● Básica</span>
          <span style={{ marginLeft: 8, color: '#34d399' }}>● Media</span>
        </p>
        {iveFinData.length === 0
          ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos financieros cruzados para este período.</p>
          : <ReactECharts option={scatterIveFinOption} style={{ height: Math.max(320, iveFinData.length * 6 + 100) }} />
        }
      </div>
    )
  }

  return (
    <>
      <SqlViewer sql={sqlStr} />

      {/* Nota metodológica */}
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> Análisis de vulnerabilidad basado en el Índice de Vulnerabilidad Escolar (IVE), concentración de estudiantes prioritarios y matrícula total.
      </div>

      {/* Indicadores */}

      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="🗺️" label="Establec. con IVE" value={fmtN(total_ee)} color="#6366f1" />
        <KPICard icon="📊" label="IVE Promedio" value={`${(prom_ive * 100).toFixed(1)}%`} color={iveColor(prom_ive)} sub={iveLabel(prom_ive) + ' vulnerabilidad'} />
        <KPICard icon="🔴" label="IVE Alto (≥90%)" value={fmtN(altoVuln)} color="#ef4444" sub="establecimientos" />
        <KPICard icon="👨‍🎓" label="Matrícula Total" value={fmtN(total_mat)} color="#10b981" />
      </div>

      <WidgetWrapper widgetKey="te_complejidad_prioridades">
        <div className="chart-card">
          <h3 className="chart-title">Distribución de Prioridades de Vulnerabilidad — {periodo}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.75rem' }}>Suma total de alumnos por categoría de prioridad IVE-SINAE.</p>
          <ReactECharts option={prioOption} style={{ height: 100 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
            {prioData.map(p => (
              <div key={p.name} style={{ textAlign: 'center', background: 'var(--surface-overlay)', borderRadius: '0.5rem', padding: '0.6rem', border: '1px solid var(--line-subtle)' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: p.color }}>{fmtN(p.value)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      </WidgetWrapper>

      <WidgetWrapper widgetKey="te_complejidad_scatter">
        <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="chart-title">IVE vs Ingreso por Establecimiento — {periodo}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
            Relación entre vulnerabilidad educativa (IVE SINAE) e ingresos rendidos. El tamaño del punto es proporcional a la matrícula.
            <span style={{ marginLeft: 12, color: '#60a5fa' }}>● Básica</span>
            <span style={{ marginLeft: 8, color: '#34d399' }}>● Media</span>
          </p>
          {iveFinData.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos financieros cruzados para este período.</p>
            : <ReactECharts option={scatterIveFinOption} style={{ height: Math.max(320, iveFinData.length * 6 + 100) }} />
          }
        </div>
      </WidgetWrapper>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Buscar por nombre de establecimiento..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inpSt, minWidth: 240 }} />
        {search && <button onClick={() => setSearch('')} style={pgBtn(false)}>✕ Limpiar</button>}
        <select value={nivelFilter} onChange={e => setNivelFilter(e.target.value)} style={inpSt}>
          <option value="all">Nivel: Todos</option>
          <option value="BASICA">Básica</option>
          <option value="MEDIA">Media</option>
        </select>
        <select value={ruralFilter} onChange={e => setRuralFilter(e.target.value)} style={inpSt}>
          <option value="all">Ruralidad: Todos</option>
          <option value="rural">Rural</option>
          <option value="urbano">Urbano</option>
        </select>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Mostrando <b style={{ color: C.axisLabel }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}</b> de <b style={{ color: C.axisLabel }}>{filtered.length}</b>
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage <= 1)}>← Anterior</button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>{safePage} / {totalPages}</span>
          <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages)}>Siguiente →</button>
        </div>
      </div>

      <div className="chart-card" style={{ padding: 0, marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
          <h3 className="chart-title" style={{ margin: 0 }}>Detalle Establecimientos — IVE {periodo} ({fmtN(filtered.length)} resultados)</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                {[{ h: 'RBD', a: 'left' }, { h: 'Nombre', a: 'left' }, { h: 'Nivel', a: 'center' }, { h: 'IVE', a: 'center' }, { h: '1ª Prior.', a: 'right' }, { h: '2ª Prior.', a: 'right' }, { h: '3ª Prior.', a: 'right' }, { h: 'No Prior.', a: 'right' }, { h: 'Total Mat.', a: 'right' }, { h: 'Ingresos', a: 'right' }, { h: 'Gastos', a: 'right' }, { h: 'Rural', a: 'center' }, { h: 'Comuna', a: 'left' }].map(({ h, a }) => (
                  <th key={h} style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && <tr><td colSpan={13} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados para «{search}»</td></tr>}
              {paginated.map((ee, i) => {
                const ive = ee.ive_sinae ?? 0
                const clr = iveColor(ive)
                const fData = finMap[ee.rbd]
                const hasFin = !!fData

                const rows = [
                  <tr key={`${ee.rbd}-main`} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                    <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.76rem' }}>{ee.rbd}</td>
                    <td style={{ padding: '0.45rem 0.8rem', color: 'var(--text-primary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={ee.nom_establecimiento}>{ee.nom_establecimiento}</span>
                    </td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: ee.nivel === 'MEDIA' ? '#34d399' : '#60a5fa' }}>{ee.nivel}</span>
                    </td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: clr }}>{(ive * 100).toFixed(1)}%</span>
                    </td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#1e40af', fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.primera_prioridad)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#3b82f6', fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.segunda_prioridad)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#60a5fa', fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.tercera_prioridad)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#93c5fd', fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.no_priorizado)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.total_matricula)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#1e40af', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fData ? fmtAmt(fData.ingreso) : '—'}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#3b82f6', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fData ? fmtAmt(fData.gasto) : '—'}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'center', color: ee.rural_rbd === 1 ? '#f59e0b' : 'var(--line-subtle)' }}>{ee.rural_rbd === 1 ? '🌿' : '·'}</td>
                    <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontSize: '0.76rem' }}>{ee.nom_comuna}</td>
                  </tr>
                ]



                return rows
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}</span>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage <= 1)}>← Anterior</button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 60, textAlign: 'center' }}>Pág. {safePage} / {totalPages}</span>
            <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages)}>Siguiente →</button>
          </div>
        </div>
      </div>
    </>
  )
}
