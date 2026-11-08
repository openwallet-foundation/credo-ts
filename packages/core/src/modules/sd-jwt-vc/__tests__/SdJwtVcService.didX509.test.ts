import type { DidResolutionResult, DidResolver, TrustedIssuer } from '@credo-ts/core'
import {
  Agent,
  DidDocument,
  DidKey,
  DidsModule,
  JsonEncoder,
  JsonTransformer,
  KeyDidRegistrar,
  KeyDidResolver,
  TypedArrayEncoder,
  X509Certificate,
  X509ModuleConfig,
  X509Service,
} from '@credo-ts/core'
import { loadX509Chain, resolveDid } from '@didx509/core'
import { createHash } from 'crypto'
import { getAgentOptions } from '../../../../tests'
import { PublicJwk } from '../../kms'
import { SdJwtVcService } from '../SdJwtVcService'

/**
 * did:x509 resolver for the tests, backed by the reference implementation `@didx509/core` (the same engine that
 * `@didx509/credo` wraps). Credo core does not ship a did:x509 resolver.
 *
 * Like the real resolver it requires the `x509chain` resolution option, and validates the chain, the CA
 * fingerprint and the predicates of the did against the leaf certificate. It does not decide whether the CA is trusted.
 */
class TestDidX509Resolver implements DidResolver {
  public readonly supportedMethods = ['x509']
  public readonly allowsCaching = false
  public readonly allowsLocalDidRecord = false
  public readonly calls: Array<{ did: string; options: Record<string, unknown> }> = []

  public async resolve(
    _agentContext: unknown,
    did: string,
    _parsed: unknown,
    options: Record<string, unknown>
  ): Promise<DidResolutionResult> {
    this.calls.push({ did, options })
    const x509chain = options.x509chain
    if (typeof x509chain !== 'string' || !x509chain) {
      return {
        didResolutionMetadata: {
          error: 'invalidDidResolutionOptions',
          message: 'x509chain resolution option is required',
        },
        didDocument: null,
        didDocumentMetadata: {},
      }
    }

    try {
      const json = await resolveDid(did, loadX509Chain(x509chain))
      // Credo only maps `JsonWebKey2020`, the spec uses `JsonWebKey`
      for (const method of json.verificationMethod) if (method.type === 'JsonWebKey') method.type = 'JsonWebKey2020'
      return {
        didResolutionMetadata: {},
        didDocument: JsonTransformer.fromJSON(json, DidDocument),
        didDocumentMetadata: {},
      }
    } catch (error) {
      return {
        didResolutionMetadata: { error: 'notFound', message: error instanceof Error ? error.message : String(error) },
        didDocument: null,
        didDocumentMetadata: {},
      }
    }
  }
}

const resolver = new TestDidX509Resolver()

// Set per test to exercise the trusted entities callback
let trustedEntities: TrustedIssuer[] | undefined

const agent = new Agent(
  getAgentOptions(
    'sdjwtvcdidx509agent',
    {},
    {
      getTrustedIssuersForVerification: async () => (trustedEntities ? { trustedIssuers: trustedEntities } : undefined),
    },
    {
      dids: new DidsModule({
        resolvers: [new KeyDidResolver(), resolver],
        registrars: [new KeyDidRegistrar()],
      }),
    }
  )
)

const service = () => agent.dependencyManager.resolve(SdJwtVcService)
const trusted = (...roots: X509Certificate[]): TrustedIssuer[] => [
  { method: 'x509', issuance: roots.map((root) => root.toString('base64')) },
]

const lastYear = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

const fingerprint = (certificate: X509Certificate) =>
  TypedArrayEncoder.toBase64Url(createHash('sha256').update(certificate.rawCertificate).digest())

async function createKey() {
  return PublicJwk.fromPublicJwk((await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk)
}

async function createRoot(commonName: string) {
  const key = await createKey()
  const certificate = await X509Service.createCertificate(agent.context, {
    authorityKey: key,
    issuer: { commonName },
    validity: { notBefore: lastYear, notAfter: nextYear },
    extensions: { basicConstraints: { ca: true } },
  })
  return { key, certificate }
}

async function createLeaf(
  root: Awaited<ReturnType<typeof createRoot>>,
  organizationName: string,
  { notAfter = nextYear }: { notAfter?: Date } = {}
) {
  const key = await createKey()
  const certificate = await X509Service.createCertificate(agent.context, {
    authorityKey: root.key,
    subjectPublicKey: key,
    issuer: root.certificate.subject,
    subject: { commonName: 'Issuer', organizationName },
    validity: { notBefore: lastYear, notAfter },
  })
  return { key, certificate, chain: [certificate, root.certificate] }
}

const didX509 = (root: X509Certificate, organization: string) =>
  `did:x509:0:sha256:${fingerprint(root)}::subject:O:${organization}`

/**
 * Builds a compact SD-JWT VC without disclosures, so the header and payload can be set to anything an attacker
 * could put in there. The signature is created with the provided key.
 */
async function craftSdJwtVc({
  header,
  payload,
  key,
}: {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  key: PublicJwk
}) {
  const encodedHeader = JsonEncoder.toBase64Url({ alg: 'ES256', typ: 'dc+sd-jwt', ...header })
  const encodedPayload = JsonEncoder.toBase64Url({
    vct: 'urn:example:vct',
    iat: Math.floor(Date.now() / 1000),
    ...payload,
  })
  const { signature } = await agent.kms.sign({
    keyId: key.keyId,
    data: TypedArrayEncoder.fromUtf8String(`${encodedHeader}.${encodedPayload}`),
    algorithm: 'ES256',
  })
  return `${encodedHeader}.${encodedPayload}.${TypedArrayEncoder.toBase64Url(signature)}~`
}

const x5cOf = (chain: X509Certificate[]) => chain.map((certificate) => certificate.toString('base64'))

/**
 * Importing a did:x509 as a created did, so the issuer can sign with the key behind it.
 */
async function importDidX509(did: string, leaf: Awaited<ReturnType<typeof createLeaf>>) {
  const json = await resolveDid(
    did,
    loadX509Chain(leaf.chain.map((c) => TypedArrayEncoder.toBase64Url(c.rawCertificate)).join(','))
  )
  for (const method of json.verificationMethod) if (method.type === 'JsonWebKey') method.type = 'JsonWebKey2020'
  await agent.dids.import({
    did,
    didDocument: JsonTransformer.fromJSON(json, DidDocument),
    keys: [{ didDocumentRelativeKeyId: '#0', kmsKeyId: leaf.key.keyId as string }],
  })
}

async function importDidKey() {
  const key = await createKey()
  const didKey = new DidKey(key)
  const didUrl = (didKey.didDocument.verificationMethod ?? [])[0].id
  await agent.dids.import({
    did: didKey.did,
    didDocument: didKey.didDocument,
    keys: [{ didDocumentRelativeKeyId: `#${didUrl.split('#')[1]}`, kmsKeyId: key.keyId as string }],
  })
  return didUrl
}

async function verify(compactSdJwtVc: string, trustedIssuers?: TrustedIssuer[]) {
  return await service().verify(agent.context, { compactSdJwtVc, trustedIssuers })
}

function expectInvalid(result: Awaited<ReturnType<typeof verify>>, message?: string | RegExp) {
  expect(result.isValid).toBe(false)
  if (!result.isValid && message) expect(result.error.message).toMatch(message)
}

/**
 * Approach B (X.509-first, what plain x5c verification does): validate the chain against the trusted certificates,
 * verify the signature with the leaf key and ignore `iss` completely.
 */
async function verifyAsPlainX509(compactSdJwtVc: string, trustedRoots: X509Certificate[]) {
  const [encodedHeader, encodedPayload, signature] = compactSdJwtVc.split('~')[0].split('.')
  const header = JsonEncoder.fromBase64Url(encodedHeader)
  await X509Service.validateCertificateChain(agent.context, {
    certificateChain: header.x5c,
    trustedCertificates: trustedRoots.map((root) => root.toString('base64')),
  })
  const leaf = X509Certificate.fromEncodedCertificate(header.x5c[0])
  const { verified } = await agent.kms.verify({
    key: { publicJwk: leaf.publicJwk.toJson() },
    data: TypedArrayEncoder.fromUtf8String(`${encodedHeader}.${encodedPayload}`),
    signature: TypedArrayEncoder.fromBase64Url(signature),
    algorithm: 'ES256',
  })
  if (!verified) throw new Error('Invalid signature')
  return JsonEncoder.fromBase64Url(encodedPayload)
}

describe('SdJwtVcService with did:x509 issuers', () => {
  let rootA: Awaited<ReturnType<typeof createRoot>>
  let rootB: Awaited<ReturnType<typeof createRoot>>
  let orgA: Awaited<ReturnType<typeof createLeaf>>
  let orgB: Awaited<ReturnType<typeof createLeaf>>
  let didA: string

  beforeAll(async () => {
    await agent.initialize()
    rootA = await createRoot('Trusted Root A')
    rootB = await createRoot('Other Root B')
    // Two organisations whose certificates are issued by the same trusted CA
    orgA = await createLeaf(rootA, 'OrgA')
    orgB = await createLeaf(rootA, 'OrgB')
    didA = didX509(rootA.certificate, 'OrgA')
    await importDidX509(didA, orgA)
  })

  beforeEach(() => {
    trustedEntities = undefined
    resolver.calls.length = 0
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  describe('signing', () => {
    it('puts the did, the relative kid and the x5c chain in the credential', async () => {
      const sdJwtVc = await service().sign(agent.context, {
        payload: { vct: 'urn:example:vct', name: 'Alice' },
        issuer: { method: 'did', didUrl: `${didA}#0`, x5c: orgA.chain },
      })

      const [header, payload] = sdJwtVc.compact
        .split('~')[0]
        .split('.')
        .slice(0, 2)
        .map((part) => JsonEncoder.fromBase64Url(part))
      expect(header).toMatchObject({ alg: 'ES256', kid: '#0', x5c: x5cOf(orgA.chain) })
      expect(payload.iss).toBe(didA)
    })

    it('rejects a did:x509 issuer without a certificate chain', async () => {
      await expect(
        service().sign(agent.context, {
          payload: { vct: 'urn:example:vct' },
          issuer: { method: 'did', didUrl: `${didA}#0` },
        })
      ).rejects.toThrow(/requires a certificate chain/)
    })

    it('rejects a chain whose leaf key is not the key of the did url', async () => {
      await expect(
        service().sign(agent.context, {
          payload: { vct: 'urn:example:vct' },
          issuer: { method: 'did', didUrl: `${didA}#0`, x5c: orgB.chain },
        })
      ).rejects.toThrow(/does not match the key of the did url/)
    })

    it('rejects an x5c chain for a did that is not a did:x509', async () => {
      const didUrl = await importDidKey()
      await expect(
        service().sign(agent.context, {
          payload: { vct: 'urn:example:vct' },
          issuer: { method: 'did', didUrl, x5c: orgA.chain },
        })
      ).rejects.toThrow(/only supported for did:x509/)
    })
  })

  describe('approach A: bound to the did, x5c is the resolution evidence', () => {
    const sign = async () =>
      (
        await service().sign(agent.context, {
          payload: { vct: 'urn:example:vct', name: 'Alice' },
          issuer: { method: 'did', didUrl: `${didA}#0`, x5c: orgA.chain },
        })
      ).compact

    it('verifies when the root of the chain is trusted, resolving the did with the chain', async () => {
      const result = await verify(await sign(), trusted(rootA.certificate))

      expect(result.isValid).toBe(true)
      if (result.isValid) {
        expect(result.sdJwtVc.issuer).toMatchObject({ method: 'did', didUrl: `${didA}#0` })
        expect(result.sdJwtVc.prettyClaims.name).toBe('Alice')
      }
      // The did is resolved with the chain as x509chain (base64url DER, comma separated), without caching
      expect(resolver.calls.at(-1)).toMatchObject({
        did: didA,
        options: {
          x509chain: orgA.chain.map((c) => TypedArrayEncoder.toBase64Url(c.rawCertificate)).join(','),
          useCache: false,
          useLocalCreatedDidRecord: false,
        },
      })
    })

    it('verifies with the trusted entities callback, and the x509 module trusted certificates', async () => {
      const compact = await sign()

      trustedEntities = trusted(rootA.certificate)
      expect((await verify(compact)).isValid).toBe(true)

      trustedEntities = trusted(rootB.certificate)
      expectInvalid(await verify(compact), /No trusted certificate was found/)

      trustedEntities = undefined
      const x509Config = agent.dependencyManager.resolve(X509ModuleConfig)
      x509Config.setTrustedCertificates([rootA.certificate])
      try {
        expect((await verify(compact)).isValid).toBe(true)
      } finally {
        x509Config.setTrustedCertificates(undefined)
      }
    })

    it('does not accept the credential when no certificates are trusted (strict by default)', async () => {
      expectInvalid(await verify(await sign()), /No trusted certificates configured/)
    })

    it('does not accept an explicit list of trusted dids for a did:x509, the chain must be trusted', async () => {
      expectInvalid(await verify(await sign(), [{ method: 'did', issuance: didA }]), /No trusted certificate was found/)
    })

    it('rejects a chain that anchors in another trusted root only', async () => {
      expectInvalid(await verify(await sign(), trusted(rootB.certificate)), /No trusted certificate was found/)
    })

    it('rejects a leaf of the same trusted CA claiming the did:x509 of another organisation', async () => {
      // OrgB has a valid certificate from the trusted CA, and signs a credential with iss = the did of OrgA
      const compact = await craftSdJwtVc({
        header: { kid: '#0', x5c: x5cOf(orgB.chain) },
        payload: { iss: didA },
        key: orgB.key,
      })

      expectInvalid(
        await verify(compact, trusted(rootA.certificate)),
        /invalid subject value: O = OrgA, expected: OrgB/
      )
    })

    it('accepts the same credential for the own did of the leaf', async () => {
      const didB = didX509(rootA.certificate, 'OrgB')
      const compact = await craftSdJwtVc({
        header: { kid: '#0', x5c: x5cOf(orgB.chain) },
        payload: { iss: didB },
        key: orgB.key,
      })

      expect((await verify(compact, trusted(rootA.certificate))).isValid).toBe(true)
    })

    it('rejects a did whose predicate does not match the leaf certificate', async () => {
      const did = `did:x509:0:sha256:${fingerprint(rootA.certificate)}::subject:CN:SomebodyElse`
      const compact = await craftSdJwtVc({
        header: { kid: '#0', x5c: x5cOf(orgA.chain) },
        payload: { iss: did },
        key: orgA.key,
      })

      expectInvalid(await verify(compact, trusted(rootA.certificate)), /invalid subject value: CN = SomebodyElse/)
    })

    it('rejects a did whose CA fingerprint does not match the root of the chain', async () => {
      const did = didX509(rootB.certificate, 'OrgA')
      const compact = await craftSdJwtVc({
        header: { kid: '#0', x5c: x5cOf(orgA.chain) },
        payload: { iss: did },
        key: orgA.key,
      })

      expectInvalid(await verify(compact, trusted(rootA.certificate, rootB.certificate)), /invalid CA fingerprint/)
    })

    it('rejects an expired certificate', async () => {
      const expired = await createLeaf(rootA, 'OrgA', { notAfter: new Date(Date.now() - 24 * 60 * 60 * 1000) })
      const compact = await craftSdJwtVc({
        header: { kid: '#0', x5c: x5cOf(expired.chain) },
        payload: { iss: didA },
        key: expired.key,
      })

      expectInvalid(await verify(compact, trusted(rootA.certificate)), /used after it is allowed/)
    })

    it('rejects a credential signed with another key than the key in the did document', async () => {
      // Valid chain and did of OrgA, but signed by a key that is not the key of the leaf certificate
      const attackerKey = await createKey()
      const compact = await craftSdJwtVc({
        header: { kid: '#0', x5c: x5cOf(orgA.chain) },
        payload: { iss: didA },
        key: attackerKey,
      })

      expectInvalid(await verify(compact, trusted(rootA.certificate)), /Invalid JWT Signature/)
    })

    it('rejects an x5c without kid, instead of falling back to plain x5c verification', async () => {
      const compact = await craftSdJwtVc({
        header: { x5c: x5cOf(orgA.chain) },
        payload: { iss: didA },
        key: orgA.key,
      })

      expectInvalid(await verify(compact, trusted(rootA.certificate)), /does not contain a kid/)
      expect(resolver.calls).toHaveLength(0)
    })

    it('rejects a kid that points at another did than iss', async () => {
      const compact = await craftSdJwtVc({
        header: { kid: `${didX509(rootA.certificate, 'OrgB')}#0`, x5c: x5cOf(orgA.chain) },
        payload: { iss: didA },
        key: orgA.key,
      })

      expectInvalid(await verify(compact, trusted(rootA.certificate)), /does not match with the 'iss' did/)
    })

    it('rejects a did:x509 credential without x5c, as the did cannot be resolved without the chain', async () => {
      const compact = await craftSdJwtVc({ header: { kid: '#0' }, payload: { iss: didA }, key: orgA.key })

      expectInvalid(await verify(compact, trusted(rootA.certificate)), /does not contain an 'x5c' header/)
      expect(resolver.calls).toHaveLength(0)
    })

    it('rejects a did:x509 credential with an empty x5c', async () => {
      const compact = await craftSdJwtVc({ header: { kid: '#0', x5c: [] }, payload: { iss: didA }, key: orgA.key })

      expectInvalid(await verify(compact, trusted(rootA.certificate)), /Empty array/)
    })

    it('does not serve the did document from a local did record, which would skip validation of the chain', async () => {
      // `didA` is also a created did in this agent. Validation of the chain must still happen, so a leaf of
      // another organisation can't piggy back on that record.
      const compact = await craftSdJwtVc({
        header: { kid: '#0', x5c: x5cOf(orgB.chain) },
        payload: { iss: didA },
        key: orgB.key,
      })

      expectInvalid(
        await verify(compact, trusted(rootA.certificate)),
        /invalid subject value: O = OrgA, expected: OrgB/
      )
      expect(resolver.calls.length).toBeGreaterThan(0)
    })
  })

  describe('approach B: verified as plain X.509, iss is ignored', () => {
    it('accepts a leaf of a trusted CA that claims the did:x509 of another organisation', async () => {
      const compact = await craftSdJwtVc({
        header: { kid: '#0', x5c: x5cOf(orgB.chain) },
        payload: { iss: didA, name: 'Forged' },
        key: orgB.key,
      })

      // X.509-first: the chain is trusted and the signature is valid, so the credential is accepted. Nothing checks
      // that the leaf of OrgB is allowed to speak for `didA`.
      const payload = await verifyAsPlainX509(compact, [rootA.certificate])
      expect(payload).toMatchObject({ iss: didA, name: 'Forged' })

      // The did bound approach rejects the very same credential
      expectInvalid(
        await verify(compact, trusted(rootA.certificate)),
        /invalid subject value: O = OrgA, expected: OrgB/
      )
    })
  })

  describe('other issuers are unchanged', () => {
    it('signs and verifies a did:key issuer without any chain or did:x509 resolution', async () => {
      const didUrl = await importDidKey()

      const sdJwtVc = await service().sign(agent.context, {
        payload: { vct: 'urn:example:vct' },
        issuer: { method: 'did', didUrl },
      })
      expect(JsonEncoder.fromBase64Url(sdJwtVc.compact.split('.')[0]).x5c).toBeUndefined()

      const result = await verify(sdJwtVc.compact)
      expect(result.isValid).toBe(true)
      expect(resolver.calls).toHaveLength(0)
    })

    it('signs and verifies a plain x5c issuer, and does not look at iss', async () => {
      const root = await createRoot('Plain Root')
      const leaf = await createLeaf(root, 'Whatever')
      leaf.certificate.keyId = leaf.key.keyId

      const sdJwtVc = await service().sign(agent.context, {
        payload: { vct: 'urn:example:vct' },
        issuer: { method: 'x5c', x5c: leaf.chain, issuer: 'https://issuer.example.com' },
      })

      const result = await verify(sdJwtVc.compact, trusted(root.certificate))
      expect(result.isValid).toBe(true)
      if (result.isValid) expect(result.sdJwtVc.issuer.method).toBe('x5c')
      expect(resolver.calls).toHaveLength(0)
    })

    it('still handles a non did:x509 did in iss with an x5c header as a plain x5c issuer', async () => {
      const root = await createRoot('Plain Root 2')
      const leaf = await createLeaf(root, 'Whatever')
      const compact = await craftSdJwtVc({
        header: { x5c: x5cOf(leaf.chain) },
        payload: { iss: 'did:web:example.com' },
        key: leaf.key,
      })

      const result = await verify(compact, trusted(root.certificate))
      expect(result.isValid).toBe(true)
      if (result.isValid) expect(result.sdJwtVc.issuer.method).toBe('x5c')
    })
  })
})
