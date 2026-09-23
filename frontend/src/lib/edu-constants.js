// ── Constantes compartidas del Dashboard Educativo ──────────────────────────
// Importado por FichaSostenedor y FichaEstablecimiento

export const RIESGO_COLORS = {
  'Riesgo Bajo':     '#059669',
  'Riesgo Moderado': '#d97706',
  'Riesgo Alto':     '#dc2626',
}

export const EF_COLORS = { Optimo: '#059669', Moderado: '#d97706', Elevado: '#dc2626' }

export const ESTADO_LABELS = { 1: 'Funcionando', 2: 'Receso', 3: 'Cerrado' }
export const ESTADO_COLORS = { 1: '#059669', 2: '#d97706', 3: '#64748b' }

export const COLORS_CHART = [
  '#2563eb','#059669','#d97706','#0ea5e9','#dc2626',
  '#7c3aed','#0891b2','#ca8a04','#047857','#1d4ed8',
]

export const ENS_MAP = {
  10:  { label: 'Parvularia',          color: '#3b82f6' },
  110: { label: 'Básica',              color: '#1d4ed8' },
  160: { label: 'Básica Adultos',      color: '#60a5fa' },
  161: { label: 'Básica Esp. Adultos', color: '#60a5fa' },
  163: { label: 'Básica Cárcel',       color: '#94a3b8' },
  165: { label: 'Básica Ad. Sin Of.',  color: '#60a5fa' },
  167: { label: 'Básica Ad. Con Of.',  color: '#60a5fa' },
  211: { label: 'Esp. Auditiva',       color: '#4f46e5' },
  212: { label: 'Esp. Intelectual',    color: '#4f46e5' },
  213: { label: 'Esp. Visual',         color: '#4f46e5' },
  214: { label: 'Esp. Lenguaje',       color: '#4f46e5' },
  215: { label: 'Esp. Motora',         color: '#4f46e5' },
  216: { label: 'Esp. Autismo',        color: '#4f46e5' },
  217: { label: 'Esp. Relación/Com.',  color: '#4f46e5' },
  218: { label: 'Esp. Múltiple',       color: '#4f46e5' },
  219: { label: 'Esp. Sordoceguera',   color: '#4f46e5' },
  299: { label: 'PIE Opción 4',        color: '#6366f1' },
  310: { label: 'Media H-C',           color: '#1e40af' },
  360: { label: 'Media H-C Adultos',   color: '#93c5fd' },
  361: { label: 'Media H-C Ad.',       color: '#93c5fd' },
  362: { label: 'Media H-C Cárcel',    color: '#94a3b8' },
  363: { label: 'Media H-C Ad.',       color: '#93c5fd' },
  410: { label: 'TP Comercial',        color: '#0284c7' },
  460: { label: 'TP Comercial Ad.',    color: '#38bdf8' },
  461: { label: 'TP Comercial Ad.',    color: '#38bdf8' },
  463: { label: 'TP Comercial Ad.',    color: '#38bdf8' },
  510: { label: 'TP Industrial',       color: '#0369a1' },
  560: { label: 'TP Industrial Ad.',   color: '#7dd3fc' },
  561: { label: 'TP Industrial Ad.',   color: '#7dd3fc' },
  563: { label: 'TP Industrial Ad.',   color: '#7dd3fc' },
  610: { label: 'TP Técnica',          color: '#075985' },
  660: { label: 'TP Técnica Ad.',      color: '#bae6fd' },
  661: { label: 'TP Técnica Ad.',      color: '#bae6fd' },
  663: { label: 'TP Técnica Ad.',      color: '#bae6fd' },
  710: { label: 'TP Agrícola',         color: '#0c4a6e' },
  760: { label: 'TP Agrícola Ad.',     color: '#e0f2fe' },
  761: { label: 'TP Agrícola Ad.',     color: '#e0f2fe' },
  763: { label: 'TP Agrícola Ad.',     color: '#e0f2fe' },
  810: { label: 'TP Marítima',         color: '#0284c7' },
  860: { label: 'TP Marítima Ad.',     color: '#bae6fd' },
  863: { label: 'TP Marítima Ad.',     color: '#bae6fd' },
  910: { label: 'Media Artística',     color: '#1e3a8a' },
  963: { label: 'Art. Adultos',        color: '#bfdbfe' },
}
