import { describe, expect, it } from 'vitest'
import { authRedirectUrl } from './auth'

describe('authRedirectUrl', () => {
  it('keeps the GitHub Pages project path and removes app/hash state', () => {
    expect(
      authRedirectUrl('https://calebmartinc14.github.io/gymnotes/#/feedback?draft=1'),
    ).toBe('https://calebmartinc14.github.io/gymnotes/')
  })

  it('keeps localhost as the callback when signup starts in development', () => {
    expect(authRedirectUrl('http://localhost:5173/#/profile')).toBe('http://localhost:5173/')
  })
})
