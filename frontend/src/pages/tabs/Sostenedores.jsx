import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { fmtMM, fmtMonedaCorto } from '../../lib/format'

export default function Sostenedores() {
  const [data, setData] = useState([])
  const [periodos, setPeriodos] = useState([])
  const [periodo, setPeriodo] = useState('')
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(true)

  useEffect(() => { api.get('/dashboard/filtros/periodos').then(r => setPeriodos(r.data)) }, [])
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (periodo) params.set('periodo', periodo)
    params.set('limit', limit)
    api.get(`/dashboard/sostenedores?${params}`).then(r => setData(r.data)).finally(() => setLoading(false))
  }, [periodo, limit])

  const sorted = [...data].sort((a, b) => a.monto_total - b.monto_total)
  const barOption = {
    tooltip: {
      trigger: 'axis',
      formatter: p => `${p[0].name}<br/>${fmtMM(p[0].value)}`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    grid: { left: 200, right: 120, top: 20, bottom: 30 },
    xAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtMonedaCorto(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: sorted.map(d => d.nombre_sost || `ID:${d.sost_id}`), axisLabel: { color: '#94a3b8', width: 190, overflow: 'truncate' }, axisLine: { lineStyle: { color: '#334155' } } },
    series: [{
      type: 'bar', data: sorted.map(d => d.monto_total), barMaxWidth: 28,
      itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#8b5cf6' }] } },
      label: { show: true, position: 'right', color: '#94a3b8', formatter: p => fmtMM(p.value) },
    }],
    backgroundColor: 'transparent',
  }

  return (
    <div className="tab-page">
      <div className="tab-header">
        <div>
          <h2 className="tab-title">Top Sostenedores</h2>
          <p className="tab-subtitle">Sostenedores con mayor monto total de documentos — en miles de millones de pesos (mM$)</p>
        </div>
        <div className="filter-group">
          <select className="filter-select" value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="">Todos los períodos</option>
            {periodos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="filter-select" value={limit} onChange={e => setLimit(e.target.value)}>
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
          </select>
        </div>
      </div>
      {loading ? <div className="loading-area"><div className="spinner" /></div> : (
        <div className="chart-card" style={{ flex: 1 }}>
          <h3 className="chart-title">Top {limit} Sostenedores por Monto (mM$)</h3>
          <ReactECharts option={barOption} style={{ height: Math.max(400, sorted.length * 44) }} theme="dark" />
        </div>
      )}
    </div>
  )
}
