import { isTransientTransportError, retryOnTransientError } from '../src/ledger/retryTransient'

const fetchFailed = () => Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } })

describe('isTransientTransportError', () => {
  test('detects undici `fetch failed`', () => {
    expect(isTransientTransportError(new TypeError('fetch failed'))).toBe(true)
  })

  test('detects a transient code on a nested cause', () => {
    const error = new Error('outer', { cause: new Error('inner', { cause: { code: 'ETIMEDOUT' } }) })
    expect(isTransientTransportError(error)).toBe(true)
  })

  test('does not treat chain answers as transient', () => {
    expect(isTransientTransportError(new Error('DID Doc not found'))).toBe(false)
    expect(isTransientTransportError(new Error('Query failed with (18): missing WMA for strategy: BALANCED'))).toBe(
      false
    )
    expect(isTransientTransportError(undefined)).toBe(false)
  })
})

describe('retryOnTransientError', () => {
  test('returns the result without retrying on success', async () => {
    const operation = vi.fn().mockResolvedValue('ok')
    await expect(retryOnTransientError(operation, { baseDelayMs: 1 })).resolves.toBe('ok')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  test('retries transient failures and then succeeds', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(fetchFailed())
      .mockRejectedValueOnce(fetchFailed())
      .mockResolvedValue('ok')
    const onRetry = vi.fn()

    await expect(retryOnTransientError(operation, { baseDelayMs: 1, onRetry })).resolves.toBe('ok')

    expect(operation).toHaveBeenCalledTimes(3)
    expect(onRetry).toHaveBeenCalledTimes(2)
    // Backoff doubles
    expect(onRetry.mock.calls.map(([, , delay]) => delay)).toEqual([1, 2])
  })

  test('gives up after the attempt limit and throws the last error', async () => {
    const error = fetchFailed()
    const operation = vi.fn().mockRejectedValue(error)

    await expect(retryOnTransientError(operation, { attempts: 3, baseDelayMs: 1 })).rejects.toBe(error)
    expect(operation).toHaveBeenCalledTimes(3)
  })

  test('does not retry a real chain error', async () => {
    const error = new Error('DID Doc not found')
    const operation = vi.fn().mockRejectedValue(error)

    await expect(retryOnTransientError(operation, { baseDelayMs: 1 })).rejects.toBe(error)
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
