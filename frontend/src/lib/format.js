/**
 * Estándar PIRGEFSE — Opción A: Miles de millones fijo.
 * Todos los montos se expresan en miles de millones de pesos (÷ 1.000.000.000).
 * Abreviatura de referencia: "mM$" = miles de millones de pesos.
 */

const MM = 1_000_000_000          // 1 mil millones
const LOCALE = 'es-CL'

/**
 * Formato completo para KPI cards y tooltips.
 * Ejemplo: $168.273.366.228 → "$168,27 miles de mill."
 */
export function fmtMoneda(valor) {
  const n = Number(valor)
  if (isNaN(n)) return '—'
  const mm = n / MM
  return `$${mm.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} miles de mill.`
}

/**
 * Formato corto para ejes de gráficos.
 * Ejemplo: $168.273.366.228 → "$168,3 mM$"
 */
export function fmtMonedaCorto(valor) {
  const n = Number(valor)
  if (isNaN(n)) return '—'
  const mm = n / MM
  return `$${mm.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mM$`
}

/**
 * Formato de un decimal para ejes muy compactos (tooltip de sparkline, labels de barras).
 * Ejemplo: $3.946.757.617.711 → "$3.946,8 mM$"
 */
export function fmtMM(valor) {
  const n = Number(valor)
  if (isNaN(n)) return '—'
  return `$${(n / MM).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mM$`
}

/** Formateador de números enteros (conteos). */
export const fmtN = (n) => new Intl.NumberFormat(LOCALE).format(n)

/** Nombre corto de los meses en español (base 1). */
const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export const nomMes = (m) => MESES[Number(m)] ?? String(m)
