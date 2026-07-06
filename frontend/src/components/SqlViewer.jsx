import React from 'react'

export default function SqlViewer({ sql }) {
  if (!sql) return null

  return (
    <details style={{ marginBottom: '1.5rem', background: 'var(--surface-overlay)', border: '1px solid var(--line-subtle)', borderRadius: '0.5rem', overflow: 'hidden' }}>
      <summary style={{ padding: '0.75rem 1rem', cursor: 'pointer', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem', userSelect: 'none', background: 'rgba(0,0,0,0.02)' }}>
        🔍 Ver consulta SQL
      </summary>
      <div style={{ padding: '1rem', borderTop: '1px solid var(--line-subtle)', background: '#1e1e1e', overflowX: 'auto' }}>
        <pre style={{ margin: 0, color: '#d4d4d4', fontSize: '0.8rem', fontFamily: 'monospace' }}>
          <code>{sql}</code>
        </pre>
      </div>
    </details>
  )
}
