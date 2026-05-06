import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'

export default function Usuarios() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'viewer' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/auth/users').then(r => setUsers(r.data)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    setCreating(true)
    try {
      await api.post('/auth/users', form)
      setSuccess(`Usuario '${form.username}' creado exitosamente`)
      setForm({ username: '', email: '', password: '', role: 'viewer' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear usuario')
    } finally { setCreating(false) }
  }

  const handleDelete = async (id, username) => {
    if (!confirm(`¿Eliminar usuario '${username}'?`)) return
    try {
      await api.delete(`/auth/users/${id}`)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar usuario')
    }
  }

  return (
    <div className="tab-page">
      <div className="tab-header">
        <div>
          <h2 className="tab-title">Gestión de Usuarios <span className="admin-badge">Admin</span></h2>
          <p className="tab-subtitle">Crear y administrar los usuarios del sistema</p>
        </div>
      </div>
      <div className="users-layout">
        {/* Formulario */}
        <div className="chart-card">
          <h3 className="chart-title">Nuevo Usuario</h3>
          <form onSubmit={handleCreate} className="user-form">
            <div className="form-group"><label>Usuario</label>
              <input type="text" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} required /></div>
            <div className="form-group"><label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} /></div>
            <div className="form-group"><label>Contraseña</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required /></div>
            <div className="form-group"><label>Rol</label>
              <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Creando...' : 'Crear Usuario'}
            </button>
          </form>
        </div>

        {/* Lista de usuarios */}
        <div className="chart-card" style={{ flex: 1 }}>
          <h3 className="chart-title">Usuarios del Sistema</h3>
          {loading ? <div className="loading-area"><div className="spinner" /></div> : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Estado</th><th>Creado</th><th></th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.username}</strong> {u.id === me?.id && <span className="badge-you">Tú</span>}</td>
                      <td>{u.email || '—'}</td>
                      <td><span className={`role-chip role-${u.role}`}>{u.role}</span></td>
                      <td><span className={`status-dot ${u.is_active ? 'active' : 'inactive'}`}>{u.is_active ? 'Activo' : 'Inactivo'}</span></td>
                      <td>{new Date(u.created_at).toLocaleDateString('es-CL')}</td>
                      <td>
                        {u.id !== me?.id && (
                          <button className="btn-danger-sm" onClick={() => handleDelete(u.id, u.username)}>Eliminar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
