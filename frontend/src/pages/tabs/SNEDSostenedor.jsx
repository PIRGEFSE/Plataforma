import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { fmtN } from '../../lib/format'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt } from './FichaSostenedor'
import SqlViewer from '../../components/SqlViewer'
import { WidgetWrapper } from './FichaSostenedor'


// ── Descripción de indicadores SNED ───────────────────────────────────────
const SNED_INDICADORES = [
  { key: 'e',       label: 'E',   nombre: 'Efectividad',             desc: 'Resultado obtenido en pruebas SIMCE del año anterior a la medición',  color: '#2563eb' },
  { key: 's',       label: 'S',   nombre: 'Superación',              desc: 'Variación de puntajes SIMCE de los últimos años',                     color: '#059669' },
  { key: 'i',       label: 'I',   nombre: 'Iniciativa',              desc: 'Incorporación de innovaciones educativas',                           color: '#d97706' },
  { key: 'm',       label: 'M',   nombre: 'Mejoramiento',            desc: 'Adecuado funcionamiento del establecimiento',                        color: '#7c3aed' },
  { key: 'ig',      label: 'IG',  nombre: 'Igualdad de Oportunidades', desc: 'Accesibilidad y permanencia de la población escolar',              color: '#0ea5e9' },
  { key: 'int_val', label: 'INT', nombre: 'Integración',             desc: 'Participación de profesores, padres y apoderados',                   color: '#0891b2' },
]

function shortName(nom, rbd) {
  if (!nom) return `RBD ${rbd}`
  return nom.length > 32 ? nom.slice(0, 30) + '…' : nom
}

function snedColor(ee) {
  if (!ee.seleccionado_sned) return '#64748b'
  const s = ee.seleccionado_sned.toLowerCase()
  if (s.includes('100%')) return '#1e40af'
  if (s.includes('60%'))  return '#3b82f6'
  if (s.includes('40%'))  return '#60a5fa'
  if (s.includes('no') || s.includes('premiado')) return 'var(--text-disabled)'
  return '#64748b'
}

function snedBadge(estado) {
  if (!estado) return null
  const s = estado.toLowerCase()
  const col = s.includes('no') || !s.includes('premiado') ? 'var(--text-disabled)'
    : s.includes('100%') ? '#1e40af'
      : s.includes('60%') ? '#3b82f6'
        : 'var(--text-disabled)'
  return (
    <span style={{
      fontSize: '0.75rem', fontWeight: 700, color: col,
      whiteSpace: 'nowrap',
    }}>
      {estado}
    </span>
  )
}

function KPICard({ label, value, icon, color, sub }) {
  return (
    <div className="kpi-card" style={{ '--accent': color }}>
      <div className="kpi-icon" style={{ background: `${color}20` }}>{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value" style={{ color }}>{value}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

export default function SNEDSostenedor({ sostId, periodo, widgetFilter }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(widgetFilter ? (localStorage.getItem('sned_pinned_search') || '') : '')
  const [page, setPage] = useState(widgetFilter ? (parseInt(localStorage.getItem('sned_pinned_page')) || 0) : 0)
  const ITEMS = 10
  const C = useChartColors()
  const { fmtAmt, unitLabel } = useMoneyFmt()

  useEffect(() => {
    setLoading(true)
    api.get(`/dashboard/sned-sostenedor?sost_id=${sostId}&periodo=${periodo}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [sostId, periodo])

  useEffect(() => { setPage(0) }, [search, periodo])

  useEffect(() => {
    if (!widgetFilter) {
      localStorage.setItem('sned_pinned_search', search)
      localStorage.setItem('sned_pinned_page', page.toString())
    }
  }, [search, page, widgetFilter])


  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data) return <div style={{ color: 'var(--text-muted)', padding: '2rem' }}>Sin datos disponibles.</div>

  const { establecimientos: ees = [], kpis = {}, agno_sned, periodo_fin } = data
  //const agnoLabel = agno_sned === 2020 ? '2020–2021' : agno_sned === 2022 ? '2022–2023' : '2024–2025'
  const agnoLabel = agno_sned


  // ── Filtrado y paginación ─────────────────────────────────────────────────
  const ft = search.toLowerCase().trim()
  const filtered = ees.filter(d =>
    (d.nom_rbd || '').toLowerCase().includes(ft) ||
    String(d.rbd || '').includes(ft)
  )
  const totalPages = Math.ceil(filtered.length / ITEMS) || 1
  const safe = Math.min(page, totalPages - 1)
  const paginated = filtered.slice(safe * ITEMS, (safe + 1) * ITEMS)

  const getSnedScore = (s) => {
    if (!s) return 0;
    const lower = s.toLowerCase();
    if (lower.includes('100%')) return 3;
    if (lower.includes('60%')) return 2;
    return 1;
  };

  // ── Scatter: Puntaje SNED vs Ingreso ─────────────────────────────────────
  const scatterData = paginated
    .filter(d => d.ind_sned != null && d.ingreso != null)
    .map(d => ({
      value: [d.ind_sned, d.ingreso / 1e6, d.gasto ?? 0],
      name: d.nom_rbd,
      rbd: d.rbd,
      color: snedColor(d),
      snedScore: getSnedScore(d.seleccionado_sned),
    }))

  const maxGasto = Math.max(...paginated.map(d => d.gasto || 0), 1)
  const scatterOpt = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'item', ...C.tooltip,
      formatter: p => {
        const d = p.data
        return `<b>${d.name}</b> (${d.rbd})<br/>
          🏆 SNED: <b>${Number(d.value[0]).toFixed(1)}</b><br/>
          💰 Ingreso: <b>${fmtAmt(d.value[1] * 1e6)}</b><br/>
          📉 Gasto: <b>${fmtAmt(d.value[2])}</b><br/>
          ${d.snedScore === 3 ? '✅ 100% Premiado' : d.snedScore === 2 ? '✅ 60% Premiado' : '❌ No Premiado'}`
      }
    },
    legend: {
      data: ['100% Premiado', '60% Premiado', 'No Premiado'], textStyle: { color: C.axisLabel }, top: 0,
    },
    grid: { left: 70, right: 30, top: 40, bottom: 50 },
    xAxis: {
      type: 'value', name: 'Puntaje SNED', nameLocation: 'middle', nameGap: 30, scale: true,
      axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } },
    },
    yAxis: {
      type: 'value', name: `Ingreso (M$)`, nameLocation: 'middle', nameGap: 55, scale: true,
      axisLabel: { color: C.axisLabel, formatter: v => `${(v / 1000).toFixed(0)} mM$` },
      splitLine: { lineStyle: { color: C.splitLine } },
    },
    series: [
      {
        name: '100% Premiado', type: 'scatter', symbol: 'circle',
        itemStyle: { color: '#1e40af', borderColor: '#fff', borderWidth: 1.5 },
        symbolSize: val => Math.max(8, (Math.sqrt(val[2] || 0) / Math.sqrt(maxGasto)) * 35),
        data: scatterData.filter(d => d.snedScore === 3),
      },
      {
        name: '60% Premiado', type: 'scatter', symbol: 'rect',
        itemStyle: { color: '#3b82f6', borderColor: '#fff', borderWidth: 1.5 },
        symbolSize: val => Math.max(8, (Math.sqrt(val[2] || 0) / Math.sqrt(maxGasto)) * 35),
        data: scatterData.filter(d => d.snedScore === 2),
      },
      {
        name: 'No Premiado', type: 'scatter', symbol: 'triangle',
        itemStyle: { color: '#94a3b8', opacity: 0.5, borderColor: '#64748b', borderWidth: 1 },
        symbolSize: val => Math.max(8, (Math.sqrt(val[2] || 0) / Math.sqrt(maxGasto)) * 35),
        data: scatterData.filter(d => d.snedScore <= 1),
      },
    ],
    backgroundColor: 'transparent',
  }

  // ── Barras: Posición GH vs Total GH ──────────────────────────────────────
  const posData = [...paginated]
    .filter(d => d.posicion_gh != null)
    .sort((a, b) => {
      const scoreA = getSnedScore(a.seleccionado_sned);
      const scoreB = getSnedScore(b.seleccionado_sned);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.posicion_gh - b.posicion_gh;
    })

  const posOpt = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = posData[params[0].dataIndex]
        if (!d) return ''
        const pct = d.n_establecimientos_gh ? Math.round(d.posicion_gh / d.n_establecimientos_gh * 100) : null
        return `<b>${d.nom_rbd}</b> (${d.rbd})<br/>
          📍 Posición: <b>${d.posicion_gh}</b> de ${d.n_establecimientos_gh}<br/>
          ${pct != null ? `Percentil: <b>${pct}%</b>` : ''}<br/>
          ${d.seleccionado_sned || ''}`
      }
    },
    grid: { left: 280, right: 80, top: 20, bottom: 20 },
    xAxis: {
      type: 'value', name: 'Posición GH',
      axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: posData.map(d => shortName(d.nom_rbd, d.rbd)),
      axisLabel: { color: C.axisLabel, fontSize: 10, width: 270, overflow: 'truncate' },
    },
    series: [
      {
        name: 'Total GH', type: 'bar', barMaxWidth: 14, barGap: '-100%',
        data: posData.map(d => d.n_establecimientos_gh ?? 0),
        itemStyle: { color: '#1e2844', borderRadius: [0, 4, 4, 0] },
        z: 1,
      },
      {
        name: 'Posición EE', type: 'bar', barMaxWidth: 14,
        data: posData.map(d => ({
          value: d.posicion_gh ?? 0,
          itemStyle: { color: snedColor(d), borderRadius: [0, 4, 4, 0] },
        })),
        label: {
          show: true, position: 'right', formatter: p => {
            const d = posData[p.dataIndex]
            return d ? `${d.posicion_gh}/${d.n_establecimientos_gh}` : ''
          }, color: C.axisLabel, fontSize: 10
        },
        z: 2,
      },
    ],
    backgroundColor: 'transparent',
  }

  // ── Radar: todos los EE del sostenedor ───────────────────────────────────
  const eeConPuntaje = paginated.filter(d =>
    SNED_INDICADORES.some(ind => d[ind.key] != null)
  )
  const maxVal = 100

  const radarOpt = {
    aria: { decal: { show: true } },
    tooltip: { ...C.tooltip },
    legend: {
      type: 'scroll',
      data: eeConPuntaje.map(d => shortName(d.nom_rbd, d.rbd)),
      textStyle: { color: C.axisLabel, fontSize: 10 },
      bottom: 0,
    },
    radar: {
      indicator: SNED_INDICADORES.map(ind => ({ name: ind.label, max: maxVal })),
      center: ['50%', '46%'],
      radius: '58%',
      splitArea: { areaStyle: { color: ['#0f172a10', '#1e293b10'] } },
      axisName: { color: C.axisLabel, fontSize: 12, fontWeight: 700 },
      splitLine: { lineStyle: { color: C.splitLine } },
    },
    series: [{
      type: 'radar',
      data: eeConPuntaje.map((d, idx) => {
        const hue = Math.round((idx / Math.max(eeConPuntaje.length, 1)) * 360)
        const col = `hsl(${hue},70%,60%)`
        return {
          name: shortName(d.nom_rbd, d.rbd),
          value: SNED_INDICADORES.map(ind => d[ind.key] ?? 0),
          lineStyle: { color: col, width: 1.5 },
          areaStyle: { color: col, opacity: 0.08 },
          itemStyle: { color: col },
          symbol: 'circle', symbolSize: 5,
        }
      }),
    }],
    backgroundColor: 'transparent',
  }

  const inputStyle = {
    padding: '0.35rem 0.75rem', backgroundColor: 'var(--surface-overlay)',
    color: 'var(--text-primary)', border: '1px solid var(--line-subtle)',
    borderRadius: '0.375rem', fontSize: '0.8rem', minWidth: 220,
  }
  const btnStyle = (disabled) => ({
    padding: '0.3rem 0.75rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem',
    background: disabled ? 'var(--surface-base)' : 'var(--surface-overlay)',
    color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
  })

  const sqlStr = `-- 1. Ficha SNED (Información general)
SELECT nro AS rbd, agno, grupo_homogeneo, posicion_gh,
       n_establecimientos_gh, seleccionado_sned
FROM "Ficha_SNED"
WHERE nro = ANY(:rbds) AND agno = :agno
ORDER BY nro;

-- 2. Tabla SNED (Puntajes por indicador)
SELECT nro_establecimiento AS rbd, agno, resultados_sned,
       ind_sned, e, s, i, m, ig, int_val
FROM "Tabla_SNED"
WHERE nro_establecimiento = ANY(:rbds) AND agno = :agno
ORDER BY nro_establecimiento, resultados_sned;

-- 3. Financiero (Ingresos/Gastos)
SELECT
    rbd,
    SUM(CASE WHEN desc_tipo_cuenta ILIKE '%ingreso%' THEN monto_declarado ELSE 0 END) AS ingreso,
    SUM(CASE WHEN desc_tipo_cuenta ILIKE '%gasto%'   THEN monto_declarado ELSE 0 END) AS gasto
FROM estado_resultado
WHERE sost_id = :sid
  AND periodo  = :p
  AND UPPER(TRIM(desc_estado)) = 'RENDIDO'
  AND rbd = ANY(:rbds)
GROUP BY rbd;`

  return (
    <>
      <SqlViewer sql={sqlStr} />

      {!widgetFilter && (
        <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
          ℹ️ <strong>Metodología:</strong> Análisis de desempeño y excelencia basado en el Sistema Nacional de Evaluación de Desempeño (SNED).
        </div>
      )}

      {!widgetFilter && (
        <div style={{
          background: 'linear-gradient(135deg, #2563eb12 0%, #0ea5e912 100%)',
          border: '1px solid #2563eb28', borderRadius: '0.75rem',
          padding: '1rem 1.25rem', marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🏆</span>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
              Sistema Nacional de Evaluación del Desempeño (SNED) — Año {periodo_fin}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            {SNED_INDICADORES.map(ind => (
              <div key={ind.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', minWidth: 200 }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, color: '#fff',
                  background: ind.color, borderRadius: 999,
                  padding: '0.1rem 0.5rem', whiteSpace: 'nowrap', marginTop: 2, flexShrink: 0,
                }}>
                  {ind.label}
                </span>
                <div style={{ lineHeight: 1.4 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ind.nombre}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ind.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!widgetFilter || widgetFilter === 'ef_sned_kpis') && (
        <WidgetWrapper widgetKey="ef_sned_kpis">
          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            <KPICard icon="🏫" label="EE con datos SNED" value={fmtN(kpis.con_sned)} color="#2563eb" sub={`de ${fmtN(kpis.total_ee)} totales`} />
            <KPICard icon="🥇" label="EE Premiados SNED" value={fmtN(kpis.premiados)} color="#059669" sub={`${kpis.con_sned > 0 ? Math.round(kpis.premiados / kpis.con_sned * 100) : 0}% con subvención`} />
            <KPICard icon="📈" label="EE sobre Prom. GH" value={fmtN(kpis.sobre_prom_gh)} color="#d97706" sub="Puntaje SNED ≥ promedio GH" />
            <KPICard icon="💰" label={`Ingreso Total (${periodo_fin})`} value={fmtAmt(kpis.total_ingreso)} color="#7c3aed" sub={unitLabel} />
          </div>
        </WidgetWrapper>
      )}

      {(!widgetFilter || widgetFilter === 'ef_sned_tabla') && (
        <WidgetWrapper widgetKey="ef_sned_tabla">
          <div className="chart-card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h3 className="chart-title" style={{ margin: 0 }}>Detalle por Establecimiento — Año {periodo_fin}</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="text" placeholder="🔍 Buscar..." value={search}
                  onChange={e => setSearch(e.target.value)} style={inputStyle} />
                {search && (
                  <button onClick={() => setSearch('')}
                    style={{ padding: '0.3rem 0.6rem', background: 'var(--surface-overlay)', border: '1px solid var(--line-subtle)', color: C.axisLabel, borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-overlay)' }}>
                    {[
                      { h: 'RBD', a: 'left' }, { h: 'Nombre', a: 'left' },
                      { h: 'Grupo Homogéneo', a: 'left' },
                      { h: 'Pos. GH', a: 'center' }, { h: 'Total GH', a: 'center' },
                      { h: 'Estado SNED', a: 'left' }, { h: 'Puntaje', a: 'center' },
                      { h: `Ingreso (${unitLabel})`, a: 'right' },
                      { h: `Gasto (${unitLabel})`, a: 'right' },
                      { h: `Superávit (${unitLabel})`, a: 'right' },
                    ].map(({ h, a }) => (
                      <th key={h} style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin resultados</td></tr>
                  ) : paginated.map((d, i) => {
                    const supColor = d.superavit == null ? 'var(--text-muted)' : d.superavit >= 0 ? '#10b981' : '#ef4444'
                    return (
                      <tr key={d.rbd} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                        <td style={{ padding: '0.5rem 0.8rem', fontFamily: 'monospace', fontSize: '0.78rem', color: C.axisLabel }}>{d.rbd}</td>
                        <td style={{ padding: '0.5rem 0.8rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.nom_rbd}>{d.nom_rbd}</td>
                        <td style={{ padding: '0.5rem 0.8rem', fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.grupo_homogeneo}>{d.grupo_homogeneo ?? '—'}</td>
                        <td style={{ padding: '0.5rem 0.8rem', textAlign: 'center', fontWeight: 700, color: snedColor(d) }}>{d.posicion_gh ?? '—'}</td>
                        <td style={{ padding: '0.5rem 0.8rem', textAlign: 'center', color: 'var(--text-muted)' }}>{d.n_establecimientos_gh ?? '—'}</td>
                        <td style={{ padding: '0.5rem 0.8rem' }}>{snedBadge(d.seleccionado_sned) ?? <span style={{ color: 'var(--text-muted)' }}>Sin datos</span>}</td>
                        <td style={{ padding: '0.5rem 0.8rem', textAlign: 'center' }}>
                          {d.ind_sned != null ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                              <div style={{ width: 48, height: 5, borderRadius: 3, background: 'var(--line-subtle)', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(d.ind_sned, 100)}%`, height: '100%', background: snedColor(d), borderRadius: 3 }} />
                              </div>
                              <strong style={{ color: snedColor(d), fontSize: '0.82rem' }}>{Number(d.ind_sned).toFixed(1)}</strong>
                            </div>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ padding: '0.5rem 0.8rem', textAlign: 'right', color: '#1e40af', fontVariantNumeric: 'tabular-nums' }}>
                          {d.ingreso != null ? fmtAmt(d.ingreso) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ padding: '0.5rem 0.8rem', textAlign: 'right', color: '#3b82f6', fontVariantNumeric: 'tabular-nums' }}>
                          {d.gasto != null ? fmtAmt(d.gasto) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ padding: '0.5rem 0.8rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {d.superavit != null
                            ? <strong style={{ color: supColor }}>{fmtAmt(d.superavit)}</strong>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {filtered.length === 0 ? 0 : safe * ITEMS + 1}–{Math.min((safe + 1) * ITEMS, filtered.length)} de {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <button disabled={safe === 0} onClick={() => setPage(p => p - 1)} style={btnStyle(safe === 0)}>← Anterior</button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 52, textAlign: 'center' }}>{safe + 1} / {totalPages}</span>
                <button disabled={safe >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={btnStyle(safe >= totalPages - 1)}>Siguiente →</button>
              </div>
            </div>
          </div>
        </WidgetWrapper>
      )}

      <div className="charts-grid-2" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        {(!widgetFilter || widgetFilter === 'ef_sned_scatter') && (
          <WidgetWrapper widgetKey="ef_sned_scatter">
            <div className="chart-card">
              <h3 className="chart-title" style={{ marginBottom: '0.2rem' }}>Puntaje SNED vs Ingreso — {periodo_fin}</h3>
              {scatterData.length === 0
                ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Sin datos para graficar</div>
                : <ReactECharts option={scatterOpt} style={{ height: 320 }} />
              }
            </div>
          </WidgetWrapper>
        )}
        {(!widgetFilter || widgetFilter === 'ef_sned_posicion') && (
          <WidgetWrapper widgetKey="ef_sned_posicion">
            <div className="chart-card">
              <h3 className="chart-title">Posición en Grupo Homogéneo — {periodo_fin}</h3>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span><span style={{ color: '#1e2844', fontSize: '1.1rem' }}>■</span> Total GH</span>
                <span><span style={{ color: '#1e40af', fontSize: '1.1rem' }}>■</span> 100% Premiado</span>
                <span><span style={{ color: '#3b82f6', fontSize: '1.1rem' }}>■</span> 60% Premiado</span>
                <span><span style={{ color: 'var(--text-disabled)', fontSize: '1.1rem' }}>■</span> No Premiado</span>
              </div>
              {posData.length === 0
                ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Sin datos SNED para el período</div>
                : <ReactECharts option={posOpt} style={{ height: Math.max(300, posData.length * 34) }} />
              }
            </div>
          </WidgetWrapper>
        )}
      </div>

      {(!widgetFilter || widgetFilter === 'ef_sned_radar') && (
        <WidgetWrapper widgetKey="ef_sned_radar">
          <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
            <h3 className="chart-title">Radar de Indicadores SNED — Todos los Establecimientos ({periodo_fin})</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
              Comparación de los 6 indicadores por establecimiento. Escala 0–100.
            </p>
            {eeConPuntaje.length === 0
              ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Sin puntajes SNED disponibles</div>
              : <ReactECharts option={radarOpt} style={{ height: 480 }} />
            }
          </div>
        </WidgetWrapper>
      )}
    </>
  )
}
