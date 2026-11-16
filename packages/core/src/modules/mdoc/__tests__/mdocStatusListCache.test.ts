import { Buffer } from 'node:buffer'
import { MediaTypes, StatusType } from '@owf/token-status-list'
import type { DcqlQuery } from 'dcql'
import nock from 'nock'
import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { TypedArrayEncoder } from '../../../utils'
import { CacheModuleConfig } from '../../cache'
import { KnownJwaSignatureAlgorithms, PublicJwk } from '../../kms'
import { TokenStatusListApi, TokenStatusListModule } from '../../token-status-list'
import { ClaimFormat } from '../../vc'
import { type X509Certificate, X509Service } from '../../x509'
import { Mdoc } from '../Mdoc'
import { MdocDeviceResponse } from '../MdocDeviceResponse'

const docType = 'org.iso.18013.5.1.mDL'
const namespace = 'org.iso.18013.5.1'

const dcqlQuery = {
  credentials: [
    {
      id: 'mdl',
      format: ClaimFormat.MsoMdoc,
      multiple: false,
      require_cryptographic_holder_binding: true,
      meta: { doctype_value: docType },
      claims: [{ path: [namespace, 'family_name'] }],
    },
  ],
} satisfies DcqlQuery

const sessionTranscriptOptions = {
  type: 'openId4VpDraft18',
  clientId: 'Cq1anPb8vZU5j5C0d7hcsbuJLBpIawUJIDQRi2Ebwb4',
  responseUri: 'https://example.org/callback',
  verifierGeneratedNonce: 'abcdefg',
  mdocGeneratedNonce: '123456',
} as const

type Format = 'cwt' | 'jwt'

describe.each<Format>(['cwt', 'jwt'])('mdoc status list cache with a %s status list', (format) => {
  const agent = new Agent(getAgentOptions(`mdoc-status-list-cache-${format}`, {}))
  const noCacheAgent = new Agent(
    getAgentOptions(
      `mdoc-status-list-no-cache-${format}`,
      {},
      {},
      {
        tokenStatusList: new TokenStatusListModule({ statusListCacheExpirySeconds: 0 }),
      }
    )
  )

  const notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const notAfter = new Date(Date.now() + 24 * 60 * 60 * 1000)

  beforeAll(async () => {
    await agent.initialize()
    await noCacheAgent.initialize()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(async () => {
    await agent.shutdown()
    await noCacheAgent.shutdown()
  })

  const createCertificate = async (testAgent: Agent) => {
    const key = await testAgent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const certificate = await X509Service.createCertificate(testAgent.context, {
      authorityKey: PublicJwk.fromPublicJwk(key.publicJwk),
      validity: { notBefore, notAfter },
      issuer: 'C=DE',
    })
    certificate.keyId = key.keyId

    return certificate
  }

  /** Create a status list token, with the status at index 1 revoked when `revoked` is set. */
  const createStatusList = async (
    testAgent: Agent,
    path: string,
    signer: X509Certificate,
    { revoked = false }: { revoked?: boolean } = {}
  ) => {
    const uri = `https://example.org/token-status-list/${format}/${path}`
    const tokenStatusList = testAgent.context.resolve(TokenStatusListApi)
    const options = {
      signer: { method: 'x5c' as const, x5c: [signer] },
      alg: KnownJwaSignatureAlgorithms.ES256,
    }
    const createOptions = {
      ...options,
      statusList: { statusListLength: 10, bitsPerStatus: 1 as const },
      statusListUri: uri,
      // ISO 18013-5 12.3.6.3 requires the status list token to have an expiration time
      expiresAt: notAfter,
    }

    const { statusList } =
      format === 'cwt'
        ? await tokenStatusList.createTokenStatusList({ ...createOptions, format: 'cwt' })
        : await tokenStatusList.createTokenStatusList({ ...createOptions, format: 'jwt' })
    if (!revoked) return { uri, token: statusList }

    const status = { index: 1, status: StatusType.Invalid }
    const { statusList: revokedStatusList } =
      typeof statusList === 'string'
        ? await tokenStatusList.updateTokenStatusList({ ...options, format: 'jwt', token: statusList, status })
        : await tokenStatusList.updateTokenStatusList({ ...options, format: 'cwt', token: statusList, status })

    return { uri, token: revokedStatusList }
  }

  const mockStatusList = (uri: string, token: string | Uint8Array, times = 1) =>
    nock('https://example.org')
      .get(new URL(uri).pathname)
      .times(times)
      .reply(200, typeof token === 'string' ? token : Buffer.from(token), {
        'Content-Type': typeof token === 'string' ? MediaTypes.StatusListJwt : MediaTypes.StatusListCwt,
      })

  const cacheKey = (uri: string) =>
    `token-status-list:${format === 'cwt' ? 'statusListCwt' : 'statusListJwt'}:v1:${uri}`
  const cacheValue = (token: string | Uint8Array) =>
    typeof token === 'string' ? token : TypedArrayEncoder.toBase64Url(token)

  const getCached = (testAgent: Agent, uri: string) =>
    testAgent.context.resolve(CacheModuleConfig).cache.get(testAgent.context, cacheKey(uri), { scope: 'global' })

  const signMdoc = async (testAgent: Agent, issuerCertificate: X509Certificate, statusListUri: string) => {
    const holderKey = await testAgent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const mdoc = await Mdoc.sign(testAgent.context, {
      docType,
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: { [namespace]: { family_name: 'Jones' } },
      issuerCertificate,
      validityInfo: { validUntil: notAfter },
      statusInfo: { index: 1, uri: statusListUri },
    })
    mdoc.deviceKeyId = holderKey.keyId
    return mdoc
  }

  const verifyMdoc = (testAgent: Agent, mdoc: Mdoc, trusted: X509Certificate[]) =>
    mdoc.verify(testAgent.context, {
      trustedCertificates: [{ issuance: trusted.map((certificate) => certificate.toString('base64')) }],
    })

  const verifyDeviceResponse = async (mdoc: Mdoc, trusted: X509Certificate[]) => {
    const { encoded } = await MdocDeviceResponse.createDeviceResponseWithDcqlQuery(agent.context, {
      mdocs: [mdoc],
      dcqlQuery,
      sessionTranscriptOptions,
    })

    return MdocDeviceResponse.fromBase64Url(encoded).verify(agent.context, {
      trustedCertificates: [{ issuance: trusted.map((certificate) => certificate.toString('base64')) }],
      sessionTranscriptOptions,
    })
  }

  test('Mdoc.verify serves a verified status list from the cache', async () => {
    const certificate = await createCertificate(agent)
    const { uri, token } = await createStatusList(agent, 'mdoc-cached', certificate)
    const mdoc = await signMdoc(agent, certificate, uri)

    // Only one response is mocked, so a second fetch would fail the verification
    const scope = mockStatusList(uri, token)
    for (let i = 0; i < 2; i++) {
      expect(await verifyMdoc(agent, mdoc, [certificate])).toEqual({ isValid: true })
    }
    expect(scope.isDone()).toBe(true)
    expect(await getCached(agent, uri)).toEqual(cacheValue(token))
  })

  test('MdocDeviceResponse.verify serves a verified status list from the cache', async () => {
    const certificate = await createCertificate(agent)
    const { uri, token } = await createStatusList(agent, 'device-response-cached', certificate)
    const mdoc = await signMdoc(agent, certificate, uri)

    const scope = mockStatusList(uri, token)
    for (let i = 0; i < 2; i++) {
      await expect(verifyDeviceResponse(mdoc, [certificate])).resolves.toMatchObject({
        documents: [{ documentIndex: 0 }],
      })
    }
    expect(scope.isDone()).toBe(true)
    expect(await getCached(agent, uri)).toEqual(cacheValue(token))
  })

  test('Mdoc.verify does not cache a status list in which the mdoc is revoked', async () => {
    const certificate = await createCertificate(agent)
    const { uri, token } = await createStatusList(agent, 'mdoc-revoked', certificate, { revoked: true })
    const mdoc = await signMdoc(agent, certificate, uri)

    mockStatusList(uri, token)
    expect(await verifyMdoc(agent, mdoc, [certificate])).toEqual({
      isValid: false,
      error: "Status for id '1' is not Valid (0), but is instead '1'",
    })
    expect(await getCached(agent, uri)).toBeNull()
  })

  test('MdocDeviceResponse.verify does not cache a status list in which the mdoc is revoked', async () => {
    const certificate = await createCertificate(agent)
    const { uri, token } = await createStatusList(agent, 'device-response-revoked', certificate, { revoked: true })
    const mdoc = await signMdoc(agent, certificate, uri)

    mockStatusList(uri, token)
    await expect(verifyDeviceResponse(mdoc, [certificate])).rejects.toMatchObject({
      cause: { message: "Status for id '1' is not Valid (0), but is instead '1'" },
    })
    expect(await getCached(agent, uri)).toBeNull()
  })

  test('Mdoc.verify does not cache a status list signed by an untrusted certificate', async () => {
    const certificate = await createCertificate(agent)
    const untrustedCertificate = await createCertificate(agent)
    const { uri, token } = await createStatusList(agent, 'mdoc-untrusted', untrustedCertificate)
    const mdoc = await signMdoc(agent, certificate, uri)

    mockStatusList(uri, token)
    expect(await verifyMdoc(agent, mdoc, [certificate])).toEqual({
      isValid: false,
      error: 'No trusted certificate was found while validating the X.509 chain',
    })
    expect(await getCached(agent, uri)).toBeNull()
  })

  test("Mdoc.verify does not cache a status list that the library verified but Credo's checks reject", async () => {
    const certificate = await createCertificate(agent)
    const otherCertificate = await createCertificate(agent)
    const { uri, token } = await createStatusList(agent, 'mdoc-other-chain', otherCertificate)
    const mdoc = await signMdoc(agent, certificate, uri)

    mockStatusList(uri, token)
    expect(await verifyMdoc(agent, mdoc, [certificate, otherCertificate])).toEqual({
      isValid: false,
      error:
        'Trusted status list chain does not match the trusted issuance chain, and no trusted status certificates were provided for the trusted issuance certificate',
    })
    expect(await getCached(agent, uri)).toBeNull()
  })

  test('Mdoc.verify verifies a cached status list again', async () => {
    const certificate = await createCertificate(agent)
    const untrustedCertificate = await createCertificate(agent)
    const { uri, token } = await createStatusList(agent, 'mdoc-cached-untrusted', certificate)
    const { token: untrustedToken } = await createStatusList(agent, 'mdoc-cached-untrusted', untrustedCertificate)
    const mdoc = await signMdoc(agent, certificate, uri)

    // The valid status list is served, but the untrusted one in the cache is used
    const scope = mockStatusList(uri, token)
    const cache = agent.context.resolve(CacheModuleConfig).cache
    await cache.set(agent.context, cacheKey(uri), cacheValue(untrustedToken), 60, { scope: 'global' })

    expect(await verifyMdoc(agent, mdoc, [certificate])).toEqual({
      isValid: false,
      error: 'No trusted certificate was found while validating the X.509 chain',
    })
    expect(scope.isDone()).toBe(false)
  })

  test('Mdoc.verify fetches the status list for every verification with statusListCacheExpirySeconds 0', async () => {
    const certificate = await createCertificate(noCacheAgent)
    const { uri, token } = await createStatusList(noCacheAgent, 'mdoc-no-cache', certificate)
    const mdoc = await signMdoc(noCacheAgent, certificate, uri)

    const scope = mockStatusList(uri, token, 2)
    for (let i = 0; i < 2; i++) {
      expect(await verifyMdoc(noCacheAgent, mdoc, [certificate])).toEqual({ isValid: true })
    }
    expect(scope.isDone()).toBe(true)
    expect(await getCached(noCacheAgent, uri)).toBeNull()
  })
})
