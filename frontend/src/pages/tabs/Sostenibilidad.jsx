import { useState, useEffect, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useChartColors } from '../../hooks/useChartColors'
import { fmtN, KPICard } from '../../components/DashboardWidgets'
import api from '../../lib/api'

// Opciones de ejemplo para especialidades (Normalmente esto vendría de una API / catálogos)
const ESPECIALIDADES_OPTIONS = [
  { cod: 41001, label: 'Administración' },
  { cod: 41002, label: 'Contabilidad' },
  { cod: 41003, label: 'Secretariado' },
  { cod: 41004, label: 'Ventas' },
  { cod: 41005, label: 'Administración (con mención)' },
  { cod: 51001, label: 'Edificación' },
  { cod: 51002, label: 'Terminaciones de la Construcción' },
  { cod: 51003, label: 'Montaje Industrial' },
  { cod: 51004, label: 'Obras Viales e Infraestructura' },
  { cod: 51005, label: 'Instalaciones Sanitarias' },
  { cod: 51006, label: 'Refrigeración y Climatización' },
  { cod: 51007, label: 'Construcción (con mención)' },
  { cod: 52001, label: 'Mecánica Industrial' },
  { cod: 52002, label: 'Construcciones Metálicas' },
  { cod: 52003, label: 'Mecánica Automotriz' },
  { cod: 52004, label: 'Matricería' },
  { cod: 52005, label: 'Mecánica Industrial (con mención)' },
  { cod: 53001, label: 'Electricidad' },
  { cod: 53002, label: 'Electrónica' },
  { cod: 53003, label: 'Telecomunicaciones' },
  { cod: 54001, label: 'Explotación Minera' },
  { cod: 54002, label: 'Metalurgia Extractiva' },
  { cod: 54003, label: 'Asistencia en Geología' },
  { cod: 55001, label: 'Gráfica' },
  { cod: 56001, label: 'Operaciones de Planta Química' },
  { cod: 56002, label: 'Laboratorio Químico' },
  { cod: 57001, label: 'Mueblería y Terminaciones de la Madera' },
  { cod: 57002, label: 'Procesamiento de la Madera' },
  { cod: 58001, label: 'Programación' },
  { cod: 58002, label: 'Conectividad y Redes' },
  { cod: 61001, label: 'Alimentación Colectiva' },
  { cod: 61002, label: 'Gastronomía' },
  { cod: 61003, label: 'Elaboración Industrial de Alimentos' },
  { cod: 61004, label: 'Gastronomía (con mención)' },
  { cod: 62001, label: 'Vestuario y Confección Textil' },
  { cod: 63001, label: 'Atención de Párvulos' },
  { cod: 63002, label: 'Atención de Enfermería' },
  { cod: 63003, label: 'Atención de Adultos Mayores' },
  { cod: 63004, label: 'Atención Social y Recreativa' },
  { cod: 64001, label: 'Servicios de Hotelería' },
  { cod: 64002, label: 'Servicios de Turismo' },
  { cod: 71001, label: 'Agropecuaria' },
  { cod: 71002, label: 'Forestal' },
  { cod: 71003, label: 'Agropecuaria (con mención)' },
  { cod: 81001, label: 'Acuicultura' },
  { cod: 81002, label: 'Operaciones Portuarias' },
  { cod: 81003, label: 'Pesquería' },
  { cod: 81004, label: 'Tripulación de Naves Mercantes y Especiales' }
]

const ENSE_MAP = {
  10: 'Educación Parvularia',
  110: 'Educación Básica',
  310: 'Educación Media Humanístico-Científica',
  410: 'Educación Media Técnico-Profesional Comercial',
  510: 'Educación Media Técnico-Profesional Industrial',
  610: 'Educación Media Técnico-Profesional Técnica',
  710: 'Educación Media Técnico-Profesional Agrícola',
  810: 'Educación Media Técnico-Profesional Marítima'
}

export function TabSostenibilidad({ periodo, sostId, rdbData, rbdsContextoStr, esContextoAmpliado }) {
  const C = useChartColors()
  const { financiero_rbd = [] } = rdbData || {}
  
  const [codEnse, setCodEnse] = useState('')
  const [codEspe, setCodEspe] = useState('')
  const [rbd, setRbd] = useState('')

  const [metricas, setMetricas] = useState(null)
  const [evolucion, setEvolucion] = useState([])
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const [sortConfig, setSortConfig] = useState(null)

  const requestSort = (key) => {
    let direction = 'desc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc'
    }
    setSortConfig({ key, direction })
  }

  const sortedRanking = useMemo(() => {
    let sortableItems = [...(ranking || [])]
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key] !== null && a[sortConfig.key] !== undefined ? a[sortConfig.key] : -Infinity
        const bVal = b[sortConfig.key] !== null && b[sortConfig.key] !== undefined ? b[sortConfig.key] : -Infinity
        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }
    return sortableItems
  }, [ranking, sortConfig])
  const [availableEnse, setAvailableEnse] = useState(new Set(Object.keys(ENSE_MAP).map(Number)))
  const [availableEspe, setAvailableEspe] = useState(new Set(ESPECIALIDADES_OPTIONS.map(o => o.cod)))

  const fetchData = async () => {
    setLoading(true)
    try {
      let q = ''
      if (codEnse) q += `&cod_ense=${codEnse}`
      if (codEspe) q += `&cod_espe=${codEspe}`
      if (rbd) q += `&rbd=${rbd}`
      if (rbdsContextoStr) q += `&rbds_contexto=${encodeURIComponent(rbdsContextoStr)}`

      const [resMetricas, resEvo, resRanking] = await Promise.all([
        api.get(`/sostenibilidad/metricas?sost_id=${sostId}${q}`),
        api.get(`/sostenibilidad/evolucion?sost_id=${sostId}${q}`),
        api.get(`/sostenibilidad/ranking?sost_id=${sostId}${q}`)
      ])
      
      setMetricas(resMetricas.data)
      setEvolucion(resEvo.data)
      setRanking(resRanking.data)
      
      if (!codEnse && !codEspe && !rbd) {
        const newEnse = new Set()
        const newEspe = new Set()
        resRanking.data.forEach(row => {
          row.ensenanzas?.forEach(c => newEnse.add(Number(c)))
          row.especialidades?.forEach(c => newEspe.add(Number(c)))
        })
        setAvailableEnse(newEnse)
        setAvailableEspe(newEspe)
      }
    } catch (e) {
      console.error('Error fetching sostenibilidad data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
    fetchData()
    // eslint-disable-next-line
  }, [sostId, codEnse, codEspe, rbd])

  const inpSt = { 
    padding: '0.45rem 0.75rem', 
    backgroundColor: 'var(--surface-base)', 
    color: 'var(--text-primary)', 
    border: '1px solid var(--line-subtle)', 
    borderRadius: '0.375rem', 
    fontSize: '0.85rem', 
    minWidth: 200,
    outline: 'none'
  }

  // ── Evolucion Chart Logic ──
  let evoChartOption = {}
  if (evolucion && evolucion.length > 0) {
    const periodos = evolucion.map(d => d.periodo)
    const matData = evolucion.map(d => d.matricula)
    const asisData = evolucion.map(d => d.asistencia)

    evoChartOption = {
      aria: { decal: { show: true } },
      tooltip: { 
        trigger: 'axis', 
        ...C.tooltip,
        formatter: params => {
          let str = `<b>${params[0].axisValue}</b><br/>`
          params.forEach(p => {
            let val = p.value
            if (p.seriesName === 'Asistencia') val = val.toFixed(1) + '%'
            else val = fmtN(val)
            str += `${p.marker} ${p.seriesName}: <b>${val}</b><br/>`
          })
          return str
        }
      },
      legend: { data: ['Matrícula', 'Asistencia'], textStyle: { color: C.axisLabel }, bottom: 0 },
      grid: { left: 10, right: 10, top: 40, bottom: 40, containLabel: true },
      xAxis: { type: 'category', data: periodos, axisLabel: { color: C.axisLabel } },
      yAxis: [
        { 
          type: 'value', 
          name: 'Matrícula', 
          axisLabel: { color: C.axisLabel }, 
          splitLine: { lineStyle: { color: C.splitLine } } 
        },
        { 
          type: 'value', 
          name: 'Asistencia (%)', 
          axisLabel: { color: C.axisLabel, formatter: '{value}%' }, 
          splitLine: { show: false },
          min: 0,
          max: 100
        }
      ],
      series: [
        { 
          name: 'Matrícula', 
          type: 'line', 
          data: matData, 
          itemStyle: { color: '#8b5cf6' }, 
          symbolSize: 6,
          areaStyle: { color: '#8b5cf633' },
          smooth: true 
        },
        { 
          name: 'Asistencia', 
          type: 'line', 
          yAxisIndex: 1, 
          data: asisData, 
          itemStyle: { color: '#10b981' }, 
          symbolSize: 6, 
          smooth: true, 
          lineStyle: { type: 'solid', width: 3 } 
        }
      ],
      backgroundColor: 'transparent'
    }
  }

  const getRiesgoColor = (riesgo) => {
    if (riesgo > 20) return '#ef4444' // Crítico
    if (riesgo > 10) return '#f59e0b' // Moderado
    return '#10b981' // Saludable
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Sostenibilidad:</strong> Cálculo de pérdida de subvención potencial vs capacidad instalada analizando la brecha financiera entre matrícula y asistencia real.
      </div>
      
      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface-overlay)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--line-subtle)' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Filtros Dinámicos:</div>
        
        <select style={inpSt} value={rbd} onChange={(e) => setRbd(e.target.value)}>
          <option value="">🏢 Todos los Establecimientos</option>
          {[...financiero_rbd].sort((a, b) => a.rbd - b.rbd).map(r => (
            <option key={r.rbd} value={r.rbd}>
              {r.rbd} - {r.nom_rbd}
            </option>
          ))}
        </select>

        <select style={inpSt} value={codEnse} onChange={(e) => setCodEnse(e.target.value)}>
          <option value="">🏫 Todos los Niveles</option>
          {Object.entries(ENSE_MAP)
            .filter(([cod]) => availableEnse.has(Number(cod)))
            .map(([cod, label]) => (
            <option key={cod} value={cod}>{label}</option>
          ))}
        </select>
        <select style={inpSt} value={codEspe} onChange={(e) => setCodEspe(e.target.value)}>
          <option value="">⚙️ Todas las Especialidades</option>
          {ESPECIALIDADES_OPTIONS
            .filter(opt => availableEspe.has(opt.cod))
            .map(opt => (
            <option key={opt.cod} value={opt.cod}>{opt.cod} - {opt.label}</option>
          ))}
        </select>
        {(codEnse || codEspe || rbd) && (
          <button 
            onClick={() => { setCodEnse(''); setCodEspe(''); setRbd(''); }}
            style={{ padding: '0.45rem 1rem', background: '#ef444422', color: '#ef4444', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
          >
            ✕ Limpiar Filtros
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Cargando datos...</div>
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            <KPICard 
              icon="👥" 
              label="Matrícula (Promedio Anual)" 
              value={fmtN(metricas?.matricula_total || 0)} 
              color="#3b82f6" 
            />
            <KPICard 
              icon="📅" 
              label="Tasa promedio de asistencia (TPA)" 
              value={`${metricas?.amp ?? 0}%`} 
              color="#10b981" 
              sub="Volumen de subvención mensual"
            />
            <KPICard 
              icon="📉" 
              label="Tasa de Riesgo" 
              value={`${metricas?.tasa_riesgo ?? 0}%`} 
              color={getRiesgoColor(metricas?.tasa_riesgo ?? 0)} 
              sub="Brecha financiera no financiada"
            />
            <KPICard 
              icon="⚠️" 
              label="Alerta Desproporción" 
              value={`${metricas?.alerta_desproporcion > 0 ? '+' : ''}${metricas?.alerta_desproporcion ?? 0}%`} 
              color={metricas?.alerta_desproporcion > 0 ? '#ef4444' : '#10b981'} 
              sub="Var Matrícula vs Var Asistencia (Mes)"
            />
          </div>

          {/* ── Gráfico Evolutivo ── */}
          <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
            <h3 className="chart-title">Evolución Histórica 2020-2024: Matrícula vs Asistencia</h3>
            {evolucion.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos para mostrar.</p>
            ) : (
              <ReactECharts option={evoChartOption} style={{ height: 350 }} />
            )}
          </div>

          {/* ── Ranking de Riesgo ── */}
          <div className="chart-card">
            <h3 className="chart-title">Ranking de Riesgo Financiero por RBD</h3>
            {sortedRanking.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos de ranking.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>#</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Establecimiento</th>
                      {esContextoAmpliado && <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Tipo</th>}
                      <th style={{ padding: '0.75rem 0.5rem' }}>Niveles</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Especialidades</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Matrícula (Promedio Anual)</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>TPA (%)</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Nivel</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Ingreso 2023</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Asistencia 2023</th>
                      <th style={{ padding: '0.75rem 0.5rem', cursor: 'pointer' }} onClick={() => requestSort('elasticidad_2023')}>
                        Elasticidad 2023 {sortConfig?.key === 'elasticidad_2023' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Ingreso 2024</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Asistencia 2024</th>
                      <th style={{ padding: '0.75rem 0.5rem', cursor: 'pointer' }} onClick={() => requestSort('elasticidad_2024')}>
                        Elasticidad 2024 {sortConfig?.key === 'elasticidad_2024' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRanking.slice((page - 1) * 10, page * 10).map((row, i) => {
                      const color = getRiesgoColor(row.tasa_riesgo)
                      const isHigh = row.tasa_riesgo > 20
                      const nivelLabel = isHigh ? 'Crítico' : row.tasa_riesgo > 10 ? 'Moderado' : 'Saludable'
                      const esPropio = row.es_propio !== false // default true
                      const rowBg = esContextoAmpliado && esPropio
                        ? i % 2 === 0 ? 'rgba(30, 64, 175, 0.06)' : 'rgba(30, 64, 175, 0.1)'
                        : i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)'
                      const leftBorder = esContextoAmpliado ? (esPropio ? '3px solid #2563eb' : '3px solid transparent') : 'none'

                      return (
                        <tr key={row.rbd} style={{ borderBottom: '1px solid var(--line-subtle)', background: rowBg, borderLeft: leftBorder }}>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>{(page - 1) * 10 + i + 1}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.nom_rbd}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RBD: {row.rbd}</div>
                          </td>
                          {esContextoAmpliado && (
                            <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                              {esPropio
                                ? <span title="Establecimiento propio" style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '1px 7px', borderRadius: 999 }}>Propio</span>
                                : <span title="Establecimiento de referencia del grupo" style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', background: 'var(--surface-overlay)', padding: '1px 7px', borderRadius: 999 }}>Grupo</span>
                              }
                            </td>
                          )}
                          <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem' }}>
                            {row.ensenanzas?.map(c => ENSE_MAP[c] || c).join(', ') || '-'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem' }}>
                            {row.especialidades?.length ? row.especialidades.map(c => ESPECIALIDADES_OPTIONS.find(o => o.cod === c)?.label || c).join(', ') : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{fmtN(row.matricula)}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>{row.amp.toFixed(1)}%</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span style={{ 
                              background: `${color}22`, 
                              color, 
                              padding: '2px 8px', 
                              borderRadius: '12px', 
                              fontSize: '0.75rem', 
                              fontWeight: 600 
                            }}>
                              {nivelLabel}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            {row.ingresos_2023 !== null ? `$${fmtN(row.ingresos_2023)}` : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            {row.asistencia_2023 !== null ? row.asistencia_2023.toFixed(2) : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            {row.elasticidad_2023 !== null && row.elasticidad_2023 !== undefined ? row.elasticidad_2023.toFixed(2) : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            {row.ingresos_2024 !== null ? `$${fmtN(row.ingresos_2024)}` : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            {row.asistencia_2024 !== null ? row.asistencia_2024.toFixed(2) : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            {row.elasticidad_2024 !== null && row.elasticidad_2024 !== undefined ? row.elasticidad_2024.toFixed(2) : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            
            {sortedRanking.length > 10 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: '0.4rem 0.8rem', border: '1px solid var(--line-subtle)', background: page === 1 ? 'var(--surface-overlay)' : 'var(--surface-base)', color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)', borderRadius: '6px', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >
                  Anterior
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Página {page} de {Math.ceil(sortedRanking.length / 10)}</span>
                <button 
                  onClick={() => setPage(p => Math.min(Math.ceil(sortedRanking.length / 10), p + 1))}
                  disabled={page >= Math.ceil(sortedRanking.length / 10)}
                  style={{ padding: '0.4rem 0.8rem', border: '1px solid var(--line-subtle)', background: page >= Math.ceil(sortedRanking.length / 10) ? 'var(--surface-overlay)' : 'var(--surface-base)', color: page >= Math.ceil(sortedRanking.length / 10) ? 'var(--text-muted)' : 'var(--text-primary)', borderRadius: '6px', cursor: page >= Math.ceil(sortedRanking.length / 10) ? 'not-allowed' : 'pointer' }}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
