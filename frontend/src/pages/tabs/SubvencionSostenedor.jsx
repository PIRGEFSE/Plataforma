import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { fmtMM, fmtMonedaCorto } from '../../lib/format'
import { useChartColors } from '../../hooks/useChartColors'

const COLORS = ['#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#14b8a6','#f97316','#84cc16']

export default function SubvencionSostenedor() {
  const { user } = useAuth()
  const sostId = user?.sost_id || 69110400

  const [data, setData] = useState([])
  const [periodos, setPeriodos] = useState([])
  const [periodo, setPeriodo] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { api.get('/dashboard/filtros/periodos').then(r => setPeriodos(r.data)) }, [])

  useEffect(() => {
    setLoading(true)
    const p = periodo ? `&periodo=${periodo}` : ''
    api.get(`/dashboard/subvencion-sostenedor?sost_id=${sostId}${p}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [periodo, sostId])

  const C = useChartColors()

  const pieOption = {
    tooltip: {
      trigger: 'item',
      formatter: p => `${p.name}<br/>${fmtMM(p.value)} (${p.percent}%)`,
      ...C.tooltip,
    },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: C.legend.color }, formatter: n => n.length > 20 ? n.slice(0, 20) + '...' : n },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['40%', '50%'],
      data: data.map((d, i) => ({ name: d.subvencion_alias || 'Sin subvención', value: d.monto_total, itemStyle: { color: COLORS[i % COLORS.length] } })),
      label: { show: false }, emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } },
    }],
    backgroundColor: 'transparent',
  }

  const barOption = {
    tooltip: {
      trigger: 'axis',
      formatter: p => `${p[0].name}<br/>${fmtMM(p[0].value)}`,
      ...C.tooltip,
    },
    grid: { left: 130, right: 80, top: 20, bottom: 30 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtMonedaCorto(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: [...data].reverse().map(d => d.subvencion_alias || 'Sin subvención'), axisLabel: { color: C.axisLabel, width: 120, overflow: 'truncate' }, axisLine: { lineStyle: { color: C.axisLine } } },
    series: [{
      type: 'bar',
      data: [...data].reverse().map((d, i) => ({ value: d.monto_total, itemStyle: { color: COLORS[i % COLORS.length] } })),
      barMaxWidth: 30,
      label: { show: true, position: 'right', color: C.axisLabel, formatter: p => fmtMM(p.value) },
    }],
    backgroundColor: 'transparent',
  }

  return (
    <div className="tab-page">
      <div className="tab-header">
        <div>
          <h2 className="tab-title">Distribución por Subvención</h2>
          <p className="tab-subtitle">Monto total de documentos según tipo de subvención — en miles de millones de pesos (mM$)</p>
        </div>
        <select className="filter-select" value={periodo} onChange={e => setPeriodo(e.target.value)}>
          <option value="">Todos los períodos</option>
          {periodos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {loading ? <div className="loading-area"><div className="spinner" /></div> : (
        <div className="charts-grid-2">
          <div className="chart-card">
            <h3 className="chart-title">Distribución Porcentual</h3>
            <ReactECharts option={pieOption} style={{ height: 380 }} />
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Monto por Subvención (mM$)</h3>
            <ReactECharts option={barOption} style={{ height: 380 }} />
          </div>
        </div>
      )}
    </div>
  )
}
