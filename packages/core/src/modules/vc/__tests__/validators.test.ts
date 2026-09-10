import { describe, expect, test } from 'vitest'

import { CREDENTIALS_CONTEXT_V2_URL } from '../constants'
import { validateVc2ContextBaseline } from '../validators'

describe('validateVc2ContextBaseline', () => {
  test('normalizes string context and returns valid when value is credentials/v2', () => {
    const result = validateVc2ContextBaseline(CREDENTIALS_CONTEXT_V2_URL)

    expect(result).toEqual({
      isValid: true,
    })
  })

  test('returns invalid when first entry is not credentials/v2', () => {
    const result = validateVc2ContextBaseline(['https://example.org/context/v1', CREDENTIALS_CONTEXT_V2_URL])

    expect(result.isValid).toBe(false)
    expect(result.error?.message).toContain("VC2 @context must start with 'https://www.w3.org/ns/credentials/v2'")
  })

  test('returns invalid when one of the entries is not a URL/object', () => {
    const result = validateVc2ContextBaseline([CREDENTIALS_CONTEXT_V2_URL, 42])

    expect(result.isValid).toBe(false)
    expect(result.error?.message).toContain('entries must be URLs or JSON objects')
  })

  test('returns valid for conformant vc2 context ordered set', () => {
    const result = validateVc2ContextBaseline([
      CREDENTIALS_CONTEXT_V2_URL,
      'https://example.org/context/v1',
      { ex: 'https://example.org#' },
    ])

    expect(result).toEqual({
      isValid: true,
    })
  })
})
