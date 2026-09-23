import { useState, useEffect, useMemo } from 'react'
import api from '../../lib/api'
import { useMoneyFmt, fmtN, shortName } from '../../components/DashboardWidgets'
import DocumentosModal from './DocumentosModal'
import { useChartColors } from '../../hooks/useChartColors'
import ReactECharts from 'echarts-for-react'

// Render a single row, recursively if it has children
function TreeRow({ node, level, onVerDocumentos, fmtAmt }) {
  const [expanded, setExpanded] = useState(level < 2) // expand first two levels by default (RBD, Categoría)
  const isLeaf = !node.children || node.children.length === 0

  return (
    <>
      <tr 
        style={{
          borderBottom: '1px solid var(--line-subtle)',
          background: level === 0 ? 'var(--surface-overlay)' : 'var(--surface-base)',
          cursor: isLeaf ? 'default' : 'pointer'
        }}
        onClick={() => { if (!isLeaf) setExpanded(!expanded) }}
      >
        <td style={{ 
          padding: '0.6rem 1rem', 
          paddingLeft: `${1 + level * 1.5}rem`,
          fontWeight: level === 0 ? 700 : (level === 1 ? 600 : 400),
          color: level === 0 ? 'var(--text-primary)' : 'var(--text-secondary)'
        }}>
          {!isLeaf && (
            <span style={{ display: 'inline-block', width: '1.2rem', color: 'var(--text-muted)' }}>
              {expanded ? '▼' : '▶'}
            </span>
          )}
          {isLeaf && <span style={{ display: 'inline-block', width: '1.2rem' }}></span>}
          {node.label}
        </td>
        <td style={{ padding: '0.6rem 1rem', textAlign: 'right', fontWeight: level <= 1 ? 600 : 400 }}>
          {fmtAmt(node.total)}
        </td>
        <td style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
          {node.tipo === 'cuenta' && node.categoria === 'Gasto' && (
            <button 
              onClick={(e) => { e.stopPropagation(); onVerDocumentos(node); }}
              style={{
                padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px',
                background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe',
                cursor: 'pointer'
              }}
            >
              Ver Docs
            </button>
          )}
        </td>
      </tr>
      {expanded && !isLeaf && node.children.map((child, idx) => (
        <TreeRow key={idx} node={child} level={level + 1} onVerDocumentos={onVerDocumentos} fmtAmt={fmtAmt} />
      ))}
    </>
  )
}

export default function IngresoGastoDetalle({ sostId, periodo, rbdsContextoStr, visibleRbds }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalData, setModalData] = useState(null)
  const { fmtAmt, fmtAxisAmt, unitLabel } = useMoneyFmt()
  const C = useChartColors()

  useEffect(() => {
    setLoading(true)
    const rbdsParam = rbdsContextoStr ? `&rbds_contexto=${encodeURIComponent(rbdsContextoStr)}` : ''
    api.get(`/dashboard/ficha-sostenedor/ingreso-gasto-jerarquia?sost_id=${sostId}&periodo=${periodo}${rbdsParam}`)
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [sostId, periodo, rbdsContextoStr])

  // Build Hierarchy
  const { tree, chartData } = useMemo(() => {
    if (!data || data.length === 0) return { tree: [], chartData: [] }
    
    // Agrupación para la tabla
    const rbdMap = new Map()
    data.forEach(row => {
      const { rbd, nom_rbd, categoria, cuenta_alias_padre, desc_cuenta_padre, cuenta_alias, desc_cuenta, monto_declarado } = row
      const monto = Number(monto_declarado) || 0
      
      if (monto === 0) return;
      if (visibleRbds && !visibleRbds.includes(Number(rbd))) return;

      const nombreRbd = nom_rbd && nom_rbd !== 'null' ? nom_rbd : 'ADMINISTRACIÓN CENTRAL'
      const rbdLabel = rbd ? ` (${rbd})` : ''
      const finalRbdLabel = `${nombreRbd}${rbdLabel}`

      if (!rbdMap.has(rbd)) rbdMap.set(rbd, { label: finalRbdLabel, rbd, total: 0, childrenMap: new Map() })
      const rbdNode = rbdMap.get(rbd)
      rbdNode.total += monto

      if (!rbdNode.childrenMap.has(categoria)) rbdNode.childrenMap.set(categoria, { label: categoria, total: 0, childrenMap: new Map() })
      const catNode = rbdNode.childrenMap.get(categoria)
      catNode.total += monto

      const padreLabel = `${cuenta_alias_padre} - ${desc_cuenta_padre || 'Sin descripción'}`
      if (!catNode.childrenMap.has(cuenta_alias_padre)) catNode.childrenMap.set(cuenta_alias_padre, { label: padreLabel, total: 0, childrenMap: new Map() })
      const padreNode = catNode.childrenMap.get(cuenta_alias_padre)
      padreNode.total += monto

      const cuentaLabel = `${cuenta_alias} - ${desc_cuenta || 'Sin descripción'}`
      if (!padreNode.childrenMap.has(cuenta_alias)) {
        padreNode.childrenMap.set(cuenta_alias, { 
          label: cuentaLabel, total: 0, tipo: 'cuenta', categoria, rbd, cuenta_alias
        })
      }
      padreNode.childrenMap.get(cuenta_alias).total += monto
    })

    // Transform maps to arrays
    const buildTree = (map) => {
      return Array.from(map.values()).map(node => {
        if (node.childrenMap) {
          node.children = buildTree(node.childrenMap)
          // Ordenar hijos por total descendente
          node.children.sort((a, b) => b.total - a.total)
          delete node.childrenMap
        }
        return node
      }).sort((a, b) => b.total - a.total)
    }
    const finalTree = buildTree(rbdMap)

    // Datos para el gráfico
    const chartAgg = Array.from(rbdMap.values()).map(rbdNode => {
      const cats = rbdNode.childrenMap || new Map(rbdNode.children?.map(c => [c.label, c]) || [])
      const ingresos = (cats.get('Ingreso')?.total || 0)
      const saldoInicial = (cats.get('Saldo Inicial')?.total || 0)
      const gastos = (cats.get('Gasto')?.total || 0)
      return { name: rbdNode.label.split('(')[0].trim(), ingresos, saldoInicial, gastos, rbd: rbdNode.rbd }
    }).sort((a, b) => (b.ingresos + b.saldoInicial) - (a.ingresos + a.saldoInicial))

    return { tree: finalTree, chartData: chartAgg }
  }, [data, visibleRbds])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}><div className="spinner" /></div>
  if (!tree.length) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay datos jerárquicos de ingresos y gastos.</div>

  const names = chartData.map(d => shortName(d.name, d.rbd))
  const h = Math.max(300, chartData.length * 40)

  const barOption = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = chartData[params[0].dataIndex]
        return `<b>${names[params[0].dataIndex]}</b><br/>
          Ingreso: ${fmtAmt(d.ingresos)}<br/>
          Saldo Inicial: ${fmtAmt(d.saldoInicial)}<br/>
          Gasto: ${fmtAmt(d.gastos)}`
      },
    },
    legend: { data: ['Ingreso', 'Saldo Inicial', 'Gasto'], textStyle: { color: C.axisLabel } },
    color: ['#3b82f6', '#10b981', '#ef4444'],
    grid: { left: 240, right: 60, top: 40, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 11, width: 230, overflow: 'truncate' } },
    series: [
      { name: 'Ingreso', type: 'bar', stack: 'in', data: chartData.map(d => d.ingresos) },
      { name: 'Saldo Inicial', type: 'bar', stack: 'in', data: chartData.map(d => d.saldoInicial), itemStyle: { borderRadius: [0, 4, 4, 0] } },
      { name: 'Gasto', type: 'bar', stack: 'out', data: chartData.map(d => d.gastos), itemStyle: { borderRadius: [0, 4, 4, 0] } },
    ],
    backgroundColor: 'transparent',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Gráfico Ejecutivo */}
      <div className="chart-card">
        <h3 className="chart-title">Composición de Ingresos y Gastos por Establecimiento ({unitLabel})</h3>
        <ReactECharts option={barOption} style={{ height: h }} />
      </div>

      {/* Tabla Jerárquica */}
      <div className="chart-card">
        <h3 className="chart-title" style={{ marginBottom: '1rem' }}>Desglose Detallado</h3>
        <div style={{ overflowX: 'auto', border: '1px solid var(--line-subtle)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead style={{ background: 'var(--surface-raised)', borderBottom: '2px solid var(--line-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Categoría / Cuenta</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', width: '150px' }}>Monto ({unitLabel})</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', width: '100px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {tree.map((node, idx) => (
                <TreeRow 
                  key={idx} 
                  node={node} 
                  level={0} 
                  onVerDocumentos={(cuentaNode) => setModalData(cuentaNode)} 
                  fmtAmt={fmtAmt} 
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalData && (
        <DocumentosModal 
          sostId={sostId} 
          periodo={periodo} 
          rbd={modalData.rbd} 
          cuentaAlias={modalData.cuenta_alias} 
          nombreCuenta={modalData.label.split('-')[1]?.trim() || ''}
          onClose={() => setModalData(null)} 
        />
      )}
    </div>
  )
}
