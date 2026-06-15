import { useEffect, useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { fmtMM, fmtN } from '../../lib/format'
import { useChartColors } from '../../hooks/useChartColors'

const MESES = [
  '', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]
const MESES_FULL = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6',
]

const ITEMS_PER_PAGE = 15

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v) {
  const n = Number(v) || 0
  return fmtMM(n)
}

function KPICard({ icon, label, value, color = '#6366f1', sub }) {
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

const selSt = {
  padding: '0.35rem 0.7rem',
  backgroundColor: 'var(--surface-overlay)',
  color: 'var(--text-primary)',
  border: '1px solid var(--line-subtle)',
  borderRadius: '0.375rem',
  fontSize: '0.8rem',
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function AnalisisRendicion({ sostId, periodo }) {
  const C = useChartColors()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // Filtros locales
  const [mes, setMes]               = useState('')
  const [cuentaPadre, setCuentaPadre] = useState('')
  const [subvencion, setSubvencion] = useState('')
  const [tipoDoc, setTipoDoc]       = useState('')
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(0)

  // Carga datos cuando cambia periodo o mes
  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ sost_id: sostId, periodo })
    if (mes) params.append('mes', mes)
    api.get(`/dashboard/ficha-sostenedor/analisis-rendicion?${params}`)
      .then(r => setData(r.data))
      .catch(() => setError('No se pudo cargar la información de rendición.'))
      .finally(() => setLoading(false))
  }, [sostId, periodo, mes])

  // Resetear página al cambiar filtros
  useEffect(() => { setPage(0) }, [search, cuentaPadre, subvencion, tipoDoc, mes])

  // ── Opciones únicas para los selectores (del detalle) ────────────────────
  const opts = useMemo(() => {
    if (!data) return { cuentas: [], subvenciones: [], tipos: [] }
    const det = data.detalle
    return {
      cuentas:     [...new Set(det.map(d => d.desc_cuenta_padre))].sort(),
      subvenciones:[...new Set(det.map(d => d.subvencion_alias))].sort(),
      tipos:       [...new Set(det.map(d => d.tipo_docs_alias))].sort(),
    }
  }, [data])

  // ── Filtrado del detalle ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!data) return []
    const txt = search.toLowerCase().trim()
    return data.detalle.filter(d => {
      const matchCP  = !cuentaPadre || d.desc_cuenta_padre === cuentaPadre
      const matchSub = !subvencion  || d.subvencion_alias  === subvencion
      const matchTip = !tipoDoc     || d.tipo_docs_alias   === tipoDoc
      const matchTxt = !txt || [
        d.desc_cuenta, d.subvencion_alias, d.tipo_docs_alias,
        d.desc_libro, String(d.rbd ?? ''),
      ].some(v => (v || '').toLowerCase().includes(txt))
      return matchCP && matchSub && matchTip && matchTxt
    })
  }, [data, cuentaPadre, subvencion, tipoDoc, search])

  const totalPages  = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1
  const safePage    = Math.min(page, totalPages - 1)
  const paginated   = filtered.slice(safePage * ITEMS_PER_PAGE, (safePage + 1) * ITEMS_PER_PAGE)

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (error)   return <div className="empty-state" style={{ color: '#ef4444' }}>{error}</div>
  if (!data)   return null

  const { resumen, serie_mensual, por_cuenta_padre, por_subvencion, por_tipo_doc } = data

  // ── Gráfico 1: Serie mensual ──────────────────────────────────────────────
  const serieLabels = MESES.slice(1)
  const serieData   = serieLabels.map((_, i) => {
    const found = serie_mensual.find(s => s.mes === i + 1)
    return found ? found.total_monto : 0
  })
  const serieOption = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const p = params[0]
        const m = serie_mensual.find(s => s.mes === p.dataIndex + 1)
        return `<b>${MESES_FULL[p.dataIndex + 1]} ${periodo}</b><br/>
          Monto: <b>${fmt(p.value)}</b><br/>
          Documentos: ${fmtN(m?.n_docs ?? 0)}`
      },
    },
    grid: { left: 70, right: 20, top: 30, bottom: 36 },
    xAxis: {
      type: 'category', data: serieLabels,
      axisLabel: { color: C.axisLabel, fontSize: 11 },
      axisLine: { lineStyle: { color: C.splitLine } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: C.axisLabel, formatter: v => fmtMM(v) },
      splitLine: { lineStyle: { color: C.splitLine } },
    },
    series: [{
      type: 'bar', data: serieData, barMaxWidth: 40,
      itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] },
      label: {
        show: true, position: 'top',
        formatter: p => p.value > 0 ? fmtMM(p.value) : '',
        color: C.axisLabel, fontSize: 9,
      },
    }],
    backgroundColor: 'transparent',
  }

  // ── Gráfico 2: Donut cuenta padre ─────────────────────────────────────────
  const pieOption = {
    tooltip: {
      trigger: 'item', ...C.tooltip,
      formatter: p => `<b>${p.name}</b><br/>Monto: ${fmt(p.value)}<br/>${p.percent.toFixed(1)}%`,
    },
    legend: {
      orient: 'vertical', left: '52%', top: 'center',
      textStyle: { color: C.axisLabel, fontSize: 10 },
      formatter: name => name.length > 36 ? name.slice(0, 34) + '…' : name,
    },
    series: [{
      type: 'pie', radius: ['38%', '68%'], center: ['24%', '50%'],
      data: por_cuenta_padre.map((c, i) => ({
        name: c.desc_cuenta_padre,
        value: c.total_monto,
        itemStyle: { color: PALETTE[i % PALETTE.length] },
      })),
      label: { show: false },
      emphasis: { label: { show: false } },
    }],
    backgroundColor: 'transparent',
  }

  // ── Gráfico 3: Barras subvención ──────────────────────────────────────────
  const subvRev = [...por_subvencion].reverse()
  const subvOption = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = subvRev[params[0].dataIndex]
        return `<b>${d.subvencion_alias}</b><br/>Monto: ${fmt(d.total_monto)}<br/>Docs: ${fmtN(d.n_docs)}`
      },
    },
    grid: { left: 220, right: 80, top: 10, bottom: 10 },
    xAxis: {
      type: 'value',
      axisLabel: { color: C.axisLabel, formatter: v => fmtMM(v) },
      splitLine: { lineStyle: { color: C.splitLine } },
    },
    yAxis: {
      type: 'category',
      data: subvRev.map(d => d.subvencion_alias.length > 32 ? d.subvencion_alias.slice(0, 30) + '…' : d.subvencion_alias),
      axisLabel: { color: C.axisLabel, fontSize: 10, width: 210, overflow: 'truncate' },
    },
    series: [{
      type: 'bar', barMaxWidth: 20,
      data: subvRev.map((d, i) => ({
        value: d.total_monto,
        itemStyle: { color: PALETTE[i % PALETTE.length], borderRadius: [0, 4, 4, 0] },
      })),
      label: {
        show: true, position: 'right',
        formatter: p => fmt(p.value),
        color: C.axisLabel, fontSize: 10,
      },
    }],
    backgroundColor: 'transparent',
  }

  // ── Gráfico 4: Por tipo de documento ──────────────────────────────────────
  const tipoRev = [...por_tipo_doc].reverse()
  const tipoOption = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = tipoRev[params[0].dataIndex]
        return `<b>${d.tipo_docs_alias}</b><br/>Monto: ${fmt(d.total_monto)}<br/>Docs: ${fmtN(d.n_docs)}`
      },
    },
    grid: { left: 200, right: 80, top: 10, bottom: 10 },
    xAxis: {
      type: 'value',
      axisLabel: { color: C.axisLabel, formatter: v => fmtMM(v) },
      splitLine: { lineStyle: { color: C.splitLine } },
    },
    yAxis: {
      type: 'category',
      data: tipoRev.map(d => d.tipo_docs_alias.length > 28 ? d.tipo_docs_alias.slice(0, 26) + '…' : d.tipo_docs_alias),
      axisLabel: { color: C.axisLabel, fontSize: 10, width: 190, overflow: 'truncate' },
    },
    series: [{
      type: 'bar', barMaxWidth: 20,
      data: tipoRev.map((d, i) => ({
        value: d.total_monto,
        itemStyle: { color: PALETTE[(i + 3) % PALETTE.length], borderRadius: [0, 4, 4, 0] },
      })),
      label: {
        show: true, position: 'right',
        formatter: p => fmt(p.value),
        color: C.axisLabel, fontSize: 10,
      },
    }],
    backgroundColor: 'transparent',
  }

  const pgBtn = disabled => ({
    padding: '0.3rem 0.75rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem',
    background: disabled ? 'var(--surface-base)' : 'var(--surface-overlay)',
    color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
  })

  return (
    <>
      {/* ── Alerta informativa ──────────────────────────────────────── */}
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 14 }}>
        📋 <strong>Análisis Rendición {periodo}{mes ? ` · ${MESES_FULL[mes]}` : ''}</strong>
        &nbsp;— Monto declarado de documentos agrupados por cuenta, subvención y tipo, filtrado por sostenedor.
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────── */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="💰" label={`Monto Total (mM$)`} value={fmt(resumen.total_monto)} color="#6366f1" sub={`Año ${periodo}${mes ? ` · ${MESES_FULL[mes]}` : ''}`} />
        <KPICard icon="📄" label="N° Documentos" value={fmtN(resumen.total_docs)} color="#10b981" sub="Registros contabilizados" />
        <KPICard icon="🏫" label="Establecimientos (RBD)" value={fmtN(resumen.n_rbd)} color="#f59e0b" sub="Con documentos en el período" />
        <KPICard icon="📊" label="Categorías de Cuenta" value={fmtN(por_cuenta_padre.length)} color="#8b5cf6" sub="Cuentas padre distintas" />
      </div>

      {/* ── Filtro de mes ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>Filtrar por:</span>
        <select style={selSt} value={mes} onChange={e => setMes(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Todos los meses</option>
          {MESES_FULL.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        {mes && (
          <button onClick={() => setMes('')} style={{ ...pgBtn(false), padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}>
            ✕ Todos los meses
          </button>
        )}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {resumen.anios_disponibles?.length > 0 && (
            <>Años disponibles: <b style={{ color: 'var(--text-primary)' }}>{resumen.anios_disponibles.join(', ')}</b></>
          )}
        </span>
      </div>

      {/* ── Gráfico serie mensual ────────────────────────────────────── */}
      <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="chart-title">Monto Declarado por Mes — {periodo} (mM$)</h3>
        {serie_mensual.length === 0
          ? <div className="empty-state">Sin datos para el período seleccionado</div>
          : <ReactECharts option={serieOption} style={{ height: 260 }} />
        }
      </div>

      {/* ── Gráficos 2-columnas ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="chart-card">
          <h3 className="chart-title">Distribución por Cuenta Padre</h3>
          {por_cuenta_padre.length === 0
            ? <div className="empty-state">Sin datos</div>
            : <ReactECharts option={pieOption} style={{ height: 300 }} />
          }
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Top Tipos de Documento</h3>
          {por_tipo_doc.length === 0
            ? <div className="empty-state">Sin datos</div>
            : <ReactECharts option={tipoOption} style={{ height: Math.max(200, por_tipo_doc.length * 32) }} />
          }
        </div>
      </div>

      {/* ── Gráfico subvenciones ─────────────────────────────────────── */}
      <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="chart-title">Top Subvenciones — Monto Declarado (mM$)</h3>
        {por_subvencion.length === 0
          ? <div className="empty-state">Sin datos</div>
          : <ReactECharts option={subvOption} style={{ height: Math.max(200, por_subvencion.length * 34) }} />
        }
      </div>

      {/* ── Filtros de tabla ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Buscar cuenta, subvención, RBD..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...selSt, minWidth: 260 }}
        />
        <select style={selSt} value={cuentaPadre} onChange={e => setCuentaPadre(e.target.value)}>
          <option value="">Cuenta Padre: Todas</option>
          {opts.cuentas.map(c => <option key={c} value={c}>{c.length > 50 ? c.slice(0, 48) + '…' : c}</option>)}
        </select>
        <select style={selSt} value={subvencion} onChange={e => setSubvencion(e.target.value)}>
          <option value="">Subvención: Todas</option>
          {opts.subvenciones.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={selSt} value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}>
          <option value="">Tipo Doc: Todos</option>
          {opts.tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(search || cuentaPadre || subvencion || tipoDoc) && (
          <button
            onClick={() => { setSearch(''); setCuentaPadre(''); setSubvencion(''); setTipoDoc('') }}
            style={{ ...pgBtn(false), padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
          >
            ✕ Limpiar filtros
          </button>
        )}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Mostrando{' '}
          <b style={{ color: 'var(--text-primary)' }}>
            {filtered.length === 0 ? 0 : safePage * ITEMS_PER_PAGE + 1}–{Math.min((safePage + 1) * ITEMS_PER_PAGE, filtered.length)}
          </b>{' '}de <b style={{ color: 'var(--text-primary)' }}>{filtered.length}</b> filas
        </span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button disabled={safePage === 0} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage === 0)}>← Anterior</button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>{safePage + 1} / {totalPages}</span>
          <button disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages - 1)}>Siguiente →</button>
        </div>
      </div>

      {/* ── Tabla detalle ────────────────────────────────────────────── */}
      <div className="chart-card" style={{ padding: 0, marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
          <h3 className="chart-title" style={{ margin: 0 }}>
            Detalle de Documentos — {periodo}{mes ? ` · ${MESES_FULL[mes]}` : ''}
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                {[
                  { h: 'Año',         a: 'center' },
                  { h: 'Mes',         a: 'center' },
                  { h: 'RBD',         a: 'left'   },
                  { h: 'Libro',       a: 'left'   },
                  { h: 'Cuenta Padre',a: 'left'   },
                  { h: 'Cuenta',      a: 'left'   },
                  { h: 'Subvención',  a: 'left'   },
                  { h: 'Tipo Doc',    a: 'left'   },
                  { h: 'N° Docs',     a: 'right'  },
                  { h: 'Monto (mM$)', a: 'right'  },
                ].map(({ h, a }) => (
                  <th key={h} style={{
                    padding: '0.55rem 0.75rem',
                    color: 'var(--text-muted)', fontWeight: 600,
                    textAlign: a, borderBottom: '1px solid var(--line-subtle)',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Sin resultados para los filtros aplicados
                </td></tr>
              ) : paginated.map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                  <td style={{ padding: '0.4rem 0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>{d.anio}</td>
                  <td style={{ padding: '0.4rem 0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>{MESES[d.mes] ?? d.mes}</td>
                  <td style={{ padding: '0.4rem 0.75rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                    {d.rbd ?? <span style={{ color: 'var(--text-muted)' }}>Adm.</span>}
                  </td>
                  <td style={{ padding: '0.4rem 0.75rem', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.desc_libro}>{d.desc_libro}</td>
                  <td style={{ padding: '0.4rem 0.75rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.desc_cuenta_padre}>
                    <span style={{ fontSize: '0.72rem', background: '#6366f120', color: '#818cf8', borderRadius: 4, padding: '1px 6px' }}>{d.desc_cuenta_padre}</span>
                  </td>
                  <td style={{ padding: '0.4rem 0.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={d.desc_cuenta}>{d.desc_cuenta}</td>
                  <td style={{ padding: '0.4rem 0.75rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#10b981', fontSize: '0.72rem', fontWeight: 600 }} title={d.subvencion_alias}>{d.subvencion_alias}</td>
                  <td style={{ padding: '0.4rem 0.75rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }} title={d.tipo_docs_alias}>{d.tipo_docs_alias}</td>
                  <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtN(d.n_docs)}</td>
                  <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#6366f1', fontVariantNumeric: 'tabular-nums' }}>{fmt(d.monto_declarado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Footer de paginación */}
        <div style={{ padding: '0.6rem 1.25rem', borderTop: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            {filtered.length === 0 ? 0 : safePage * ITEMS_PER_PAGE + 1}–{Math.min((safePage + 1) * ITEMS_PER_PAGE, filtered.length)} de {filtered.length} filas
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button disabled={safePage === 0} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage === 0)}>← Anterior</button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 60, textAlign: 'center' }}>Pág. {safePage + 1} / {totalPages}</span>
            <button disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages - 1)}>Siguiente →</button>
          </div>
        </div>
      </div>
    </>
  )
}
