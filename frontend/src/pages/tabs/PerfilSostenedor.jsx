import { useState, useEffect } from 'react'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt, fmtN, shortName, getEnsenanzas } from '../../components/DashboardWidgets'
import { ESTADO_LABELS, ESTADO_COLORS, ENS_MAP } from '../../lib/edu-constants'

export function TabPerfil({ perfil, establecimientos, financiero_rbd = [], loadingRbd, esContextoAmpliado = false, grupoHomogeneoCtx = null }) {
  const { fmtAmt, fmtAxisAmt } = useMoneyFmt()
  const C = useChartColors()
  const [searchTerm, setSearchTerm] = useState('')
  const [ensFilter, setEnsFilter] = useState('')
  const [ruralFilter, setRuralFilter] = useState('all')
  const [pieFilter, setPieFilter] = useState('all')
  const [paceFilter, setPaceFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  const activos = establecimientos.filter(e => e.estado_estab === 1 && e.matricula === 1)
  const sinMat = establecimientos.filter(e => e.estado_estab !== 1 || e.matricula !== 1)
  const [propioFilter, setPropioFilter] = useState('all') // 'all' | 'own' | 'ref'
  const [sortConfig, setSortConfig] = useState({ key: 'ingreso', direction: 'desc' })

  // Mapa RBD → datos financieros para la tabla
  const finMap = Object.fromEntries(financiero_rbd.map(f => [f.rbd, f]))

  const filterText = searchTerm.toLowerCase()

  const hasEnsenanza = (ee, text) => {
    if (!text) return true
    const claves = ['ens_01', 'ens_02', 'ens_03', 'ens_04', 'ens_05', 'ens_06', 'ens_07', 'ens_08', 'ens_09', 'ens_10', 'ens_11']
    const t = text.toLowerCase()
    return claves.some(k => {
      const cod = Number(ee[k] ?? 0)
      if (cod > 0 && ENS_MAP[cod]) return ENS_MAP[cod].label.toLowerCase().includes(t)
      return false
    })
  }

  const filteredEstablecimientos = establecimientos.filter(ee => {
    const matchName = ee.nom_rbd?.toLowerCase().includes(filterText)
    const matchEns = hasEnsenanza(ee, ensFilter)
    const matchRural = ruralFilter === 'all' ? true : ruralFilter === 'yes' ? !!ee.rural_rbd : !ee.rural_rbd
    const matchPie = pieFilter === 'all' ? true : pieFilter === 'yes' ? !!ee.convenio_pie : !ee.convenio_pie
    const matchPace = paceFilter === 'all' ? true : paceFilter === 'yes' ? !!ee.pace : !ee.pace
    const matchPropio = !esContextoAmpliado || propioFilter === 'all' ? true
      : propioFilter === 'own' ? ee.es_propio === true
      : ee.es_propio === false
    return matchName && matchEns && matchRural && matchPie && matchPace && matchPropio
  })

  const inputStyle = { padding: '0.4rem 0.8rem', backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', fontSize: '0.8rem' };

  const availableEnsLabels = [...new Set(establecimientos.flatMap(ee =>
    ['ens_01', 'ens_02', 'ens_03', 'ens_04', 'ens_05', 'ens_06', 'ens_07', 'ens_08', 'ens_09', 'ens_10', 'ens_11']
      .map(k => Number(ee[k] ?? 0)).filter(c => c > 0 && ENS_MAP[c]).map(c => ENS_MAP[c].label)
  ))].sort()

  const sortedEstablecimientos = [...filteredEstablecimientos].sort((a, b) => {
    let valA, valB;
    if (sortConfig.key === 'rbd') {
      valA = Number(a.rbd) || 0;
      valB = Number(b.rbd) || 0;
    } else if (sortConfig.key === 'nom_rbd') {
      valA = (a.nom_rbd || '').toLowerCase();
      valB = (b.nom_rbd || '').toLowerCase();
    } else if (sortConfig.key === 'mat_total') {
      valA = Number(a.mat_total) || 0;
      valB = Number(b.mat_total) || 0;
    } else if (sortConfig.key === 'posicion_gh') {
      valA = a.posicion_gh != null ? Number(a.posicion_gh) : Infinity;
      valB = b.posicion_gh != null ? Number(b.posicion_gh) : Infinity;
    } else {
       const finA = finMap[a.rbd];
       const finB = finMap[b.rbd];
       
       if (sortConfig.key === 'ingreso') {
         valA = finA && finA.ingreso != null ? Number(finA.ingreso) : -Infinity;
         valB = finB && finB.ingreso != null ? Number(finB.ingreso) : -Infinity;
       } else if (sortConfig.key === 'gasto') {
         valA = finA && finA.gasto != null ? Number(finA.gasto) : -Infinity;
         valB = finB && finB.gasto != null ? Number(finB.gasto) : -Infinity;
       } else if (sortConfig.key === 'superavit') {
         valA = finA && finA.superavit != null ? Number(finA.superavit) : -Infinity;
         valB = finB && finB.superavit != null ? Number(finB.superavit) : -Infinity;
       } else if (sortConfig.key === 'saldo_inicial') {
         valA = finA && finA.saldo_inicial != null ? Number(finA.saldo_inicial) : -Infinity;
         valB = finB && finB.saldo_inicial != null ? Number(finB.saldo_inicial) : -Infinity;
       } else if (sortConfig.key === 'saldo_final') {
         valA = finA && (finA.superavit != null || finA.saldo_inicial != null) ? Number(finA.superavit || 0) + Number(finA.saldo_inicial || 0) : -Infinity;
         valB = finB && (finB.superavit != null || finB.saldo_inicial != null) ? Number(finB.superavit || 0) + Number(finB.saldo_inicial || 0) : -Infinity;
       }
    }
    
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedEstablecimientos.length / ITEMS_PER_PAGE)
  const paginatedEstablecimientos = sortedEstablecimientos.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  return (
    <>
      {/* Card de Resumen ancho completo */}
      <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="chart-title">Resumen de Establecimientos</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginTop: '0.5rem' }}>
          {[
            { label: 'Con Matrícula Activa', val: fmtN(activos.length),                               color: '#059669', icon: '✅' },
            { label: 'Cerrados / Receso',   val: fmtN(sinMat.length),                               color: 'var(--text-muted)', icon: '⏸️' },
            { label: 'Convenio PIE',         val: fmtN(activos.filter(e => e.convenio_pie).length), color: '#2563eb', icon: '🔵' },
            { label: 'PACE',                 val: fmtN(activos.filter(e => e.pace).length),          color: '#7c3aed', icon: '🎓' },
            { label: 'Rurales',              val: fmtN(activos.filter(e => e.rural_rbd).length),     color: '#d97706', icon: '🌿' },
            { label: 'Urbanos',              val: fmtN(activos.filter(e => !e.rural_rbd).length),    color: '#0ea5e9', icon: '🏙️' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: 'var(--surface-overlay)', borderRadius: '0.5rem', padding: '0.75rem', border: '1px solid var(--line-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem' }}>{kpi.icon}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color, marginTop: '0.25rem' }}>{kpi.val}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla de establecimientos con ingresos y gastos */}
      <div className="chart-card" style={{ padding: 0 }}>
        <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h3 className="chart-title" style={{ margin: 0 }}>Catálogo de Establecimientos ({fmtN(filteredEstablecimientos.length)} resultados)</h3>
            {loadingRbd && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Cargando datos financieros…</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Buscar Nombre..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} style={{ ...inputStyle, minWidth: '160px' }} />
            <select value={ensFilter} onChange={e => { setEnsFilter(e.target.value); setCurrentPage(1); }} style={{ ...inputStyle, minWidth: '140px' }}>
              <option value="">Enseñanza: Todas</option>
              {availableEnsLabels.map(lbl => <option key={lbl} value={lbl}>{lbl}</option>)}
            </select>
            <select value={ruralFilter} onChange={e => { setRuralFilter(e.target.value); setCurrentPage(1); }} style={inputStyle}>
              <option value="all">Rural: Todos</option><option value="yes">Rural: Sí</option><option value="no">Rural: No</option>
            </select>
            <select value={pieFilter} onChange={e => { setPieFilter(e.target.value); setCurrentPage(1); }} style={inputStyle}>
              <option value="all">PIE: Todos</option><option value="yes">PIE: Sí</option><option value="no">PIE: No</option>
            </select>
            <select value={paceFilter} onChange={e => { setPaceFilter(e.target.value); setCurrentPage(1); }} style={inputStyle}>
              <option value="all">PACE: Todos</option><option value="yes">PACE: Sí</option><option value="no">PACE: No</option>
            </select>
            {esContextoAmpliado && (
              <select value={propioFilter} onChange={e => { setPropioFilter(e.target.value); setCurrentPage(1); }} style={{ ...inputStyle, borderColor: '#2563eb' }}>
                <option value="all">Tipo: Todos</option>
                <option value="own">🔵 Solo Propios</option>
                <option value="ref">⚪ Solo Grupo Ref.</option>
              </select>
            )}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                {[
                  { h: 'RBD', k: 'rbd', align: 'left' },
                  { h: 'Nombre', k: 'nom_rbd', align: 'left' },
                  ...(esContextoAmpliado ? [{ h: 'Tipo', align: 'center' }] : []),
                  { h: 'Pos. GH SNED', k: 'posicion_gh', align: 'right' },
                  { h: 'Estado', align: 'left' },
                  { h: 'Matrícula', k: 'mat_total', align: 'right' },
                  { h: 'Ingresos', k: 'ingreso', align: 'right' },
                  { h: 'Gastos', k: 'gasto', align: 'right' },
                  { h: 'Superávit', k: 'superavit', align: 'right' },
                  { h: 'Saldo Inicial', k: 'saldo_inicial', align: 'right' },
                  { h: 'Saldo Final', k: 'saldo_final', align: 'right' },
                  { h: 'Tipo Enseñanza', align: 'left' },
                  { h: 'Rural', align: 'center' },
                  { h: 'PIE', align: 'center' },
                  { h: 'PACE', align: 'center' },
                ].map(({ h, k, align }) => (
                  <th 
                    key={h} 
                    onClick={k ? () => {
                      let direction = 'asc'
                      if (sortConfig.key === k && sortConfig.direction === 'asc') direction = 'desc'
                      setSortConfig({ key: k, direction })
                    } : undefined}
                    style={{ 
                      padding: '0.6rem 0.9rem', color: 'var(--text-muted)', fontWeight: 600, 
                      textAlign: align, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap',
                      cursor: k ? 'pointer' : 'default', userSelect: k ? 'none' : 'auto'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : (align === 'center' ? 'center' : 'flex-start'), gap: '4px' }}>
                      {h}
                      {k && (
                        <span style={{ fontSize: '0.65rem', color: sortConfig.key === k ? 'var(--text-primary)' : 'transparent' }}>
                          {sortConfig.key === k ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '▲'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedEstablecimientos.map((ee, i) => {
                const estado = ESTADO_LABELS[ee.estado_estab] ?? '—'
                const color = ESTADO_COLORS[ee.estado_estab] ?? '#64748b'
                const fin = finMap[ee.rbd]
                const ingreso = fin ? Number(fin.ingreso) : null
                const gasto = fin ? Number(fin.gasto) : null
                const superav = fin ? Number(fin.superavit) : null
                const saldoInicial = fin ? Number(fin.saldo_inicial) : null
                const saldoFinal = fin ? Number(fin.superavit || 0) + Number(fin.saldo_inicial || 0) : null
                const esPropio = ee.es_propio !== false // por defecto true si no viene el campo
                const rowBg = esContextoAmpliado && esPropio
                  ? i % 2 === 0 ? 'rgba(30, 64, 175, 0.06)' : 'rgba(30, 64, 175, 0.1)'
                  : i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)'
                const leftBorder = esContextoAmpliado ? (esPropio ? '3px solid #2563eb' : '3px solid transparent') : 'none'
                return (
                  <tr key={ee.rbd} style={{ borderBottom: '1px solid var(--line-subtle)', background: rowBg, borderLeft: leftBorder }}>
                    <td style={{ padding: '0.5rem 0.9rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.78rem' }}>{ee.rbd}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: 'var(--text-primary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span title={ee.nom_rbd}>{ee.nom_rbd}</span></td>
                    {esContextoAmpliado && (
                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                        {esPropio
                          ? <span title="Establecimiento propio" style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '1px 7px', borderRadius: 999 }}>Propio</span>
                          : <span title="Establecimiento de referencia del grupo" style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', background: 'var(--surface-overlay)', padding: '1px 7px', borderRadius: 999 }}>Grupo</span>
                        }
                      </td>
                    )}
                    <td style={{ padding: '0.5rem 0.9rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {ee.posicion_gh != null ? <strong style={{ color: '#0ea5e9' }}>{ee.posicion_gh}</strong> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.5rem 0.9rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{estado}</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.9rem', color: 'var(--text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.mat_total)}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: '#1e40af', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{ingreso != null ? fmtAmt(ingreso) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: '#3b82f6', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{gasto != null ? fmtAmt(gasto) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ padding: '0.5rem 0.9rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {superav != null
                        ? <strong style={{ color: superav >= 0 ? '#10b981' : '#ef4444' }}>{fmtAmt(superav)}</strong>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.5rem 0.9rem', color: '#8b5cf6', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{saldoInicial != null ? fmtAmt(saldoInicial) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ padding: '0.5rem 0.9rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {saldoFinal != null
                        ? <strong style={{ color: saldoFinal >= 0 ? '#10b981' : '#ef4444' }}>{fmtAmt(saldoFinal)}</strong>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem' }}>{getEnsenanzas(ee)}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: ee.rural_rbd ? '#f59e0b' : 'var(--text-muted)', textAlign: 'center' }}>{ee.rural_rbd ? '🌿' : '·'}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: ee.convenio_pie ? '#6366f1' : 'var(--text-muted)', textAlign: 'center' }}>{ee.convenio_pie ? '✓' : '·'}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: ee.pace ? '#8b5cf6' : 'var(--text-muted)', textAlign: 'center' }}>{ee.pace ? '✓' : '·'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '1rem', borderTop: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Mostrando {filteredEstablecimientos.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredEstablecimientos.length)} de {filteredEstablecimientos.length}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--line-subtle)', background: currentPage === 1 ? 'var(--surface-base)' : 'var(--surface-overlay)', color: currentPage === 1 ? 'var(--text-disabled)' : 'var(--text-primary)', borderRadius: '0.375rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              Anterior
            </button>
            <span style={{ padding: '0.3rem 0.6rem', color: C.axisLabel, fontSize: '0.85rem' }}>
              Página {currentPage} de {totalPages || 1}
            </span>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--line-subtle)', background: (currentPage === totalPages || totalPages === 0) ? 'var(--surface-base)' : 'var(--surface-overlay)', color: (currentPage === totalPages || totalPages === 0) ? 'var(--text-disabled)' : 'var(--text-primary)', borderRadius: '0.375rem', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer' }}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
