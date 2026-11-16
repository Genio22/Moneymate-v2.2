/**
 * All MoneyMate money values are stored as INTEGER POISHA (1 BDT = 100 poisha).
 * These helpers convert between user input (taka) and poisha WITHOUT floating
 * point arithmetic on the stored value: conversion happens on the integer
 * representation only, and parsing is done on the decimal string.
 */

const TAKA_RE = /^\d{1,15}(\.\d{1,2})?$/

/** "450" | "450.5" | "450.50" | 450 -> 45050 poisha. Returns null when invalid. */
export function parseTakaToPoisha(input) {
  if (input === null || input === undefined) return null
  let s = String(input).trim().replace(/[,\s৳]/g, '')
  if (s === '') return null
  if (!TAKA_RE.test(s)) return null
  const [takaPart, poishaPart = ''] = s.split('.')
  const taka = parseInt(takaPart, 10)
  const poisha = parseInt((poishaPart + '00').slice(0, 2) || '00', 10)
  const value = taka * 100 + poisha
  return Number.isSafeInteger(value) ? value : null
}

/** 45050 -> "450.50" (display/input string) */
export function poishaToTaka(poisha) {
  if (poisha === null || poisha === undefined) return ''
  const sign = poisha < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(poisha))
  const taka = Math.floor(abs / 100)
  const rest = abs % 100
  return `${sign}${taka}.${String(rest).padStart(2, '0')}`
}

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** 45050 -> "৳450.50" (or "৳450" when whole) */
export function formatBDT(poisha, { signed = false } = {}) {
  if (poisha === null || poisha === undefined || Number.isNaN(poisha)) return '৳0'
  const sign = poisha < 0 ? '-' : signed ? '+' : ''
  const abs = Math.abs(Math.trunc(poisha))
  const taka = Math.floor(abs / 100)
  const rest = abs % 100
  const whole = `${sign}৳${nf.format(taka)}`
  return rest === 0 ? whole : `${whole}.${String(rest).padStart(2, '0')}`
}

/** Compact for dashboards: ৳12.5L / ৳2.3Cr / ৳450 */
export function formatBDTCompact(poisha) {
  if (poisha === null || poisha === undefined || Number.isNaN(poisha)) return '৳0'
  const abs = Math.abs(Math.trunc(poisha))
  const sign = poisha < 0 ? '-' : ''
  const taka = abs / 100
  const fmt = (n, suffix) => `${sign}৳${(Math.round(n * 10) / 10).toLocaleString('en-US')}${suffix}`
  if (taka >= 1_00_00_000) return fmt(taka / 1_00_00_000, 'Cr')
  if (taka >= 1_00_000) return fmt(taka / 1_00_000, 'L')
  if (taka >= 1_000) return fmt(taka / 1_000, 'k')
  return formatBDT(poisha)
}
