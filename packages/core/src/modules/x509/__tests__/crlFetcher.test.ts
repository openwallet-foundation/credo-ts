import nock from 'nock'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Agent } from '../../../agent/Agent'
import type { AgentContext } from '../../../agent/context'
import type { InMemoryLruCache } from '../../cache'
import { fetchCrl, getCachedCrlSummary, setCachedCrlSummary } from '../utils/crlFetcher'
import type { X509CrlSummary } from '../utils/crlSummary'
import { X509Error } from '../X509Error'
import { mockCrl, mockCrlHttpError, mockCrlNetworkError, setupCrlAgent } from './x509CrlTestUtils'

const URL_A = 'https://crl.example/a.crl'

const crlSummary: X509CrlSummary = {
  issuerNameSha256: 'ab'.repeat(32),
  issuerPublicJwkThumbprint: 'cd'.repeat(32),
  thisUpdate: 1700000000000,
  nextUpdate: 1700003600000,
  criticalExtensionIds: [],
  serialNumbers: ['0a'],
  revocationDates: [1700000000000],
  reasons: [null],
}

describe('fetchCrl', () => {
  let agent: Agent
  let agentContext: AgentContext
  let cache: InMemoryLruCache

  beforeAll(async () => {
    ;({ agent, agentContext, cache } = await setupCrlAgent())
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  beforeEach(() => {
    cache.clear()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  it('rejects responses larger than maxSizeBytes via Content-Length', async () => {
    mockCrl(URL_A, new Uint8Array(1000))

    await expect(fetchCrl({ url: URL_A, agentContext, maxSizeBytes: 100 })).rejects.toThrow(X509Error)
  })

  it('throws on a non-OK HTTP response', async () => {
    mockCrlHttpError(URL_A, 500)

    await expect(fetchCrl({ url: URL_A, agentContext })).rejects.toThrow(X509Error)
  })

  it('throws an X509Error on a network failure', async () => {
    mockCrlNetworkError(URL_A)

    await expect(fetchCrl({ url: URL_A, agentContext })).rejects.toThrow(X509Error)
  })
})

describe('CRL summary cache helpers', () => {
  let agent: Agent
  let agentContext: AgentContext
  let cache: InMemoryLruCache

  beforeAll(async () => {
    ;({ agent, agentContext, cache } = await setupCrlAgent())
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  beforeEach(() => {
    cache.clear()
  })

  it('round-trips a cached summary and returns null on a miss', async () => {
    expect(await getCachedCrlSummary(agentContext, URL_A)).toBeNull()

    await setCachedCrlSummary(agentContext, URL_A, crlSummary, 3600)

    expect(await getCachedCrlSummary(agentContext, URL_A)).toEqual(crlSummary)
  })

  it('stores the summary under a versioned key with the provided expiry', async () => {
    const setSpy = vi.spyOn(cache, 'set')

    await setCachedCrlSummary(agentContext, URL_A, crlSummary, 1234)

    expect(setSpy).toHaveBeenCalledWith(agentContext, `x509:crl-summary:v1:${URL_A}`, crlSummary, 1234)
    setSpy.mockRestore()
  })

  it('does not cache a summary when the TTL is zero or negative', async () => {
    const setSpy = vi.spyOn(cache, 'set')

    await setCachedCrlSummary(agentContext, URL_A, crlSummary, 0)

    expect(setSpy).not.toHaveBeenCalled()
    expect(await getCachedCrlSummary(agentContext, URL_A)).toBeNull()
    setSpy.mockRestore()
  })

  it('treats a cached value that is not a valid summary as a miss', async () => {
    await cache.set(agentContext, `x509:crl-summary:v1:${URL_A}`, 'not a summary', 3600)
    expect(await getCachedCrlSummary(agentContext, URL_A)).toBeNull()

    await cache.set(agentContext, `x509:crl-summary:v1:${URL_A}`, { ...crlSummary, serialNumbers: ['0a', '0b'] }, 3600)
    expect(await getCachedCrlSummary(agentContext, URL_A)).toBeNull()
  })

  it('treats a throwing cache as a miss', async () => {
    const getSpy = vi.spyOn(cache, 'get').mockRejectedValueOnce(new Error('cache unavailable'))

    expect(await getCachedCrlSummary(agentContext, URL_A)).toBeNull()
    getSpy.mockRestore()
  })
})
