import { describe, it, expect } from 'vitest'
import { humanize } from '../src/services/api'
import { validateFile } from '../src/services/storage'

describe('error humanization', () => {
  it('maps RLS failures to friendly copy', () => {
    expect(humanize({ message: 'new row violates row-level security policy' })).toMatch(/not allowed/i)
  })
  it('maps auth failures', () => {
    expect(humanize({ message: 'Invalid login credentials' })).toMatch(/wrong email/i)
    expect(humanize({ message: 'Email not confirmed' })).toMatch(/confirm your email/i)
  })
  it('maps network failures', () => {
    expect(humanize({ message: 'TypeError: Failed to fetch' })).toMatch(/reach MoneyMate/i)
  })
})

describe('receipt file validation', () => {
  const mk = (name, size, type) => ({ name, size, type })
  it('accepts supported images and pdfs', () => {
    expect(validateFile(mk('a.jpg', 1024, 'image/jpeg'))).toBeNull()
    expect(validateFile(mk('a.png', 1024, 'image/png'))).toBeNull()
    expect(validateFile(mk('a.webp', 1024, 'image/webp'))).toBeNull()
    expect(validateFile(mk('a.pdf', 1024, 'application/pdf'))).toBeNull()
  })
  it('rejects oversized files (10 MB)', () => {
    const err = validateFile(mk('big.jpg', 11 * 1024 * 1024, 'image/jpeg'))
    expect(err).toMatch(/larger than 10 MB/)
  })
  it('rejects unsupported types', () => {
    const err = validateFile(mk('virus.exe', 100, 'application/x-msdownload'))
    expect(err).toMatch(/not a supported file type/)
  })
})
