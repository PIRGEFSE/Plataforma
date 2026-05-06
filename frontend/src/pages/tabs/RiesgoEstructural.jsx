import { useEffect, useState } from 'react'
import api from '../../lib/api'
import GastoRemIngreso from './GastoRemIngreso'

// ── Sub-tabs (se puede ampliar con más indicadores de esta dimensión) ─────
const SUB_TABS = [
  { id: 'rem-ingreso', label: 'Gasto Remuneracional sobre Ingreso Depurado', icon: '📊' },
]

export default function RiesgoEstructural() {
  const [subTab, setSubTab] = useState('rem-ingreso')
  const [periodos, setPeriodos] = useState([])
  const [periodo, setPeriodo] = useState('')

  useEffect(() => { api.get('/dashboard/filtros/periodos').then(r => setPeriodos(r.data)) }, [])

  return (
    <div className="tab-page">
      <div className="tab-header">
        <div>
          <h2 className="tab-title">Dimensión: Riesgo Estructural y Comportamiento Financiero</h2>
          <p className="tab-subtitle">Indicadores de presión financiera estructural sobre los establecimientos educacionales</p>
        </div>
        <select className="filter-select" value={periodo} onChange={e => setPeriodo(e.target.value)}>
          <option value="">Todos los períodos</option>
          {periodos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Sub-navegación interna */}
      <div className="sub-tab-nav">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            className={`sub-tab-btn ${subTab === t.id ? 'active' : ''}`}
            onClick={() => setSubTab(t.id)}
          >
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="sub-tab-content">
        {subTab === 'rem-ingreso' && <GastoRemIngreso periodos={periodos} periodo={periodo} />}
      </div>
    </div>
  )
}
