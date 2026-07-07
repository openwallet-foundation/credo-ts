import nock from 'nock'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Agent } from '../../../agent/Agent'
import type { AgentContext } from '../../../agent/context'
import { TypedArrayEncoder } from '../../../utils'
import type { InMemoryLruCache } from '../../cache'
import { fetchCrl, getCachedCrl, setCachedCrl } from '../utils/crlFetcher'
import { X509Error } from '../X509Error'
import { mockCrl, mockCrlHttpError, mockCrlNetworkError, setupCrlAgent } from './x509CrlTestUtils'

const URL_A = 'https://crl.example/a.crl'
const crlData = new Uint8Array([0x30, 0x01, 0x02, 0x03, 0x04, 0x05])

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

describe('CRL cache helpers', () => {
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

  it('round-trips cached bytes and returns null on a miss', async () => {
    expect(await getCachedCrl(agentContext, URL_A)).toBeNull()

    await setCachedCrl(agentContext, URL_A, crlData, 3600)

    const cached = await getCachedCrl(agentContext, URL_A)
    expect(cached).not.toBeNull()
    expect(Array.from(cached as Uint8Array)).toEqual(Array.from(crlData))
  })

  it('stores the cache entry with the provided expiry', async () => {
    const setSpy = vi.spyOn(cache, 'set')

    await setCachedCrl(agentContext, URL_A, crlData, 1234)

    expect(setSpy).toHaveBeenCalledWith(agentContext, `x509:crl:${URL_A}`, TypedArrayEncoder.toBase64(crlData), 1234)
    setSpy.mockRestore()
  })

  it('does not cache when the TTL is zero or negative', async () => {
    const setSpy = vi.spyOn(cache, 'set')

    await setCachedCrl(agentContext, URL_A, crlData, 0)

    expect(setSpy).not.toHaveBeenCalled()
    expect(await getCachedCrl(agentContext, URL_A)).toBeNull()
    setSpy.mockRestore()
  })
})
