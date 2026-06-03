import { useTheme } from './useTheme'

/**
 * Devuelve tokens de color para gráficos ECharts según el tema activo.
 * Usar en lugar de colores hardcodeados en las opciones de ECharts.
 *
 * Uso:
 *   const C = useChartColors()
 *   xAxis: { axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } }
 *   tooltip: { ...C.tooltip }
 */
export function useChartColors() {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  return {
    // Etiquetas de ejes
    axisLabel:  dark ? '#8e9ab5' : '#5a6480',
    axisLine:   dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',

    // Líneas de grilla — muy sutiles
    splitLine:  dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',

    // Tooltips
    tooltip: {
      backgroundColor: dark ? '#252a3a' : '#ffffff',
      borderColor:     dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)',
      textStyle:       { color: dark ? '#dce3f0' : '#1e2540', fontSize: 12 },
    },

    // Textos de leyenda
    legend: { color: dark ? '#8e9ab5' : '#5a6480' },

    // Superficies inline (tablas, cards, inputs)
    surface:    dark ? 'var(--surface-overlay)' : 'var(--surface-overlay)',
    surfaceAlt: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    border:     dark ? 'var(--line-subtle)'     : 'var(--line-subtle)',
    borderStr:  dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',

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

    // Flag para uso condicional
    isDark: dark,
  }
}
