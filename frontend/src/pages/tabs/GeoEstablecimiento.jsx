import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import api from '../../lib/api'
import { useTheme } from '../../hooks/useTheme'

// ── Colores por dependencia ─────────────────────────────────────────────────
const DEPE_COLORS = {
  1: '#1e40af', // Municipal
  2: '#0891b2', // Part. Subvencionado
  3: '#7c3aed', // Part. Pagado
  4: '#059669', // Corp. Admin. Delegada
  5: '#d97706', // SLEP
  6: '#dc2626', // Otro
}
const DEPE_LABELS = {
  1: 'Corporación Municipal', 2: 'Municipal DAEM', 3: 'Part. Subvencionado',
  4: 'Part. Pagado', 5: 'Corp. Admin. Delegada (DL 3166)', 6: 'Servicio Local de Educación (SLEP)',
}

function depeColor(cod) { return DEPE_COLORS[cod] ?? '#6b7280' }

// ── Popup HTML ──────────────────────────────────────────────────────────────
function buildPopupHtml(f) {
  const p = f.properties
  const color = depeColor(p.cod_depe)
  const depe = DEPE_LABELS[p.cod_depe] ?? `Cod ${p.cod_depe}`
  return `
    <div style="min-width:220px;font-family:system-ui,sans-serif">
      <div style="background:${color};color:#fff;padding:8px 10px;border-radius:6px 6px 0 0;font-weight:700;font-size:0.85rem;line-height:1.3">
        ${p.nom_rbd ?? 'Sin nombre'}
      </div>
      <div style="padding:8px 10px;background:var(--surface-raised,#fff);border-radius:0 0 6px 6px">
        <div style="font-size:0.78rem;color:#64748b;margin-bottom:4px">RBD ${p.rbd} · ${p.nom_com_rbd ?? ''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
          <span style="padding:2px 7px;border-radius:999px;background:${color}22;color:${color};font-size:0.72rem;font-weight:600">${depe}</span>
          ${p.rural_rbd ? '<span style="padding:2px 7px;border-radius:999px;background:#d97706;color:#fff;font-size:0.72rem;font-weight:600">🌿 Rural</span>' : ''}
          ${p.convenio_pie ? '<span style="padding:2px 7px;border-radius:999px;background:#6366f122;color:#6366f1;font-size:0.72rem;font-weight:600">PIE</span>' : ''}
          ${p.pace ? '<span style="padding:2px 7px;border-radius:999px;background:#8b5cf622;color:#8b5cf6;font-size:0.72rem;font-weight:600">PACE</span>' : ''}
        </div>
        <div style="margin-top:6px;font-size:0.78rem;color:#374151">
          <b>Matrícula:</b> ${p.mat_total != null ? Number(p.mat_total).toLocaleString('es-CL') : '—'}
        </div>
      </div>
    </div>`
}

// ── Filtros ─────────────────────────────────────────────────────────────────
const inputSt = {
  padding: '0.35rem 0.65rem',
  background: 'var(--surface-overlay)',
  color: 'var(--text-primary)',
  border: '1px solid var(--line-subtle)',
  borderRadius: '0.375rem',
  fontSize: '0.8rem',
  minWidth: 120,
}

// ── Panel Inferior (Agregados) ──────────────────────────────────────────────
function BottomPanel({ data, isSelected }) {
  const [simceGrade, setSimceGrade] = useState('2M')
  if (!data) return null

  const formatM = (v) => v != null ? `$${(v / 1e6).toFixed(1)}M` : '—'
  const formatP = (v) => v != null ? `${v.toFixed(1)}%` : '—'
  const formatN = (v) => v != null ? Number(v).toLocaleString('es-CL') : '—'

  const availableGrades = Object.keys(data.simce || {}).sort((a, b) => b.localeCompare(a))
  const gradeToUse = availableGrades.includes(simceGrade) ? simceGrade : availableGrades[0]
  const simceData = data.simce?.[gradeToUse]

  return (
    <div style={{
      width: '100%',
      background: 'var(--surface-overlay)', backdropFilter: 'blur(10px)',
      border: '1px solid var(--line-subtle)', borderRadius: '12px',
      padding: '1rem', boxShadow: 'var(--shadow-md)',
      display: 'flex', gap: '1.5rem', flexWrap: 'wrap', flexShrink: 0
    }}>
      {/* Resumen General */}
      <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {isSelected ? '📊 Establecimiento Seleccionado' : '🗺️ Resumen Área Visible'}
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
          <div><b style={{ color: 'var(--text-primary)' }}>Matrícula:</b> {formatN(data.matricula)}</div>
          <div><b style={{ color: 'var(--text-primary)' }}>IVE:</b> {formatP(data.ive * 100)}</div>
          <div><b style={{ color: 'var(--text-primary)' }}>Asistencia:</b> {formatP(data.tasa_asistencia * 100)}</div>
          <div><b style={{ color: 'var(--text-primary)' }}>Ingresos:</b> <span style={{ color: '#059669', fontWeight: 600 }}>{formatM(data.ingresos)}</span></div>
          <div><b style={{ color: 'var(--text-primary)' }}>Gastos:</b> <span style={{ color: '#dc2626', fontWeight: 600 }}>{formatM(data.gastos)}</span></div>
        </div>
      </div>

      {/* Separador */}
      <div style={{ width: 1, background: 'var(--line-subtle)' }} />

      {/* SIMCE */}
      <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>📈 SIMCE 2024</h4>
          {availableGrades.length > 0 && (
            <select style={{ ...inputSt, padding: '0.2rem 0.5rem', minWidth: 'auto', fontSize: '0.75rem' }}
              value={gradeToUse} onChange={e => setSimceGrade(e.target.value)}>
              {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
        </div>

        {!simceData ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No hay datos SIMCE para esta selección.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', fontSize: '0.8rem' }}>
            {/* Lectura */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                Lectura ({formatN(simceData.nalu_lect)} rinden) <span style={{ float: 'right', color: '#3b82f6' }}>Prom: {formatN(simceData.prom_lect)}</span>
              </div>
              <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--surface-raised)' }}>
                {simceData.ins_lect > 0 && <div style={{ width: `${simceData.ins_lect}%`, background: '#ef4444' }} title={`Insuficiente: ${formatP(simceData.ins_lect)}`} />}
                {simceData.ele_lect > 0 && <div style={{ width: `${simceData.ele_lect}%`, background: '#f59e0b' }} title={`Elemental: ${formatP(simceData.ele_lect)}`} />}
                {simceData.ade_lect > 0 && <div style={{ width: `${simceData.ade_lect}%`, background: '#10b981' }} title={`Adecuado: ${formatP(simceData.ade_lect)}`} />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                <span style={{ color: '#ef4444' }}>{formatP(simceData.ins_lect)} Ins.</span>
                <span style={{ color: '#f59e0b' }}>{formatP(simceData.ele_lect)} Ele.</span>
                <span style={{ color: '#10b981' }}>{formatP(simceData.ade_lect)} Ade.</span>
              </div>
            </div>
            {/* Matemática */}
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                Matemática ({formatN(simceData.nalu_mate)} rinden) <span style={{ float: 'right', color: '#3b82f6' }}>Prom: {formatN(simceData.prom_mate)}</span>
              </div>
              <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--surface-raised)' }}>
                {simceData.ins_mate > 0 && <div style={{ width: `${simceData.ins_mate}%`, background: '#ef4444' }} title={`Insuficiente: ${formatP(simceData.ins_mate)}`} />}
                {simceData.ele_mate > 0 && <div style={{ width: `${simceData.ele_mate}%`, background: '#f59e0b' }} title={`Elemental: ${formatP(simceData.ele_mate)}`} />}
                {simceData.ade_mate > 0 && <div style={{ width: `${simceData.ade_mate}%`, background: '#10b981' }} title={`Adecuado: ${formatP(simceData.ade_mate)}`} />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                <span style={{ color: '#ef4444' }}>{formatP(simceData.ins_mate)} Ins.</span>
                <span style={{ color: '#f59e0b' }}>{formatP(simceData.ele_mate)} Ele.</span>
                <span style={{ color: '#10b981' }}>{formatP(simceData.ade_mate)} Ade.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Censo 2024 */}
      {data.censo && (
        <>
          {/* Separador */}
          <div style={{ width: 1, background: 'var(--line-subtle)' }} />

          <div style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              🏠 Censo 2024 <span style={{ fontSize: '0.7rem', fontWeight: 'normal' }}>({data.censo.nivel})</span>
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div><b style={{ color: 'var(--text-primary)' }}>Personas:</b> {formatN(data.censo.personas)}</div>
              <div><b style={{ color: 'var(--text-primary)' }}>Hogares:</b> {formatN(data.censo.hogares)}</div>
              <div><b style={{ color: 'var(--text-primary)' }}>Viviendas:</b> {formatN(data.censo.viviendas)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function GeoEstablecimiento({ sostId }) {
  const { theme } = useTheme()
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const popupRef = useRef(null)
  const geojsonDataRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)

  const [agregadosArea, setAgregadosArea] = useState(null)
  const [selectedRbd, setSelectedRbd] = useState(null)
  const [agregadosSelected, setAgregadosSelected] = useState(null)

  // Filtros
  const [regiones, setRegiones] = useState([])
  const [comunas, setComunas] = useState([])
  const [regionSel, setRegionSel] = useState('')
  const [comunaSel, setComunaSel] = useState('')
  const [modoFiltro, setModoFiltro] = useState('sostenedor') // 'sostenedor' | 'region' | 'comuna' | 'bbox'
  const [periodo, setPeriodo] = useState(2024)

  const latestFilters = useRef({ modoFiltro })

  // Cargar listas de regiones/comunas
  useEffect(() => {
    api.get('/dashboard/geo-establecimientos/filtros').then(r => {
      setRegiones(r.data.regiones ?? [])
    }).catch(() => { })
  }, [])

  useEffect(() => {
    if (!regionSel) { setComunas([]); return }
    api.get(`/dashboard/geo-establecimientos/filtros?cod_reg=${regionSel}`).then(r => {
      setComunas(r.data.comunas ?? [])
    }).catch(() => { })
  }, [regionSel])

  // ── Carga de datos GeoJSON ──────────────────────────────────────────────
  const fetchData = useCallback(async (bboxParam = null) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ periodo })
      if (modoFiltro === 'sostenedor' && sostId) params.set('sost_id', sostId)
      if (modoFiltro === 'region' && regionSel) params.set('cod_reg', regionSel)
      if (modoFiltro === 'comuna' && comunaSel) params.set('cod_com', comunaSel)
      if (modoFiltro === 'bbox' && bboxParam) params.set('bbox', bboxParam)

      api.get(`/dashboard/geo-establecimientos/agregados?${params}`)
        .then(res => setAgregadosArea(res.data))
        .catch(err => console.error("Error cargando agregados:", err))

      const r = await api.get(`/dashboard/geo-establecimientos?${params}`)
      setStats(r.data.stats)
      geojsonDataRef.current = r.data.geojson
      return r.data.geojson
    } catch (e) {
      setError('Error al cargar establecimientos')
      return null
    } finally {
      setLoading(false)
    }
  }, [modoFiltro, regionSel, comunaSel, sostId, periodo])

  // Cargar agregados de RBD seleccionado
  useEffect(() => {
    if (!selectedRbd) {
      setAgregadosSelected(null)
      return
    }
    api.get('/dashboard/geo-establecimientos/agregados', { params: { rbd: selectedRbd, periodo } })
      .then(res => setAgregadosSelected(res.data))
      .catch(() => setAgregadosSelected(null))
  }, [selectedRbd, periodo])

  // ── Actualizar source del mapa ──────────────────────────────────────────
  const updateMapData = useCallback(async (bbox = null) => {
    const geojson = await fetchData(bbox)
    if (!geojson || !mapRef.current) return
    const src = mapRef.current.getSource('establecimientos')
    if (src) src.setData(geojson)
  }, [fetchData])

  useEffect(() => {
    latestFilters.current = { modoFiltro, updateMapData }
  }, [modoFiltro, updateMapData])

  // ── Agregar capas custom ────────────────────────────────────────────────
  const addCustomLayers = useCallback((mapInstance) => {
    if (mapInstance.getSource('establecimientos')) return

    mapInstance.addSource('establecimientos', {
      type: 'geojson',
      data: geojsonDataRef.current || { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 45,
    })

    mapInstance.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'establecimientos',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['step', ['get', 'point_count'], '#60a5fa', 10, '#2563eb', 50, '#1e40af', 200, '#1e3a8a'],
        'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 30, 200, 38],
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    })

    mapInstance.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'establecimientos',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Open Sans Bold'],
        'text-size': 13,
      },
      paint: { 'text-color': '#ffffff' },
    })

    mapInstance.addLayer({
      id: 'establecimientos-point',
      type: 'circle',
      source: 'establecimientos',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'match', ['get', 'cod_depe'],
          1, '#1e40af', 2, '#0891b2', 3, '#7c3aed',
          4, '#059669', 5, '#d97706', '#6b7280',
        ],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 14, 9],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
        'circle-opacity': 0.9,
      },
    })
  }, [])

  // ── Inicializar mapa ────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return

    const isDark = theme === 'dark' || document.documentElement.getAttribute('data-theme') === 'dark'
    const style = isDark
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center: [-70.65, -33.45], // Chile central
      zoom: 5,
      minZoom: 3,
      maxZoom: 18,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), 'bottom-left')
    map.addControl(new maplibregl.FullscreenControl(), 'top-right')

    map.on('load', async () => {
      addCustomLayers(map)
      mapRef.current = map

      // Cargar datos iniciales
      const geojson = await fetchData()
      if (geojson && map.getSource('establecimientos')) {
        map.getSource('establecimientos').setData(geojson)
      }
    })

    // Popup
    const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', offset: 8 })
    popupRef.current = popup

    popup.on('close', () => {
      setSelectedRbd(null)
    })

    map.on('click', 'establecimientos-point', (e) => {
      const f = e.features[0]
      setSelectedRbd(f.properties.rbd)
      popup.setLngLat(f.geometry.coordinates).setHTML(buildPopupHtml(f)).addTo(map)
    })

    // Click en cluster → zoom
    map.on('click', 'clusters', (e) => {
      const f = e.features[0]
      const src = map.getSource('establecimientos')
      src.getClusterExpansionZoom(f.properties.cluster_id, (err, zoom) => {
        if (err) return
        map.easeTo({ center: f.geometry.coordinates, zoom: zoom + 1 })
      })
    })

    map.on('mouseenter', 'establecimientos-point', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'establecimientos-point', () => { map.getCanvas().style.cursor = '' })
    map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = '' })

    // Filtro por bbox al soltar el mapa
    map.on('moveend', () => {
      const { modoFiltro: currentModo, updateMapData: currentUpdate } = latestFilters.current
      if (currentModo !== 'bbox') return
      const b = map.getBounds()
      const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`
      currentUpdate(bbox)
    })

    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cambiar estilo al alternar modo oscuro/claro ────────────────────────
  // Preserva centro, zoom y datos. Usa 'style.load' (una sola emisión)
  // en vez de 'styledata' (se dispara múltiples veces durante la carga).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const isDark = theme === 'dark'
    const newStyle = isDark
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

    // Capturar posición actual antes del swap de estilo
    const center = map.getCenter()
    const zoom = map.getZoom()
    const bearing = map.getBearing()
    const pitch = map.getPitch()

    map.once('style.load', () => {
      if (!mapRef.current) return
      // Re-añadir fuente + capas (se eliminan al cambiar estilo completo)
      addCustomLayers(mapRef.current)
      // Restaurar datos en la nueva fuente
      if (geojsonDataRef.current) {
        const src = mapRef.current.getSource('establecimientos')
        if (src) src.setData(geojsonDataRef.current)
      }
      // Restaurar la vista exacta que tenía el usuario
      mapRef.current.jumpTo({ center, zoom, bearing, pitch })
    })

    // diff:false = reemplaza el estilo limpiamente sin intentar hacer diff
    map.setStyle(newStyle, { diff: false })
  }, [theme, addCustomLayers])

  // Re-cargar al cambiar filtros
  useEffect(() => {
    if (!mapRef.current) return
    if (modoFiltro === 'bbox') {
      const b = mapRef.current.getBounds()
      const bbox = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`
      updateMapData(bbox)
    } else {
      updateMapData()
    }
  }, [modoFiltro, regionSel, comunaSel, periodo, updateMapData])

  const portalNode = document.getElementById('geo-filters-portal')
  const filterToolbar = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>🗺️ Filtrar por:</span>

      {/* Modo */}
      <select style={inputSt} value={modoFiltro} onChange={e => { setModoFiltro(e.target.value); setRegionSel(''); setComunaSel('') }}>
        {sostId && <option value="sostenedor">Mi Sostenedor</option>}
        <option value="region">Región</option>
        <option value="comuna">Comuna</option>
        <option value="bbox">Área visible del mapa</option>
      </select>

      {/* Región */}
      {(modoFiltro === 'region' || modoFiltro === 'comuna') && (
        <select style={inputSt} value={regionSel} onChange={e => { setRegionSel(e.target.value); setComunaSel('') }}>
          <option value="">Seleccionar región…</option>
          {regiones.map(r => <option key={r.cod_reg} value={r.cod_reg}>{r.nom_reg}</option>)}
        </select>
      )}

      {/* Comuna */}
      {modoFiltro === 'comuna' && regionSel && (
        <select style={inputSt} value={comunaSel} onChange={e => setComunaSel(e.target.value)}>
          <option value="">Seleccionar comuna…</option>
          {comunas.map(c => <option key={c.cod_com} value={c.cod_com}>{c.nom_com}</option>)}
        </select>
      )}

      {/* Año */}
      <select style={inputSt} value={periodo} onChange={e => setPeriodo(Number(e.target.value))}>
        {[2020, 2021, 2022, 2023, 2024].map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      {loading && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        Cargando…
      </span>}
      {error && <span style={{ fontSize: '0.78rem', color: '#ef4444' }}>⚠️ {error}</span>}

      {/* Stats */}
      {stats && (
        <div style={{ marginLeft: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span><b style={{ color: 'var(--text-primary)' }}>{stats.total?.toLocaleString('es-CL')}</b> est.</span>
          {stats.con_coords != null && <span><b style={{ color: '#059669' }}>{stats.con_coords?.toLocaleString('es-CL')}</b> georef.</span>}
        </div>
      )}
    </div>
  )

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
      {/* Toolbar Portal */}
      {portalNode ? createPortal(filterToolbar, portalNode) : filterToolbar}

      {/* Leyenda + Mapa */}
      <div style={{ position: 'relative', flex: 1, minHeight: 520 }}>
        {/* Leyenda flotante */}
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 10,
          background: 'var(--surface-raised,rgba(255,255,255,0.95))',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--line-subtle)',
          borderRadius: '0.5rem', padding: '0.6rem 0.8rem',
          fontSize: '0.72rem', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>Dependencia</div>
          {Object.entries(DEPE_LABELS).map(([cod, lbl]) => (
            <div key={cod} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 2 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: DEPE_COLORS[cod], flexShrink: 0 }} />
              <span style={{ color: 'var(--text-muted)' }}>{lbl}</span>
            </div>
          ))}
        </div>

        {/* Mapa */}
        <div ref={mapContainer} style={{ width: '100%', height: '100%', minHeight: 520, borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--line-subtle)' }} />
      </div>

      {/* Bottom Panel (Agregados / Censo) */}
      {(agregadosArea || agregadosSelected) && (
        <BottomPanel
          data={selectedRbd ? agregadosSelected : agregadosArea}
          isSelected={!!selectedRbd}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .maplibregl-popup-content { padding: 0 !important; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.18); }
        .maplibregl-popup-tip { display: none; }
      `}</style>
    </div>
  )
}
