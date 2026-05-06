import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { fmtMM, fmtMonedaCorto } from '../../lib/format'

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899']

export default function EstadoResultado() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('')
  const [periodos, setPeriodos] = useState([])

  useEffect(() => { api.get('/dashboard/filtros/periodos').then(r => setPeriodos(r.data)) }, [])
  useEffect(() => {
    setLoading(true)
    const p = periodo ? `?periodo=${periodo}` : ''
    api.get(`/dashboard/estado-resultado${p}`).then(r => setData(r.data)).finally(() => setLoading(false))
  }, [periodo])

  const tipos = [...new Set(data.map(d => d.desc_tipo_cuenta).filter(Boolean))]
  const anios = [...new Set(data.map(d => d.periodo).filter(Boolean))].sort()

  const seriesData = tipos.map((tipo, i) => ({
    name: tipo, type: 'bar', stack: 'total', barMaxWidth: 60,
    data: anios.map(a => {
      const match = data.find(d => d.desc_tipo_cuenta === tipo && d.periodo === a)
      return match ? match.monto_declarado : 0
    }),
    itemStyle: { color: COLORS[i % COLORS.length] },
  }))

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: p => {
        const lines = p.map(s => `${s.marker}${s.seriesName}: ${fmtMM(s.value)}`).join('<br/>')
        return `${p[0].name}<br/>${lines}`
      },
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    legend: { data: tipos, textStyle: { color: '#94a3b8' }, top: 0, type: 'scroll' },
    grid: { left: 110, right: 20, top: 80, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtMonedaCorto(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: seriesData,
    backgroundColor: 'transparent',
  }

  return (
    <div className="tab-page">
      <div className="tab-header">
        <div>
          <h2 className="tab-title">Estado de Resultado <span className="admin-badge">Admin</span></h2>
          <p className="tab-subtitle">Monto declarado por tipo de cuenta contable y período — en miles de millones de pesos (mM$)</p>
        </div>
        <select className="filter-select" value={periodo} onChange={e => setPeriodo(e.target.value)}>
          <option value="">Todos los períodos</option>
          {periodos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {loading ? <div className="loading-area"><div className="spinner" /></div> : (
        <div className="chart-card" style={{ flex: 1 }}>
          <h3 className="chart-title">Monto por Tipo de Cuenta y Año (mM$)</h3>
          {data.length === 0
            ? <div className="empty-state">No hay datos disponibles para el período seleccionado</div>
            : <ReactECharts option={option} style={{ height: 440 }} theme="dark" />}
        </div>
      )}
    </div>
  )
}
