import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { fmtMoneda, fmtMM, fmtN, nomMes } from '../../lib/format'

// Meses a mostrar en eje X según modo
const MESES_TODOS   = new Set([1, 7])   // Ene y Jul de cada año + último disponible
const MESES_ANIO    = new Set([1, 3, 6, 9, 12]) // Ene, Mar, Jun, Sep, Dic

function KPICard({ label, value, icon, color, sub }) {
  return (
    <div className="kpi-card" style={{ '--accent': color }}>
      <div className="kpi-icon" style={{ background: `${color}20` }}>{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

export default function Resumen() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [periodos, setPeriodos] = useState([])
  const [periodo, setPeriodo] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState('')
  const [mensual, setMensual] = useState([])

  useEffect(() => {
    api.get('/dashboard/filtros/periodos').then(r => setPeriodos(r.data))
    api.get('/dashboard/tendencia-mensual').then(r => setMensual(r.data))
  }, [])

  useEffect(() => {
    setLoading(true)
    const p = periodo ? `?periodo=${periodo}` : ''
    api.get(`/dashboard/resumen${p}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [periodo])

  const handleRefresh = async () => {
    setRefreshing(true)
    setRefreshMsg('Refrescando vistas materializadas… esto puede tardar varios minutos.')
    try {
      const r = await api.post('/dashboard/refresh-mv')
      setRefreshMsg(`✅ ${r.data.message}`)
      const p = periodo ? `?periodo=${periodo}` : ''
      const [d, m] = await Promise.all([
        api.get(`/dashboard/resumen${p}`),
        api.get('/dashboard/tendencia-mensual'),
      ])
      setData(d.data)
      setMensual(m.data)
    } catch {
      setRefreshMsg('❌ Error al refrescar las vistas.')
    } finally {
      setRefreshing(false)
    }
  }

  // ── Datos del sparkline ─────────────────────────────────────────────────
  const mensualFiltrado = periodo
    ? mensual.filter(d => Number(d.periodo) === Number(periodo))
    : mensual

  // Determinar el último mes con datos (para mostrarlo siempre en "todos los períodos")
  const ultimoPunto = mensualFiltrado.length > 0
    ? mensualFiltrado[mensualFiltrado.length - 1]
    : null

  // Regla de visibilidad de etiquetas en eje X
  const mesesVisibles = periodo ? MESES_ANIO : MESES_TODOS

  const xLabels = mensualFiltrado.map(d => `${nomMes(d.mes)} ${d.periodo}`)
  const yValues = mensualFiltrado.map(d => d.monto_total)

  const sparkOption = mensualFiltrado.length > 0 ? {
    tooltip: {
      trigger: 'axis',
      formatter: (p) => `${p[0].name}<br/>${fmtMM(p[0].value)}`,
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 11 },
    },
    grid: { left: 8, right: 8, top: 8, bottom: 32 },
    xAxis: {
      type: 'category',
      data: xLabels,
      boundaryGap: false,
      axisLabel: {
        color: '#94a3b8',
        fontSize: 10,
        interval: 0,
        // Mostrar etiqueta si el mes está en el conjunto de meses visibles
        // o si es el último punto disponible
        formatter: (label, idx) => {
          const d = mensualFiltrado[idx]
          if (!d) return ''
          const mes  = Number(d.mes)
          const esUltimo = !periodo && ultimoPunto &&
            d.periodo === ultimoPunto.periodo &&
            d.mes     === ultimoPunto.mes
          if (mesesVisibles.has(mes) || esUltimo) {
            return periodo
              ? nomMes(mes)           // solo nombre del mes si año específico
              : `${nomMes(mes)}\n${d.periodo}` // Mes\nAño en vista global
          }
          return ''
        },
        rich: { año: { color: '#64748b', fontSize: 9 } },
      },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
    },
    yAxis: { show: false },
    series: [{
      type: 'line',
      data: yValues,
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#6366f1', width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#6366f144' },
            { offset: 1, color: 'transparent' },
          ],
        },
      },
    }],
    backgroundColor: 'transparent',
  } : null

  return (
    <div className="tab-page">
      <div className="tab-header">
        <div>
          <h2 className="tab-title">Resumen Ejecutivo</h2>
          <p className="tab-subtitle">Indicadores financieros consolidados de establecimientos educacionales (2020-2024) — en miles de millones de pesos (mM$)</p>
        </div>
        <div className="filter-group">
          <select className="filter-select" value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="">Todos los períodos</option>
            {periodos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {user?.role === 'admin' && (
            <button
              className="btn-refresh"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refrescar vistas materializadas"
            >
              {refreshing ? '⏳ Refrescando…' : '🔄 Actualizar datos'}
            </button>
          )}
        </div>
      </div>

      {refreshMsg && (
        <div className={`alert ${refreshMsg.startsWith('✅') ? 'alert-success' : refreshMsg.startsWith('❌') ? 'alert-error' : 'alert-info'}`}>
          {refreshMsg}
        </div>
      )}

      {loading ? (
        <div className="loading-area"><div className="spinner" /></div>
      ) : data && (
        <>
          <div className="kpi-grid">
            <KPICard
              label="Monto Total Documentos"
              value={fmtMoneda(data.monto_total_documentos)}
              icon="💵"
              color="#6366f1"
              sub={`${fmtN(data.n_documentos)} documentos registrados`}
            />
            <KPICard
              label="Establecimientos Activos"
              value={fmtN(data.n_establecimientos)}
              icon="🏫"
              color="#10b981"
              sub={`${fmtN(data.n_sostenedores)} sostenedores`}
            />
            <KPICard
              label="Total Remuneraciones Líquidas"
              value={fmtMoneda(data.total_liquido_remuneraciones)}
              icon="💰"
              color="#f59e0b"
              sub={`${fmtN(data.n_funcionarios)} funcionarios`}
            />
            <KPICard
              label="Registros de Remuneraciones"
              value={fmtN(data.n_remuneraciones)}
              icon="📋"
              color="#8b5cf6"
              sub={periodo ? `Año ${periodo}` : 'Acumulado 2020-2024'}
            />
          </div>

          {sparkOption && (
            <div className="chart-card">
              <h3 className="chart-title">
                Evolución Mensual del Monto de Documentos (mM$)
                {periodo ? ` — ${periodo}` : ' — 2020 a 2024'}
              </h3>
              <ReactECharts option={sparkOption} style={{ height: 160 }} theme="dark" />
            </div>
          )}
        </>
      )}
    </div>
  )
}
