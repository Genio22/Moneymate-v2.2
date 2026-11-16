import { describe, it, expect } from 'vitest'
import {
  parseTakaToPoisha,
  poishaToTaka,
  formatBDT,
  formatBDTCompact,
} from '../src/utils/money'

describe('money conversion (integer poisha)', () => {
  it('parses whole taka', () => {
    expect(parseTakaToPoisha('450')).toBe(45000)
    expect(parseTakaToPoisha('0')).toBe(0)
  })

  it('parses decimals without float error', () => {
    expect(parseTakaToPoisha('450.50')).toBe(45050)
    expect(parseTakaToPoisha('0.1')).toBe(10)
    expect(parseTakaToPoisha('0.01')).toBe(1)
    // 1.005 + 1.005 style float traps must not leak in
    expect(parseTakaToPoisha('19.99')).toBe(1999)
    expect(parseTakaToPoisha('500000')).toBe(50000000)
  })

  it('rejects invalid input', () => {
    expect(parseTakaToPoisha('12.345')).toBeNull() // more than 2 decimals
    expect(parseTakaToPoisha('abc')).toBeNull()
    expect(parseTakaToPoisha('-5')).toBeNull()
    expect(parseTakaToPoisha('')).toBeNull()
    expect(parseTakaToPoisha('.5')).toBeNull()
    expect(parseTakaToPoisha('12,000.50')).toBe(1200050) // commas tolerated
  })

  it('round-trips through the display string', () => {
    for (const poisha of [1, 99, 100, 45050, 123456789, 50000000]) {
      expect(parseTakaToPoisha(poishaToTaka(poisha))).toBe(poisha)
    }
  })

  it('formats BDT for display', () => {
    expect(formatBDT(45050)).toBe('৳450.50')
    expect(formatBDT(45000)).toBe('৳450')
    expect(formatBDT(50000000)).toBe('৳500,000')
    expect(formatBDT(-2500)).toBe('-৳25')
    expect(formatBDT(null)).toBe('৳0')
  })

  it('formats compact figures', () => {
    expect(formatBDTCompact(50000000)).toBe('৳5L')      // ৳500,000
    expect(formatBDTCompact(5000000000)).toBe('৳5Cr')   // ৳50,00,000 taka = 5 crore
    expect(formatBDTCompact(50000000000)).toBe('৳50Cr') // 5 crore taka = 50 crore
    expect(formatBDTCompact(45050)).toBe('৳450.50')
  })
})
