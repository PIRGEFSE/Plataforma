import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { fmtMM, fmtMonedaCorto } from '../../lib/format'

const COLOR_DOC = '#6366f1'
const COLOR_LIQ = '#10b981'
const COLOR_HAB = '#f59e0b'

export default function Tendencia() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard/tendencia').then(r => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data) return null

  const anios = data.documentos.map(d => d.anio)

  const optionDocs = {
    tooltip: {
      trigger: 'axis',
      formatter: (p) => `${p[0].name}<br/>${p.map(s => `${s.marker}${s.seriesName}: ${fmtMM(s.value)}`).join('<br/>')}`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    legend: { data: ['Monto Documentos'], textStyle: { color: '#94a3b8' } },
    grid: { left: 110, right: 20, top: 40, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtMonedaCorto(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [{
      name: 'Monto Documentos', type: 'bar', data: data.documentos.map(d => d.monto_documentos),
      itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: COLOR_DOC }, { offset: 1, color: '#4338ca' }] } },
      barMaxWidth: 60,
      label: { show: true, position: 'top', color: '#94a3b8', formatter: p => fmtMM(p.value) },
    }],
    backgroundColor: 'transparent',
  }

  const optionRem = {
    tooltip: {
      trigger: 'axis',
      formatter: (p) => `${p[0].name}<br/>${p.map(s => `${s.marker}${s.seriesName}: ${fmtMM(s.value)}`).join('<br/>')}`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    legend: { data: ['Líquido Total', 'Haber Total'], textStyle: { color: '#94a3b8' } },
    grid: { left: 110, right: 20, top: 40, bottom: 40 },
    xAxis: { type: 'category', data: data.remuneraciones.map(r => r.anio), axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtMonedaCorto(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      { name: 'Líquido Total', type: 'line', data: data.remuneraciones.map(r => r.liquido_total), smooth: true, symbol: 'circle', symbolSize: 8, lineStyle: { color: COLOR_LIQ, width: 3 }, itemStyle: { color: COLOR_LIQ }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: COLOR_LIQ + '40' }, { offset: 1, color: 'transparent' }] } } },
      { name: 'Haber Total', type: 'line', data: data.remuneraciones.map(r => r.haber_total), smooth: true, symbol: 'circle', symbolSize: 8, lineStyle: { color: COLOR_HAB, width: 3 }, itemStyle: { color: COLOR_HAB }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: COLOR_HAB + '40' }, { offset: 1, color: 'transparent' }] } } },
    ],
    backgroundColor: 'transparent',
  }

  return (
    <div className="tab-page">
      <div className="tab-header">
        <div>
          <h2 className="tab-title">Tendencia Financiera</h2>
          <p className="tab-subtitle">Evolución del monto de documentos y remuneraciones por año (2020-2024) — en miles de millones de pesos (mM$)</p>
        </div>
      </div>
      <div className="charts-grid-col">
        <div className="chart-card">
          <h3 className="chart-title">Monto Total de Documentos por Año</h3>
          <ReactECharts option={optionDocs} style={{ height: 320 }} theme="dark" />
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Remuneraciones por Año — Líquido vs Haber</h3>
          <ReactECharts option={optionRem} style={{ height: 320 }} theme="dark" />
        </div>
      </div>
    </div>
  )
}
