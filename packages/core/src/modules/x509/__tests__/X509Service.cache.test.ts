import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../../node/src'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import { KeyManagementApi, KeyManagementModuleConfig, PublicJwk } from '../../kms'
import {
  convertMdocTrustedCertificates,
  mdocRawToTrustedCertificate,
  mdocTrustedCertificatesToRaw,
} from '../../mdoc/mdocUtil'
import { X509Certificate } from '../X509Certificate'
import { X509CertificateCache } from '../X509CertificateCache'
import { X509ModuleConfig } from '../X509ModuleConfig'
import { X509Service } from '../X509Service'
import { X509RevocationCheckMode } from '../X509ValidationOptions'

const agentContext = getAgentContext({ agentConfig: getAgentConfig('X509Service cache') })
const kmsApi = new KeyManagementApi(
  new KeyManagementModuleConfig({
    backends: [new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())],
  }),
  agentContext
)
agentContext.dependencyManager.registerInstance(KeyManagementApi, kmsApi)

const x509ModuleConfig = new X509ModuleConfig({ revocationCheck: { mode: X509RevocationCheckMode.Disabled } })
agentContext.dependencyManager.registerInstance(X509ModuleConfig, x509ModuleConfig)
agentContext.dependencyManager.registerSingleton(X509CertificateCache)

const day = 24 * 60 * 60 * 1000
const notBefore = new Date(Date.now() - 30 * day)
const notAfter = new Date(Date.now() + 30 * day)

async function createKey() {
  return PublicJwk.fromPublicJwk((await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk)
}

async function createRoot(commonName: string) {
  const key = await createKey()
  const certificate = await X509Service.createCertificate(agentContext, {
    authorityKey: key,
    issuer: { commonName },
    validity: { notBefore, notAfter },
    extensions: { basicConstraints: { ca: true } },
  })
  return { key, certificate }
}

async function createLeaf(root: Awaited<ReturnType<typeof createRoot>>, commonName = 'Leaf') {
  return await X509Service.createCertificate(agentContext, {
    authorityKey: root.key,
    subjectPublicKey: await createKey(),
    issuer: root.certificate.subject,
    subject: { commonName },
    validity: { notBefore, notAfter },
  })
}

describe('X509Service parsed certificate cache', () => {
  let root: Awaited<ReturnType<typeof createRoot>>
  let leaf: X509Certificate

  beforeAll(async () => {
    root = await createRoot('Root')
    leaf = await createLeaf(root)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    x509ModuleConfig.setParsedCertificateCacheLimit(250)
    x509ModuleConfig.setParseOptions(undefined)
  })

  it('gives every caller its own instance of a certificate that is parsed once', async () => {
    const leaf = await createLeaf(root, 'Parsed once')
    const encoded = leaf.toString('base64')
    const parse = vi.spyOn(X509Certificate, 'fromEncodedCertificate')
    const first = X509Service.parseCertificate(agentContext, { encodedCertificate: encoded })
    const second = X509Service.parseCertificate(agentContext, { encodedCertificate: leaf.rawCertificate })

    expect(parse).toHaveBeenCalledTimes(1)
    expect(second).not.toBe(first)
    expect(second.equal(first)).toBe(true)

    first.keyId = 'key-id'
    first.rawCertificate.fill(0)
    first.data.notAfter.setTime(0)

    expect(second.hasKeyId).toBe(false)
    expect(second.rawCertificate).toEqual(leaf.rawCertificate)
    expect(second.data.notAfter).toEqual(leaf.data.notAfter)
    expect(X509Service.parseCertificate(agentContext, { encodedCertificate: encoded }).hasKeyId).toBe(false)
  })

  it('uses trusted certificate instances as they are', async () => {
    const parse = vi.spyOn(X509Certificate, 'fromEncodedCertificate')
    const parseRaw = vi.spyOn(X509Certificate, 'fromRawCertificate')

    const chain = await X509Service.validateCertificateChain(agentContext, {
      certificateChain: [leaf],
      trustedCertificates: [root.certificate],
    })
    expect(chain[0]).toBe(root.certificate)

    // The mdoc library gets bytes, which are mapped back to the instance for chain validation
    const [{ issuance }] = mdocTrustedCertificatesToRaw(
      convertMdocTrustedCertificates(agentContext, [root.certificate])
    )
    expect(mdocRawToTrustedCertificate(issuance[0])).toBe(root.certificate)
    expect(mdocRawToTrustedCertificate(root.certificate.rawCertificate)).toBeInstanceOf(Uint8Array)

    expect(parse).not.toHaveBeenCalled()
    expect(parseRaw).not.toHaveBeenCalled()
  })

  it('does not keep a reference to the bytes it parsed', () => {
    const rawCertificate = (leaf.rawCertificate.buffer as ArrayBuffer).slice(0)
    const expected = new Uint8Array(rawCertificate.slice(0))

    X509Service.parseCertificate(agentContext, { encodedCertificate: new Uint8Array(rawCertificate) })
    new Uint8Array(rawCertificate).fill(0)

    expect(X509Service.parseCertificate(agentContext, { encodedCertificate: expected }).rawCertificate).toEqual(
      expected
    )
  })

  it('does not reuse a certificate for stricter parse options', () => {
    const encoded = leaf.toString('base64')

    expect(() => X509Service.parseCertificate(agentContext, { encodedCertificate: encoded })).not.toThrow()
    expect(() =>
      X509Service.parseCertificate(agentContext, { encodedCertificate: encoded, parseOptions: { maxDepth: 1 } })
    ).toThrow()
  })

  it('parses every certificate again when the limit is 0', () => {
    x509ModuleConfig.setParsedCertificateCacheLimit(0)
    const encoded = leaf.toString('base64')
    const parse = vi.spyOn(X509Certificate, 'fromEncodedCertificate')

    X509Service.parseCertificate(agentContext, { encodedCertificate: encoded })
    X509Service.parseCertificate(agentContext, { encodedCertificate: encoded })

    expect(parse).toHaveBeenCalledTimes(2)
  })

  it.each([-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN])('rejects %s as limit', (limit) => {
    expect(() => x509ModuleConfig.setParsedCertificateCacheLimit(limit)).toThrow(
      'parsedCertificateCacheLimit must be 0 or a positive integer'
    )
    expect(() => new X509ModuleConfig({ parsedCertificateCacheLimit: limit })).toThrow(
      'parsedCertificateCacheLimit must be 0 or a positive integer'
    )
  })

  it('reuses a certificate parsed with the parse options of the module', async () => {
    x509ModuleConfig.setParseOptions({ maxDepth: 50, maxNodes: 10_000, maxContentLength: 100_000 })
    const encoded = (await createLeaf(root, 'Module options')).toString('base64')
    const parse = vi.spyOn(X509Certificate, 'fromEncodedCertificate')

    X509Service.parseCertificate(agentContext, { encodedCertificate: encoded })
    X509Service.parseCertificate(agentContext, { encodedCertificate: encoded })

    expect(parse).toHaveBeenCalledTimes(1)
  })

  it('reuses a certificate for the same parse options in another order', async () => {
    const encoded = (await createLeaf(root, 'Option order')).toString('base64')
    const parse = vi.spyOn(X509Certificate, 'fromEncodedCertificate')

    X509Service.parseCertificate(agentContext, {
      encodedCertificate: encoded,
      parseOptions: { maxDepth: 50, maxNodes: 10_000 },
    })
    X509Service.parseCertificate(agentContext, {
      encodedCertificate: encoded,
      parseOptions: { maxNodes: 10_000, maxDepth: 50 },
    })

    expect(parse).toHaveBeenCalledTimes(1)
  })

  it('does not reuse a certificate after the parse options of the module became stricter', () => {
    const encoded = leaf.toString('base64')
    expect(() => X509Service.parseCertificate(agentContext, { encodedCertificate: encoded })).not.toThrow()

    x509ModuleConfig.setParseOptions({ maxDepth: 1 })

    expect(() => X509Service.parseCertificate(agentContext, { encodedCertificate: encoded })).toThrow()
  })

  it('is not shared with another agent', async () => {
    const otherAgentContext = getAgentContext({ agentConfig: getAgentConfig('X509Service cache other agent') })
    otherAgentContext.dependencyManager.registerInstance(X509ModuleConfig, new X509ModuleConfig())
    otherAgentContext.dependencyManager.registerSingleton(X509CertificateCache)
    const encoded = (await createLeaf(root, 'Other agent')).toString('base64')
    const parse = vi.spyOn(X509Certificate, 'fromEncodedCertificate')

    X509Service.parseCertificate(agentContext, { encodedCertificate: encoded })
    X509Service.parseCertificate(otherAgentContext, { encodedCertificate: encoded })
    X509Service.parseCertificate(otherAgentContext, { encodedCertificate: encoded })

    expect(parse).toHaveBeenCalledTimes(2)
  })
})
