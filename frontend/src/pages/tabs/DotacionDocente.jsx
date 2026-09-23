import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useChartColors } from '../../hooks/useChartColors'
import { fmtN, KPICard } from '../../components/DashboardWidgets'
import SqlViewer from '../../components/SqlViewer'
import { WidgetWrapper } from './FichaSostenedor'

export function RenderDotacionDocente({ sostId, periodo, rbdsContextoStr, esContextoAmpliado, widgetFilter = null }) {
  const C = useChartColors()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortConfig, setSortConfig] = useState({ key: 'matricula', direction: 'desc' })
  const ITEMS_PER_PAGE = 10

  useEffect(() => { setPage(1) }, [search, data, periodo])

  useEffect(() => {
    setLoading(true)
    const rbdsParam = rbdsContextoStr ? `&rbds_contexto=${encodeURIComponent(rbdsContextoStr)}` : ''
    api.get(`/dashboard/ficha-sostenedor/dotacion-docente?sost_id=${sostId}&periodo=${periodo}${rbdsParam}`)
      .then(res => setData(res.data))
      .catch(err => console.error("Error fetching dotacion docente", err))
      .finally(() => setLoading(false))
  }, [sostId, periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data || !data.establecimientos || data.establecimientos.length === 0) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧑‍🏫</div>
      <p>Sin datos de dotación docente para este período.</p>
    </div>
  )

  const { establecimientos, resumen } = data
  const validEstab = establecimientos.filter(e => e.matricula > 0)

  // Búsqueda y Paginación
  const filterText = search.toLowerCase().trim()
  const filtered = validEstab.filter(ee => 
    (ee.nombre_rbd ?? '').toLowerCase().includes(filterText) ||
    String(ee.rbd ?? '').includes(filterText)
  )

  const sorted = [...filtered].sort((a, b) => {
    const valA = a[sortConfig.key] ?? ''
    const valB = b[sortConfig.key] ?? ''
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })
  
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE) || 1
  const safePage = Math.min(page, totalPages)
  const paginated = sorted.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  const inpSt = { padding: '0.35rem 0.75rem', backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', fontSize: '0.8rem' }
  const pgBtn = (dis) => ({ padding: '0.3rem 0.75rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', background: dis ? 'var(--surface-base)' : 'var(--surface-overlay)', color: dis ? 'var(--text-disabled)' : 'var(--text-primary)', cursor: dis ? 'not-allowed' : 'pointer', fontSize: '0.8rem' })

  // Gráfico 1: Alumnos por Docente (Num Alumnos / Num Docentes)
  const chartDataAlumnos = [...paginated].map(e => ({
    name: e.nombre_rbd,
    rbd: e.rbd,
    matricula: e.matricula,
    docentes: e.num_docentes,
    ratio: e.num_docentes > 0 ? e.matricula / e.num_docentes : 0
  })).sort((a, b) => b.ratio - a.ratio)

  const optAlumnos = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = chartDataAlumnos[params[0].dataIndex]
        return `<b>${d.name}</b> (${d.rbd})<br/>
          🧑‍🎓 Matrícula: <b>${fmtN(d.matricula)}</b><br/>
          🧑‍🏫 Docentes: <b>${fmtN(d.docentes)}</b><br/>
          📊 Alumnos por Docente: <b style="color:#f59e0b">${d.ratio.toFixed(1)}</b>`
      }
    },
    grid: { left: 200, right: 40, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { 
      type: 'category', 
      inverse: true, 
      data: chartDataAlumnos.map(d => d.name?.length > 25 ? d.name.slice(0, 23) + '…' : d.name), 
      axisLabel: { color: C.axisLabel, fontSize: 10, width: 190, overflow: 'truncate' } 
    },
    series: [{
      type: 'bar',
      data: chartDataAlumnos.map(d => ({ value: d.ratio, itemStyle: { color: '#f59e0b', borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', formatter: p => p.value.toFixed(1), fontSize: 10, color: 'var(--text-primary)' }
    }],
    backgroundColor: 'transparent'
  }

  // Gráfico 2: Horas de Contrato por Alumno (Horas Docentes / Matrícula)
  const chartDataHoras = [...paginated].map(e => ({
    name: e.nombre_rbd,
    rbd: e.rbd,
    matricula: e.matricula,
    horas: e.horas_docentes,
    ratio: e.horas_docentes / e.matricula
  })).sort((a, b) => b.ratio - a.ratio)

  const optHoras = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = chartDataHoras[params[0].dataIndex]
        return `<b>${d.name}</b> (${d.rbd})<br/>
          🧑‍🎓 Matrícula: <b>${fmtN(d.matricula)}</b><br/>
          ⏱️ Horas Contrato Docente: <b>${fmtN(d.horas)}</b><br/>
          📊 Horas por Alumno: <b style="color:#3b82f6">${d.ratio.toFixed(2)}</b>`
      }
    },
    grid: { left: 200, right: 40, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { 
      type: 'category', 
      inverse: true, 
      data: chartDataHoras.map(d => d.name?.length > 25 ? d.name.slice(0, 23) + '…' : d.name), 
      axisLabel: { color: C.axisLabel, fontSize: 10, width: 190, overflow: 'truncate' } 
    },
    series: [{
      type: 'bar',
      data: chartDataHoras.map(d => ({ value: d.ratio, itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', formatter: p => p.value.toFixed(2), fontSize: 10, color: 'var(--text-primary)' }
    }],
    backgroundColor: 'transparent'
  }

  // Gráfico 3: Brecha de Dotación DOCAUL (Contratadas vs Teóricas)
  const chartDataBrecha = [...paginated].map(e => {
    const reales = Math.round(e.horas_docaul_real || 0)
    const teoricas = Math.round(e.horas_teoricas_docaul || 0)
    const diff = reales - teoricas
    
    return {
      name: e.nombre_rbd,
      rbd: e.rbd,
      reales,
      teoricas,
      diff,
      base: Math.min(reales, teoricas),
      exceso: Math.max(0, diff),
      deficit: Math.max(0, -diff)
    }
  }).sort((a, b) => b.teoricas - a.teoricas)

  const optBrecha = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = chartDataBrecha[params[0].dataIndex]
        return `<b>${d.name}</b> (${d.rbd})<br/>
          📚 Teóricas (Curriculares): <b>${fmtN(d.teoricas)}</b> hrs<br/>
          🧑‍🏫 Reales (DOCAUL): <b>${fmtN(d.reales)}</b> hrs<br/>
          ${d.diff > 0 
            ? `⚠️ Sobredotación: <b style="color:#ef4444">+${fmtN(d.diff)}</b> hrs`
            : d.diff < 0 
              ? `📉 Subdotación (Déficit): <b style="color:#f59e0b">${fmtN(d.diff)}</b> hrs`
              : `✅ Dotación Equilibrada`}`
      }
    },
    legend: { data: ['Horas Teóricas', 'Horas Cubiertas', 'Sobredotación'], textStyle: { color: C.axisLabel, fontSize: 10 }, bottom: 0 },
    grid: { left: 200, right: 40, top: 20, bottom: 40 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { 
      type: 'category', 
      inverse: true, 
      data: chartDataBrecha.map(d => d.name?.length > 25 ? d.name.slice(0, 23) + '…' : d.name), 
      axisLabel: { color: C.axisLabel, fontSize: 10, width: 190, overflow: 'truncate' } 
    },
    series: [
      {
        name: 'Horas Teóricas',
        type: 'bar',
        barGap: '10%',
        itemStyle: { color: '#94a3b8', borderRadius: [0, 4, 4, 0] },
        data: chartDataBrecha.map(d => d.teoricas),
        label: { show: true, position: 'right', fontSize: 10, color: 'var(--text-muted)' }
      },
      {
        name: 'Horas Cubiertas',
        type: 'bar',
        stack: 'Reales',
        itemStyle: { color: '#3b82f6' },
        data: chartDataBrecha.map(d => ({ value: d.base, itemStyle: { borderRadius: d.exceso > 0 ? [0, 0, 0, 0] : [0, 4, 4, 0] } })),
        label: { show: false }
      },
      {
        name: 'Sobredotación',
        type: 'bar',
        stack: 'Reales',
        itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] },
        data: chartDataBrecha.map(d => d.exceso),
        label: { show: true, position: 'right', fontSize: 10, color: '#ef4444', formatter: p => p.value > 0 ? `+${p.value}` : '' }
      }
    ],
    backgroundColor: 'transparent'
  }

  const ratioGlobalAlumnosDocente = resumen.total_docentes > 0 ? resumen.total_matricula / resumen.total_docentes : 0
  const ratioGlobalHorasAlumno = resumen.total_matricula > 0 ? resumen.total_horas_docentes / resumen.total_matricula : 0

  const sqlStr = `-- Índice de Eficiencia en Dotación Docente
WITH persona_mes AS (
    SELECT rbd, rut, fun, mes, MAX(hc) as hc_mes
    FROM remuneraciones
    WHERE sostenedor = :sid AND anio = :agno
    GROUP BY rbd, rut, fun, mes
),
persona_promedio AS (
    SELECT rbd, rut, fun, AVG(hc_mes) as horas_promedio
    FROM persona_mes
    GROUP BY rbd, rut, fun
),
docentes_stats AS (
    SELECT 
        rbd,
        COUNT(DISTINCT CASE WHEN fun IN ('DOCDIR', 'DOCAUL', 'DOCTEP') THEN rut END) as num_docentes,
        SUM(CASE WHEN fun IN ('DOCDIR', 'DOCAUL', 'DOCTEP') THEN horas_promedio ELSE 0 END) as horas_docentes,
        COUNT(DISTINCT CASE WHEN fun IN ('ASIPRO', 'ASIPAR', 'ASIAUX') THEN rut END) as num_asistentes,
        SUM(CASE WHEN fun IN ('ASIPRO', 'ASIPAR', 'ASIAUX') THEN horas_promedio ELSE 0 END) as horas_asistentes
    FROM persona_promedio
    GROUP BY rbd
)
SELECT 
    eo.rbd,
    eo.nombre_rbd,
    eo.mat_total as matricula,
    COALESCE(ds.num_docentes, 0) as num_docentes,
    COALESCE(ds.horas_docentes, 0) as horas_docentes,
    COALESCE(ds.num_asistentes, 0) as num_asistentes,
    COALESCE(ds.horas_asistentes, 0) as horas_asistentes
FROM dim_establecimiento_oficial eo
LEFT JOIN docentes_stats ds ON eo.rbd = ds.rbd
WHERE eo.rut_sostenedor = :sid AND eo.agno = :agno
ORDER BY eo.mat_total DESC NULLS LAST;`

  return (
    <>
      <SqlViewer sql={sqlStr} />
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> Evalúa la relación entre la dotación de personal (docentes y horas de contrato) y la cantidad de alumnos matriculados.
      </div>
      
      <WidgetWrapper widgetKey="dotacion_kpis">
        <div className="kpi-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <KPICard icon="🧑‍🏫" label="Total Docentes" value={fmtN(resumen.total_docentes)} color="#3b82f6" sub={`Horas: ${fmtN(resumen.total_horas_docentes)}`} />
          <KPICard icon="🧑‍💼" label="Total Asistentes" value={fmtN(resumen.total_asistentes)} color="#10b981" sub={`Horas: ${fmtN(resumen.total_horas_asistentes)}`} />
          <KPICard icon="📊" label="Alumnos por Docente" value={ratioGlobalAlumnosDocente.toFixed(1)} color="#f59e0b" sub="Ratio Promedio" />
          <KPICard icon="⏱️" label="Horas por Alumno" value={ratioGlobalHorasAlumno.toFixed(2)} color="#8b5cf6" sub="Docentes" />
        </div>
      </WidgetWrapper>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Buscar por establecimiento o RBD..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inpSt, minWidth: 280 }} />
        {search && <button onClick={() => setSearch('')} style={pgBtn(false)}>✕ Limpiar</button>}

        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Mostrando <b style={{ color: C.axisLabel }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}</b> de <b style={{ color: C.axisLabel }}>{filtered.length}</b>
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage <= 1)}>← Anterior</button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>{safePage} / {totalPages}</span>
          <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages)}>Siguiente →</button>
        </div>
      </div>

      <WidgetWrapper widgetKey="dotacion_tabla">
        <div className="chart-card" style={{ padding: 0, marginBottom: '1.5rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                {[
                  { h: 'RBD', k: 'rbd', a: 'left' }, 
                  { h: 'Establecimiento', k: 'nombre_rbd', a: 'left' }, 
                  ...(esContextoAmpliado ? [{ h: 'Tipo', k: 'es_propio', a: 'center' }] : []),
                  { h: 'Matrícula', k: 'matricula', a: 'right' }, 
                  { h: 'Docentes', k: 'num_docentes', a: 'right' }, 
                  { h: 'Horas Doc.', k: 'horas_docentes', a: 'right' }, 
                  { h: 'Asistentes', k: 'num_asistentes', a: 'right' }, 
                  { h: 'Horas Asist.', k: 'horas_asistentes', a: 'right' }
                ].map(({ h, k, a }) => (
                  <th 
                    key={k} 
                    onClick={() => {
                      let direction = 'asc'
                      if (sortConfig.key === k && sortConfig.direction === 'asc') direction = 'desc'
                      setSortConfig({ key: k, direction })
                    }}
                    style={{ 
                      padding: '0.55rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, 
                      textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap',
                      cursor: 'pointer', userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: a === 'right' ? 'flex-end' : 'flex-start', gap: '4px' }}>
                      {h}
                      <span style={{ fontSize: '0.65rem', color: sortConfig.key === k ? 'var(--text-primary)' : 'transparent' }}>
                        {sortConfig.key === k ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '▲'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados para «{search}»</td></tr>}
              {paginated.map((ee, i) => {
                const esPropio = ee.es_propio !== false // default true
                const rowBg = esContextoAmpliado && esPropio
                  ? i % 2 === 0 ? 'rgba(30, 64, 175, 0.06)' : 'rgba(30, 64, 175, 0.1)'
                  : i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)'
                const leftBorder = esContextoAmpliado ? (esPropio ? '3px solid #2563eb' : '3px solid transparent') : 'none'
                return (
                <tr key={`${ee.rbd}`} style={{ borderBottom: '1px solid var(--line-subtle)', background: rowBg, borderLeft: leftBorder }}>
                  <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.76rem' }}>{ee.rbd}</td>
                  <td style={{ padding: '0.45rem 0.8rem', color: 'var(--text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span title={ee.nombre_rbd}>{ee.nombre_rbd}</span>
                  </td>
                  {esContextoAmpliado && (
                    <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                      {esPropio
                        ? <span title="Establecimiento propio" style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '1px 7px', borderRadius: 999 }}>Propio</span>
                        : <span title="Establecimiento de referencia del grupo" style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', background: 'var(--surface-overlay)', padding: '1px 7px', borderRadius: 999 }}>Grupo</span>
                      }
                    </td>
                  )}
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel, fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.matricula)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#3b82f6', fontWeight: 600 }}>{fmtN(ee.num_docentes)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#3b82f6' }}>{fmtN(ee.horas_docentes)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{fmtN(ee.num_asistentes)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#10b981' }}>{fmtN(ee.horas_asistentes)}</td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </WidgetWrapper>

      <WidgetWrapper widgetKey="dotacion_graficos">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div className="chart-card">
            <h3 className="chart-title">Alumnos por Docente (Resultados {safePage})</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Ratio: Matrícula / N° de Docentes</p>
            {chartDataAlumnos.length === 0
              ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos.</p>
              : <ReactECharts option={optAlumnos} style={{ height: Math.max(280, chartDataAlumnos.length * 35) }} />
            }
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Horas Contrato Docente por Alumno (Resultados {safePage})</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Ratio: Total Horas Docentes / Matrícula</p>
            {chartDataHoras.length === 0
              ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos.</p>
              : <ReactECharts option={optHoras} style={{ height: Math.max(280, chartDataHoras.length * 35) }} />
            }
          </div>
        </div>

        <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="chart-title">Brecha de Dotación DOCAUL (Resultados {safePage})</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '1rem' }}>
            Comparación entre las horas reales contratadas para Docentes de Aula (DOCAUL) versus la demanda base teórica según la malla curricular y cursos activos.
          </p>
          {chartDataBrecha.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos curriculares disponibles para comparación.</p>
            : <ReactECharts option={optBrecha} style={{ height: Math.max(350, chartDataBrecha.length * 45) }} />
          }
        </div>
      </WidgetWrapper>
    </>
  )
}
