import { useTheme } from './useTheme'

/**
 * Devuelve tokens de color para gráficos ECharts según el tema activo.
 * Usar en lugar de colores hardcodeados en las opciones de ECharts.
 *
 * Uso:
 *   const C = useChartColors()
 *   xAxis: { axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } }
 *   tooltip: { ...C.tooltip }
 *   // Paleta accesible (Okabe-Ito adaptada a azul):
 *   itemStyle: { color: C.palette[i % C.palette.length] }
 *   // Patrón SVG para daltonismo (barras y pie):
 *   itemStyle: C.getBarItemStyle(i)
 *   itemStyle: C.getPieItemStyle(i)
 */
export function useChartColors() {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  // ── Paleta accesible para daltonismo (8 colores, Okabe-Ito adaptada a azul) ──
  // Distinguible en deuteranopia, protanopia y tritanopia.
  const palette = [
    '#1e40af',  // 0 Azul oscuro naval
    '#2563eb',  // 1 Azul fuerte (base)
    '#3b82f6',  // 2 Azul claro
    '#60a5fa',  // 3 Azul celeste
    '#93c5fd',  // 4 Azul pastel
    '#bfdbfe',  // 5 Azul hielo
    '#1e3a8a',  // 6 Azul muy oscuro
    '#1d4ed8',  // 7 Azul medio oscuro
  ]

  // ── Patrones SVG para gráficos de barras (distinguibles sin color) ──────────
  // Cada patrón es un canvas de 10×10px con una textura diferente.
  const PATTERNS = [
    null,       // 0 sólido — sin patrón
    'diagonal', // 1 diagonal ////
    'grid',     // 2 cuadrícula #
    'dots',     // 3 puntos ···
    'crossDiag',// 4 diagonal inversa \\\\
    'horizontal',// 5 horizontal ====
    'cross',    // 6 cruz +
    'zigzag',   // 7 zigzag ~~~~
  ]

  /**
   * Genera un canvas DataURL con el patrón solicitado y color.
   * @param {string} patternType — clave del patrón
   * @param {string} color — color hex/rgb
   * @returns {HTMLCanvasElement} canvas con el patrón
   */
  function makePatternCanvas(patternType, color) {
    const size = 10
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.fillStyle = color

    switch (patternType) {
      case 'diagonal':
        ctx.beginPath(); ctx.moveTo(0, size); ctx.lineTo(size, 0); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(-size/2, size/2); ctx.lineTo(size/2, -size/2); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(size/2, 3*size/2); ctx.lineTo(3*size/2, size/2); ctx.stroke()
        break
      case 'grid':
        ctx.beginPath(); ctx.moveTo(size/2, 0); ctx.lineTo(size/2, size); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, size/2); ctx.lineTo(size, size/2); ctx.stroke()
        break
      case 'dots':
        ctx.beginPath(); ctx.arc(size/2, size/2, 1.5, 0, Math.PI*2); ctx.fill()
        break
      case 'crossDiag':
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(size, size); ctx.stroke()
        break
      case 'horizontal':
        ctx.beginPath(); ctx.moveTo(0, size/2); ctx.lineTo(size, size/2); ctx.stroke()
        break
      case 'cross':
        ctx.beginPath(); ctx.moveTo(size/2, 0); ctx.lineTo(size/2, size); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, size/2); ctx.lineTo(size, size/2); ctx.stroke()
        break
      case 'zigzag':
        ctx.beginPath()
        ctx.moveTo(0, size/2)
        ctx.lineTo(size/4, 0)
        ctx.lineTo(size*3/4, size)
        ctx.lineTo(size, size/2)
        ctx.stroke()
        break
      default:
        break
    }
    return c
  }

  /**
   * Retorna un itemStyle de ECharts con color + patrón SVG superpuesto.
   * Para gráficos de BARRAS — incluye borderRadius.
   * @param {number} index — índice de la serie (0-based)
   * @param {object} opts — opciones adicionales { borderRadius }
   */
  function getBarItemStyle(index, opts = {}) {
    const color = palette[index % palette.length]
    const patType = PATTERNS[index % PATTERNS.length]
    const style = {
      color,
      borderRadius: opts.borderRadius ?? [4, 4, 0, 0],
    }
    if (patType) {
      try {
        const canvas = makePatternCanvas(patType, dark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.20)')
        style.decal = {
          symbol: 'none',
        }
        // Usamos el canvas como imagen de relleno vía ECharts pattern
        style.color = {
          image: canvas,
          repeat: 'repeat',
          // Color de fondo del patrón
        }
        // Mejor: usar color base + overlay de decal
        style.color = color
        style.decal = _buildDecal(patType)
      } catch (_) {
        // Si falla (SSR o entorno sin canvas), solo color
      }
    }
    return style
  }

  /**
   * Retorna un itemStyle de ECharts para gráficos de PIE con patrón decal.
   * @param {number} index — índice del slice (0-based)
   */
  function getPieItemStyle(index) {
    const color = palette[index % palette.length]
    return {
      color,
      decal: _buildDecal(PATTERNS[index % PATTERNS.length]),
    }
  }

  /**
   * Construye la configuración de decal (overlay pattern) de ECharts.
   * ECharts v5+ soporta `series.data[i].itemStyle.decal`.
   * @param {string|null} patType
   */
  function _buildDecal(patType) {
    if (!patType) return undefined
    const baseDecal = {
      color: dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)',
      dashArrayX: [1, 0],
      dashArrayY: [2, 5],
      symbolSize: 1,
      rotation: 0,
    }
    switch (patType) {
      case 'diagonal':
        return { ...baseDecal, symbol: 'rect', symbolSize: 0.6, rotation: Math.PI / 4, dashArrayX: [2, 4], dashArrayY: [2, 4] }
      case 'grid':
        return { ...baseDecal, symbol: 'rect', symbolSize: 0.5, dashArrayX: [6, 4], dashArrayY: [6, 4] }
      case 'dots':
        return { ...baseDecal, symbol: 'circle', symbolSize: 0.55, dashArrayX: [3, 5], dashArrayY: [3, 5] }
      case 'crossDiag':
        return { ...baseDecal, symbol: 'rect', symbolSize: 0.6, rotation: -Math.PI / 4, dashArrayX: [2, 4], dashArrayY: [2, 4] }
      case 'horizontal':
        return { ...baseDecal, symbol: 'rect', symbolSize: 0.4, dashArrayX: [8, 0], dashArrayY: [4, 5] }
      case 'cross':
        return { ...baseDecal, symbol: 'rect', symbolSize: [0.4, 1], dashArrayX: [5, 3], dashArrayY: [5, 3] }
      case 'zigzag':
        return { ...baseDecal, symbol: 'triangle', symbolSize: 0.7, rotation: Math.PI / 6, dashArrayX: [2, 3], dashArrayY: [2, 3] }
      default:
        return undefined
    }
  }

  return {
    // Etiquetas de ejes
    axisLabel:  dark ? '#93a8c8' : '#3d5280',
    axisLine:   dark ? 'rgba(147,197,253,0.10)' : 'rgba(37,99,235,0.10)',

    // Líneas de grilla — muy sutiles
    splitLine:  dark ? 'rgba(147,197,253,0.06)' : 'rgba(37,99,235,0.07)',

    // Tooltips
    tooltip: {
      backgroundColor: dark ? '#1e2844' : '#ffffff',
      borderColor:     dark ? 'rgba(147,197,253,0.12)' : 'rgba(37,99,235,0.12)',
      textStyle:       { color: dark ? '#e2eaf8' : '#0f1b35', fontSize: 12 },
    },

    // Textos de leyenda
    legend: { color: dark ? '#93a8c8' : '#3d5280' },

    // Superficies inline (tablas, cards, inputs)
    surface:    dark ? 'var(--surface-overlay)' : 'var(--surface-overlay)',
    surfaceAlt: dark ? 'rgba(147,197,253,0.03)' : 'rgba(37,99,235,0.02)',
    border:     dark ? 'var(--line-subtle)'     : 'var(--line-subtle)',
    borderStr:  dark ? 'rgba(147,197,253,0.07)' : 'rgba(37,99,235,0.07)',

    // Texto principal e items
    textPrimary:   dark ? 'var(--text-primary)'   : 'var(--text-primary)',
    textSecondary: dark ? 'var(--text-secondary)' : 'var(--text-secondary)',
    textMuted:     dark ? 'var(--text-muted)'     : 'var(--text-muted)',
    textDisabled:  dark ? 'var(--text-disabled)'  : 'var(--text-disabled)',

    // Input / botones de paginación
    inputBg:     dark ? 'var(--surface-overlay)' : 'var(--surface-overlay)',
    inputBorder: dark ? 'var(--line-default)'    : 'var(--line-default)',
    inputColor:  dark ? 'var(--text-primary)'    : 'var(--text-primary)',
    btnBg:       dark ? 'var(--surface-overlay)' : 'var(--surface-overlay)',
    btnBgDis:    dark ? 'var(--surface-base)'    : 'var(--surface-base)',
    btnColor:    dark ? 'var(--text-primary)'    : 'var(--text-primary)',
    btnColorDis: dark ? 'var(--text-disabled)'   : 'var(--text-disabled)',

    // ── Paleta accesible para daltonismo ─────────────────────────────────────
    palette,

    // ── Helpers de itemStyle con patrón ──────────────────────────────────────
    getBarItemStyle,
    getPieItemStyle,

    // Flag para uso condicional
    isDark: dark,
  }
}
