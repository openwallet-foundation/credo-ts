import { replaceError } from '../replaceError'

describe('replaceError', () => {
  it('passes non-error values through unchanged', () => {
    expect(replaceError('key', 'value')).toBe('value')
    expect(replaceError('key', 42)).toBe(42)
    expect(replaceError('key', null)).toBeNull()
  })

  it('serializes a plain Error', () => {
    const err = new Error('oops')
    const result = replaceError('', err) as Record<string, unknown>
    expect(result.message).toBe('oops')
    expect(result.name).toBe('Error')
    expect(result.stack).toBeDefined()
    expect(result.cause).toBeUndefined()
  })

  it('includes cause when present', () => {
    const cause = new Error('root cause')
    const err = new Error('wrapper', { cause })
    const result = replaceError('', err) as Record<string, unknown>
    expect((result.cause as Record<string, unknown>).message).toBe('root cause')
  })

  it('includes a non-Error cause as-is', () => {
    const err = new Error('wrapper')
    // biome-ignore lint/suspicious/noExplicitAny: test
    ;(err as any).cause = 'string cause'
    const result = replaceError('', err) as Record<string, unknown>
    expect(result.cause).toBe('string cause')
  })

  it('handles a deeply nested cause chain', () => {
    const root = new Error('root')
    const mid = new Error('mid', { cause: root })
    const top = new Error('top', { cause: mid })
    const result = replaceError('', top) as Record<string, unknown>
    const midResult = result.cause as Record<string, unknown>
    expect(midResult.message).toBe('mid')
    const rootResult = midResult.cause as Record<string, unknown>
    expect(rootResult.message).toBe('root')
  })

  it('replaces a circular cause with [Circular] instead of throwing', () => {
    const a = new Error('a')
    const b = new Error('b', { cause: a })
    // biome-ignore lint/suspicious/noExplicitAny: test
    ;(a as any).cause = b // a → b → a
    const result = replaceError('', a) as Record<string, unknown>
    const bResult = result.cause as Record<string, unknown>
    expect(bResult.message).toBe('b')
    expect(bResult.cause).toBe('[Circular]')
  })
})
