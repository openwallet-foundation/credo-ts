import { readFileSync } from 'node:fs'
import { Agent } from '@credo-ts/core'
import nock from 'nock'
import { vi } from 'vitest'
import { getAgentOptions } from '../../../../tests'
import { SdJwtVcService } from '../SdJwtVcService'

type Vector = {
  id: string
  layer: string
  expected: 'accept' | 'reject'
  trust: 'x5c' | 'jwks'
  presentation: string
  status_list?: { uri: string; response: string | null }
}

type Settings = {
  audience: string
  nonce: string
  now: number
  max_skew_seconds: number
  trust_anchors_pem: string[]
}

const vectorsFile = JSON.parse(
  readFileSync(new URL('./polaris-negative-vectors/vectors.json', import.meta.url), 'utf8')
) as { settings: Settings; vectors: Vector[] }
const { settings } = vectorsFile

// Credo takes an SD-JWT VC issuer's key from x5c or a DID, so the two vectors whose issuer key is a JWK in settings.issuer_jwks are left out
const vectors = vectorsFile.vectors.filter((vector) => vector.trust === 'x5c')
const controls = vectors.filter((vector) => vector.expected === 'accept')

// Vectors the file expects refused that this verifier accepts, listed in the pull request that added this test
const accepted = [
  'x5c-includes-anchor',
  'x5c-leaf-names-other-issuer',
  'x5c-leaf-names-other-host',
  'x5c-leaf-uri-beats-host',
]
const differences = vectors.filter((vector) => accepted.includes(vector.id))
const refused = vectors.filter((vector) => vector.expected === 'reject' && !accepted.includes(vector.id))

// The first line of the error each vector is refused with
const reasons: Record<string, string> = {
  'issuer-crit': 'Verify Error: unsupported critical header parameters',
  'kb-crit': 'Verify Error: unsupported critical header parameters in Key Binding JWT',
  'kb-aud-array': 'Invalid Key Binding Jwt',
  'kb-aud-no-prefix': 'The key binding JWT does not contain the expected audience',
  'digest-twice': 'Duplicate digest found in SD-JWT payload',
  'claim-overwrite': 'Disclosed claim name "given_name" conflicts with existing payload key',
  'disclosed-exp': 'Protected claims must not be selectively disclosed: exp',
  'disclosure-four-elements': 'Invalid disclosure data',
  'disclosure-named-sd': 'Reserved disclosure claim name "_sd" is not allowed',
  'kb-typ-jwt': 'Invalid Key Binding Jwt',
  'kb-alg-none': "Expected JWT header 'alg' to be a known JWA signature algorithm, found 'none'",
  'kb-alg-hs256': "EC key with crv 'P-256' does not support alg 'HS256'.",
  'kb-iat-nan': 'Invalid JWT as input',
  'kb-exp-string': 'Verify Error: JWT exp must be a number',
  'issuer-sig-der': 'Invalid raw signature length for EC signature conversion. Expected 64 bytes for crv P-256',
  'x5c-self-signed': 'No trusted certificate was found while validating the X.509 chain',
  'x5c-unknown-root': 'No trusted certificate was found while validating the X.509 chain',
  'x5c-leaf-expired': "Certificate: 'CN=Negative Vectors Test Issuer' used after it is allowed",
  'x5c-intermediate-not-ca':
    "Certificate 'CN=Negative Vectors Test Intermediate' is used as a CA but does not have basicConstraints with ca=true",
  'kb-aud-missing': 'Invalid Key Binding Jwt',
  'kb-nonce-missing': 'Invalid Key Binding Jwt',
  'status-list-unreachable': 'fetch failed',
  'status-list-not-a-token': 'Invalid JWT as input',
  'status-list-lst-truncated': 'Decompression failed: Error: buffer error',
  'status-list-wrong-key':
    'Status List JWT verification failed: The status list signer chain does not match the credential issuer chain, and no dedicated trusted status certificates were configured for the trusted issuer.',
  'status-list-no-authority':
    'Status List JWT verification failed: The status list signer chain does not match the credential issuer chain, and no dedicated trusted status certificates were configured for the trusted issuer.',
  'status-list-expired': 'Status List JWT verification failed: Verify Error: JWT is expired',
  'status-list-index-past-end': 'Index out of bounds',
  'disclosure-unreferenced': 'Unreferenced disclosure(s) detected in SD-JWT',
  'digest-twice-decoy': 'Duplicate digest found in SD-JWT payload',
}

const agent = new Agent(
  getAgentOptions('polaris-negative-vectors', {}, { validitySkewSeconds: settings.max_skew_seconds })
)

const verify = async (vector: Vector) => {
  // Each status list vector states what its uri answers: a Status List Token, another body, or nothing
  const statusList = vector.status_list
  if (statusList) {
    const { origin, pathname } = new URL(statusList.uri)
    const scope = nock(origin).get(pathname)
    if (statusList.response === null) scope.replyWithError('unreachable')
    else scope.reply(200, statusList.response, { 'content-type': 'application/statuslist+jwt' })
  }
  return agent.dependencyManager.resolve(SdJwtVcService).verify(agent.context, {
    sdJwtVc: vector.presentation,
    keyBinding: { audience: settings.audience, nonce: settings.nonce },
    trustedCertificates: settings.trust_anchors_pem,
    now: new Date(settings.now * 1000),
  })
}

describe('Polaris negative vectors for SD-JWT VC presentations', () => {
  beforeAll(async () => {
    // The test certificates are valid at the file's now, so the clock is set to it
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(settings.now * 1000)
    nock.disableNetConnect()
    await agent.initialize()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    vi.useRealTimers()
    await agent.shutdown()
  })

  test('runs 2 controls, 30 vectors to refuse, each with its reason, and 4 differences', () => {
    expect(controls).toHaveLength(2)
    expect(refused).toHaveLength(30)
    expect(refused.map((vector) => vector.id).sort()).toEqual(Object.keys(reasons).sort())
    expect(differences.map((vector) => vector.id).sort()).toEqual([...accepted].sort())
  })

  test.each(controls)('verifies the control $id', async (vector) => {
    const result = await verify(vector)
    expect(result.isValid).toBe(true)
  })

  test.each(refused)('refuses $id ($layer)', async (vector) => {
    const result = await verify(vector)
    expect(result.isValid).toBe(false)
    if (!result.isValid) expect(result.error.message.split('\n')[0]).toBe(reasons[vector.id])
  })

  test.each(differences)('accepts $id, which the file expects refused', async (vector) => {
    const result = await verify(vector)
    expect(result.isValid).toBe(true)
  })
})
