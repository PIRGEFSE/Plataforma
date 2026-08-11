import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useChartColors } from '../../hooks/useChartColors'

// ── Etiquetas legibles para cada grado ────────────────────────────────────
const GRADO_LABELS = {
  '4b': '4° Básico',
  '6b': '6° Básico',
  '8b': '8° Básico',
  '2m': '2° Medio',
}

// ── Paletas de colores por rol de la serie ────────────────────────────────
// RBD: azul intenso (destacado)
// Nacional: gris pizarra (referencia global)
// Región(es): verdes/esmeraldas
// Comuna(s): naranjas/ambar (contexto local)
const RBD_COLOR    = '#1e40af'   // azul oscuro
const NAC_COLOR    = '#64748b'   // gris pizarra
const REG_PALETTE  = ['#059669', '#0d9488', '#0891b2', '#16a34a', '#047857']
const COM_PALETTE  = ['#d97706', '#ea580c', '#b45309', '#f59e0b', '#c2410c']

function lineStyle(width = 2, dashType = 'solid') {
  return { width, type: dashType }
}

// ── Construye las series ECharts para un área (lectura o mate) ───────────
function buildSeries({ puntos, comunas, regiones, area }) {
  const series = []
  const campo = area === 'lect' ? 'prom_lect' : 'prom_mate'

  // 1. RBD (promedio ponderado del sostenedor)
  series.push({
    name: 'Sostenedor (RBD)',
    type: 'line',
    smooth: false,
    connectNulls: true,
    data: puntos.map(p => p[`rbd_${area}`] ?? null),
    lineStyle: lineStyle(3),
    symbolSize: 8,
    itemStyle: { color: RBD_COLOR },
    z: 10,
  })

  // 2. Comunas (serie separada por cada una)
  comunas.forEach((com, idx) => {
    series.push({
      name: `Com. ${com.nom_com}`,
      type: 'line',
      smooth: false,
      connectNulls: true,
      data: puntos.map(p => p.comunas?.[String(com.cod_com)]?.[campo] ?? null),
      lineStyle: lineStyle(1.8, 'dashed'),
      symbolSize: 6,
      symbol: 'triangle',
      itemStyle: { color: COM_PALETTE[idx % COM_PALETTE.length] },
    })
  })

  // 3. Regiones (serie separada por cada una)
  regiones.forEach((reg, idx) => {
    series.push({
      name: `Reg. ${reg.nom_reg}`,
      type: 'line',
      smooth: false,
      connectNulls: true,
      data: puntos.map(p => p.regiones?.[String(reg.cod_reg)]?.[campo] ?? null),
      lineStyle: lineStyle(1.8, 'dotted'),
      symbolSize: 6,
      symbol: 'diamond',
      itemStyle: { color: REG_PALETTE[idx % REG_PALETTE.length] },
    })
  })

  // 4. Nacional
  series.push({
    name: 'Nacional',
    type: 'line',
    smooth: false,
    connectNulls: true,
    data: puntos.map(p => p[`nac_${area}`] ?? null),
    lineStyle: lineStyle(1.5, 'dotted'),
    symbolSize: 5,
    symbol: 'circle',
    itemStyle: { color: NAC_COLOR },
    z: 1,
  })

  return series
}

// ── Gráfico de tendencia genérico ─────────────────────────────────────────
function TrendChart({ titulo, puntos, comunas, regiones, area, C }) {
  const agnos = puntos.map(p => String(p.agno))
  const series = buildSeries({ puntos, comunas, regiones, area })

  const legendNames = series.map(s => s.name)

  const option = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'axis',
      ...C.tooltip,
      formatter: (params) => {
        const agno = params[0]?.name ?? ''
        let html = `<b>${agno}</b><br/>`
        params.forEach(p => {
          if (p.value == null) return
          const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:5px"></span>`
          html += `${dot}${p.seriesName}: <b>${Number(p.value).toFixed(1)}</b><br/>`
        })
        return html
      },
    },
    legend: {
      data: legendNames,
      textStyle: { color: C.axisLabel, fontSize: 11 },
      top: 0,
      type: 'scroll',
    },
    grid: { left: 56, right: 20, top: 48, bottom: 36 },
    xAxis: {
      type: 'category',
      data: agnos,
      axisLabel: { color: C.axisLabel },
      axisLine: { lineStyle: { color: C.splitLine } },
    },
    yAxis: {
      type: 'value',
      name: 'Puntaje',
      nameTextStyle: { color: C.axisLabel, fontSize: 11 },
      axisLabel: {
        color: C.axisLabel,
        formatter: v => Math.round(v),
      },
      splitLine: { lineStyle: { color: C.splitLine } },
      min: value => Math.max(150, Math.floor((value.min - 15) / 10) * 10),
    },
    series,
    backgroundColor: 'transparent',
  }

  return (
    <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
      <h3 className="chart-title">{titulo}</h3>
      <ReactECharts option={option} style={{ height: 340 }} notMerge />
    </div>
  )
}

// ── Selector de Grado ─────────────────────────────────────────────────────
function GradoSelector({ grados, selected, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', alignSelf: 'center', marginRight: '0.25rem' }}>
        Grado:
      </span>
      {grados.map(g => {
        const active = g === selected
        return (
          <button
            key={g}
            onClick={() => onChange(g)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '0.5rem',
              border: active ? '1.5px solid #1e40af' : '1.5px solid var(--line-subtle)',
              background: active ? '#1e40af18' : 'var(--surface-overlay)',
              color: active ? '#1e40af' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {GRADO_LABELS[g] ?? g}
          </button>
        )
      })}
    </div>
  )
}

// ── KPI de resumen ────────────────────────────────────────────────────────
function KPIBadge({ label, value, color = '#1e40af' }) {
  return (
    <div style={{
      background: 'var(--surface-overlay)',
      border: '1px solid var(--line-subtle)',
      borderLeft: `4px solid ${color}`,
      borderRadius: '0.5rem',
      padding: '0.6rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.1rem',
    }}>
      <span style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{value ?? '—'}</span>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
    </div>
  )
}

// ── Leyenda explicativa de series ─────────────────────────────────────────
function LeyendaSeries({ comunas, regiones }) {
  const items = [
    { label: 'Sostenedor (prom. ponderado RBD)', color: RBD_COLOR, dash: 'solid', shape: '●' },
    ...comunas.map((c, i) => ({ label: `Comuna: ${c.nom_com}`, color: COM_PALETTE[i % COM_PALETTE.length], dash: 'dashed', shape: '▲' })),
    ...regiones.map((r, i) => ({ label: `Región: ${r.nom_reg}`, color: REG_PALETTE[i % REG_PALETTE.length], dash: 'dotted', shape: '◆' })),
    { label: 'Promedio Nacional', color: NAC_COLOR, dash: 'dotted', shape: '●' },
  ]

  return (
    <div style={{
      display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem',
      padding: '0.6rem 1rem',
      background: 'var(--surface-overlay)',
      borderRadius: '0.5rem',
      border: '1px solid var(--line-subtle)',
      fontSize: '0.78rem',
    }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
          <span style={{
            color: item.color,
            fontSize: '0.9rem',
            lineHeight: 1,
          }}>{item.shape}</span>
          <span style={{
            borderBottom: `2px ${item.dash} ${item.color}`,
            paddingBottom: '1px',
          }}>{item.label}</span>
        </span>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function SIMCESostenedor({ sostId }) {
  const C = useChartColors()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [gradoSel, setGradoSel] = useState(null)

  useEffect(() => {
    setLoading(true)
    setData(null)
    api.get(`/dashboard/ficha-sostenedor/simce?sost_id=${sostId}`)
      .then(r => {
        setData(r.data)
        // seleccionar el primer grado disponible
        if (r.data.grados_disponibles?.length) {
          setGradoSel(prev => prev && r.data.grados_disponibles.includes(prev)
            ? prev
            : r.data.grados_disponibles[0]
          )
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [sostId])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>

  if (!data || !data.grados_disponibles?.length) {
    return (
      <div className="chart-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📈</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          No se encontraron datos SIMCE para este sostenedor.
        </p>
      </div>
    )
  }

  const { grados_disponibles, serie, comunas, regiones, agnos } = data
  const grado = gradoSel ?? grados_disponibles[0]
  const puntos = serie[grado] ?? []

  // KPIs del último año disponible con datos RBD
  const ultimoConDatos = [...puntos].reverse().find(
    p => p.rbd_lect != null || p.rbd_mate != null
  )
  const kpiAnho = ultimoConDatos?.agno
  const kpiLect = ultimoConDatos?.rbd_lect != null
    ? Number(ultimoConDatos.rbd_lect).toFixed(1) : null
  const kpiMate = ultimoConDatos?.rbd_mate != null
    ? Number(ultimoConDatos.rbd_mate).toFixed(1) : null
  const kpiNacLect = ultimoConDatos?.nac_lect != null
    ? Number(ultimoConDatos.nac_lect).toFixed(1) : null
  const kpiNacMate = ultimoConDatos?.nac_mate != null
    ? Number(ultimoConDatos.nac_mate).toFixed(1) : null

  // Diferencia vs Nacional
  const difLect = kpiLect && kpiNacLect
    ? (Number(kpiLect) - Number(kpiNacLect)).toFixed(1) : null
  const difMate = kpiMate && kpiNacMate
    ? (Number(kpiMate) - Number(kpiNacMate)).toFixed(1) : null

  return (
    <div>
      {/* ── Selector de grado ──────────────────────────────────────────── */}
      <GradoSelector grados={grados_disponibles} selected={grado} onChange={setGradoSel} />

      {/* ── KPIs del último año ─────────────────────────────────────────── */}
      {ultimoConDatos && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}>
          <KPIBadge
            label={`Lectura — Sostenedor (${kpiAnho})`}
            value={kpiLect}
            color="#1e40af"
          />
          <KPIBadge
            label={`Matemática — Sostenedor (${kpiAnho})`}
            value={kpiMate}
            color="#0369a1"
          />
          <KPIBadge
            label={`Lectura — Nacional (${kpiAnho})`}
            value={kpiNacLect}
            color="#64748b"
          />
          <KPIBadge
            label={`Matemática — Nacional (${kpiAnho})`}
            value={kpiNacMate}
            color="#64748b"
          />
          {difLect != null && (
            <KPIBadge
              label={`Δ Lectura vs Nacional (${kpiAnho})`}
              value={`${Number(difLect) >= 0 ? '+' : ''}${difLect}`}
              color={Number(difLect) >= 0 ? '#059669' : '#dc2626'}
            />
          )}
          {difMate != null && (
            <KPIBadge
              label={`Δ Matemática vs Nacional (${kpiAnho})`}
              value={`${Number(difMate) >= 0 ? '+' : ''}${difMate}`}
              color={Number(difMate) >= 0 ? '#059669' : '#dc2626'}
            />
          )}
        </div>
      )}

      {/* ── Leyenda de series ──────────────────────────────────────────── */}
      <LeyendaSeries comunas={comunas} regiones={regiones} />

      {/* ── Gráfico Lectura ──────────────────────────────────────────────── */}
      <TrendChart
        titulo={`📖 Tendencia SIMCE — Lectura · ${GRADO_LABELS[grado] ?? grado}`}
        puntos={puntos}
        comunas={comunas}
        regiones={regiones}
        area="lect"
        C={C}
      />

      {/* ── Gráfico Matemática ─────────────────────────────────────────── */}
      <TrendChart
        titulo={`🔢 Tendencia SIMCE — Matemática · ${GRADO_LABELS[grado] ?? grado}`}
        puntos={puntos}
        comunas={comunas}
        regiones={regiones}
        area="mate"
        C={C}
      />

      {/* ── Nota al pie ───────────────────────────────────────────────── */}
      <p style={{
        color: 'var(--text-muted)',
        fontSize: '0.75rem',
        marginTop: '0.5rem',
        padding: '0 0.5rem',
      }}>
        * El puntaje del Sostenedor es el promedio ponderado por número de alumnos evaluados (nalu) de los RBDs activos.
        El promedio Nacional corresponde al promedio simple de todas las regiones del país en <code>dim_simce_region</code>.
        Años mostrados: {agnos?.join(', ')}.
      </p>
    </div>
  )
}
