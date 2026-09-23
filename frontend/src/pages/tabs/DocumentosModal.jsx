import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { fmtN, useMoneyFmt } from '../../components/DashboardWidgets'

export default function DocumentosModal({ sostId, periodo, rbd, cuentaAlias, nombreCuenta, onClose }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const { fmtAmt } = useMoneyFmt()

  useEffect(() => {
    setLoading(true)
    api.get(`/dashboard/ficha-sostenedor/documentos-cuenta?sost_id=${sostId}&periodo=${periodo}&rbd=${rbd}&cuenta_alias=${cuentaAlias}`)
      .then(res => setDocs(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [sostId, periodo, rbd, cuentaAlias])

  const total = docs.reduce((acc, d) => acc + Number(d.monto_declarado || 0), 0)

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'var(--surface-raised)',
        borderRadius: '12px',
        width: '100%', maxWidth: '900px',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--line-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--surface-overlay)'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              Detalle de Documentos
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Cuenta: <strong>{cuentaAlias} - {nombreCuenta}</strong> | RBD: <strong>{rbd}</strong>
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer',
              color: 'var(--text-muted)'
            }}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <div className="spinner" />
            </div>
          ) : docs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No se encontraron documentos para esta cuenta.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Se encontraron <strong>{docs.length}</strong> documentos.
                </span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Total: {fmtAmt(total)}
                </span>
              </div>
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--line-subtle)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ background: 'var(--surface-overlay)', borderBottom: '1px solid var(--line-subtle)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Fecha</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>N° Documento</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>RUT</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Nombre / Razón Social</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Detalle</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d, i) => (
                      <tr key={d.id || i} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'var(--surface-base)' : 'var(--surface-overlay)' }}>
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{d.fecha_documento || '-'}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{d.numero_documento || '-'}</td>
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{d.rut_documento || '-'}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{d.nombre_documento || '-'}</td>
                        <td style={{ padding: '0.75rem 1rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.detalle_documento}>
                          {d.detalle_documento || '-'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {fmtAmt(Number(d.monto_declarado))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
