import { createContext, useContext } from 'react'
import { fmtMM, fmtMonedaCorto, fmtN } from '../lib/format'
import { ENS_MAP } from '../lib/edu-constants'

// ── Contexto de formato monetario ─────────────────────────────────────────────
export const MoneyFmtCtx = createContext({
  fmtAmt: fmtMM,
  fmtAxisAmt: fmtMonedaCorto,
  unitLabel: 'mM$',
})
export const useMoneyFmt = () => useContext(MoneyFmtCtx)

// ── Helpers de texto ──────────────────────────────────────────────────────────
export function shortName(nom, rbd) {
  if (!nom) return `RBD ${rbd}`
  return nom.length > 38 ? nom.slice(0, 36) + '…' : nom
}

// ── getEnsenanzas: chips de tipos de enseñanza ────────────────────────────────
export function getEnsenanzas(ee) {
  const claves = ['ens_01','ens_02','ens_03','ens_04','ens_05',
    'ens_06','ens_07','ens_08','ens_09','ens_10','ens_11']
  const unicos = [...new Set(claves.map(k => Number(ee[k] ?? 0)).filter(c => c > 0))]
  if (unicos.length === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', maxWidth: 280 }}>
      {unicos.map(cod => {
        const e = ENS_MAP[cod]
        const lbl = e?.label ?? `Cod ${cod}`
        const clr = e?.color ?? 'var(--text-muted)'
        return (
          <span key={cod} title={lbl}
            style={{ fontSize: '0.7rem', fontWeight: 600, color: clr, whiteSpace: 'nowrap', lineHeight: 1.4 }}>
            {lbl}
          </span>
        )
      })}
    </div>
  )
}

// ── KPICard ───────────────────────────────────────────────────────────────────
export function KPICard({ icon, label, value, color = '#6366f1', sub }) {
  return (
    <div className="kpi-card" style={{ '--accent': color, transform: 'none', transition: 'none' }}>
      <div className="kpi-icon" style={{ background: `${color}20` }}>{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value" style={{ color }}>{value}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

// ── PeriodoSelector ───────────────────────────────────────────────────────────
export function PeriodoSelector({ periodos, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Año:</span>
      <select className="filter-select" value={value}
        onChange={e => onChange(Number(e.target.value))} style={{ minWidth: 90 }}>
        {periodos.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  )
}

// ── UnitSelector ──────────────────────────────────────────────────────────────
export function UnitSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Unidad:</span>
      <select className="filter-select" value={value}
        onChange={e => onChange(e.target.value)} style={{ minWidth: 80 }}>
        <option value="mM">mM$</option>
        <option value="M">M$</option>
        <option value="$">$</option>
      </select>
    </div>
  )
}

// ── BreadcrumbHeader ──────────────────────────────────────────────────────────
export function BreadcrumbHeader({ mainLabel, mainIcon, subLabel, subIcon }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: '1.5rem', borderBottom: '1px solid var(--line-subtle)', paddingBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem',
        fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>{mainIcon} {mainLabel}</span>
        <span style={{ opacity: 0.5 }}>/</span>
        <span style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {subIcon} {subLabel}
        </span>
      </div>
      <button
        onClick={() => window.print()}
        style={{ padding: '0.4rem 0.8rem', borderRadius: '0.375rem', background: 'var(--surface-overlay)',
          color: 'var(--text-primary)', border: '1px solid var(--line-subtle)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}
        title="Descargar Reporte (Imprimir a PDF)">
        🖨️ Exportar Reporte
      </button>
    </div>
  )
}

// ── StickyDashboardHeader ─────────────────────────────────────────────────────
// Header sticky genérico usado por FichaSostenedor y FichaEstablecimiento
export function StickyDashboardHeader({ title, subtitle, children }) {
  return (
    <div className="tab-header" style={{
      position: 'sticky', top: 0,
      margin: '-30px -30px 20px -30px',
      padding: '20px 90px 15px 30px',
      zIndex: 20,
      backgroundColor: 'var(--surface-raised)',
      borderBottom: '1px solid var(--line-subtle)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div>
        <h2 className="tab-title">{title}</h2>
        {subtitle && <p className="tab-subtitle">{subtitle}</p>}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}

// ── Función para construir fmtAmt/fmtAxisAmt desde unitMode ──────────────────


export function buildMoneyFormatters(unitMode) {
  const fmtAmt = (v) => {
    const n = Number(v) || 0
    if (unitMode === 'mM') return fmtMM(n)
    if (unitMode === 'M') {
      const m = n / 1000; const s = m < 0 ? '−' : ''
      return `${s}${Math.abs(m).toLocaleString('es-CL', { maximumFractionDigits: 1 })} M$`
    }
    const s = n < 0 ? '−' : ''
    return `${s}$${Math.abs(Math.round(n)).toLocaleString('es-CL')}`
  }
  const fmtAxisAmt = (v) => {
    const n = Number(v) || 0
    if (unitMode === 'mM') return fmtMonedaCorto(n)
    if (unitMode === 'M') {
      const m = n / 1000
      return Math.abs(m) >= 1000 ? `${(m / 1000).toFixed(1)}MM$` : `${m.toFixed(0)}M$`
    }
    const a = Math.abs(n)
    if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`
    if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (a >= 1e3) return `${(n / 1e3).toFixed(0)}K`
    return `$${Math.round(n).toLocaleString('es-CL')}`
  }
  const unitLabel = unitMode === 'mM' ? 'mM$' : unitMode === 'M' ? 'M$' : '$'
  return { fmtAmt, fmtAxisAmt, unitLabel }
}

export { fmtN }
