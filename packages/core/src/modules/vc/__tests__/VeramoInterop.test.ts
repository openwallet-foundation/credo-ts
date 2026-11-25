import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import type { AgentContext } from '../../../agent/context/AgentContext'
import { JsonEncoder, JsonTransformer } from '../../../utils'
import type { DidResolutionResult, DidResolver } from '../../dids'
import { DidDocument, DidsModule, JwkDidResolver, KeyDidResolver, PeerDidResolver, WebDidResolver } from '../../dids'
import {
  W3cJsonLdVerifiableCredential,
  W3cJsonLdVerifiablePresentation,
  W3cJwtVerifiableCredential,
  W3cJwtVerifiablePresentation,
} from '..'
import { VERAMO_INTEROP_VECTORS } from './veramoInteropVectors'

const { didDocuments, cases } = VERAMO_INTEROP_VECTORS as unknown as {
  didDocuments: Record<string, object>
  // biome-ignore lint/suspicious/noExplicitAny: vectors are plain JSON
  cases: Record<string, any>
}

// The issuers of the vectors that are not did:jwk are did:example, which only these vectors use
class VectorDidResolver implements DidResolver {
  public readonly supportedMethods = ['example']
  public readonly allowsCaching = false

  public async resolve(_agentContext: AgentContext, did: string): Promise<DidResolutionResult> {
    const document = didDocuments[did]
    if (!document) {
      return {
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: { error: 'notFound', message: `No vector for ${did}` },
      }
    }
    return {
      didDocument: JsonTransformer.fromJSON(document, DidDocument),
      didDocumentMetadata: {},
      didResolutionMetadata: {},
    }
  }
}

const agent = new Agent(
  getAgentOptions(
    'VeramoInterop',
    {},
    {},
    {
      dids: new DidsModule({
        resolvers: [
          new WebDidResolver(),
          new KeyDidResolver(),
          new PeerDidResolver(),
          new JwkDidResolver(),
          new VectorDidResolver(),
        ],
      }),
    }
  )
)

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

describe('Credentials and presentations created by Veramo, verified by Credo', () => {
  beforeAll(() => agent.initialize())
  afterAll(() => agent.shutdown())

  const verifyJwtVc = (veramoCredential: { proof: { jwt: string } }) =>
    agent.w3cCredentials.verifyCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(veramoCredential.proof.jwt),
    })

  describe('JWT credential', () => {
    it('verifies', async () => {
      const result = await verifyJwtVc(cases.jwtVc)
      expect(result.isValid, JSON.stringify(result.validations)).toBe(true)
    })

    it('does not verify once the payload is changed', async () => {
      const [header, payload, signature] = cases.jwtVc.proof.jwt.split('.')
      const changed = JsonEncoder.fromBase64Url(payload)
      changed.vc.credentialSubject.name = 'Mallory'
      const jwt = `${header}.${JsonEncoder.toBase64Url(changed)}.${signature}`
      expect((await verifyJwtVc({ proof: { jwt } })).isValid).toBe(false)
    })
  })

  describe('JWT presentation', () => {
    const { presentation, challenge, domain } = cases.jwtVp
    const verify = (options: { challenge: string; domain?: string }) =>
      agent.w3cCredentials.verifyPresentation({
        presentation: W3cJwtVerifiablePresentation.fromSerializedJwt(presentation.proof.jwt),
        ...options,
      })

    it('verifies with its challenge and domain', async () => {
      const result = await verify({ challenge, domain })
      expect(result.isValid, JSON.stringify(result.validations)).toBe(true)
    })

    it('does not verify with another challenge', async () => {
      expect((await verify({ challenge: 'other', domain })).isValid).toBe(false)
    })
  })

  describe.each([
    { name: 'Ed25519Signature2018', key: 'ldp2018Vc' },
    { name: 'Ed25519Signature2020', key: 'ldp2020Vc' },
  ])('JSON-LD credential with $name', ({ name, key }) => {
    const verify = (credential: unknown) =>
      agent.w3cCredentials.verifyCredential({
        credential: JsonTransformer.fromJSON(credential, W3cJsonLdVerifiableCredential),
      })

    it('verifies', async () => {
      expect(cases[key].proof.type).toBe(name)
      const result = await verify(cases[key])
      expect(result.isValid, result.isValid ? '' : String(result.error)).toBe(true)
    })

    it('does not verify once a claim is changed', async () => {
      const changed = clone(cases[key])
      changed.credentialSubject.name = 'Mallory'
      expect((await verify(changed)).isValid).toBe(false)
    })
  })

  describe('JSON-LD presentation with Ed25519Signature2018', () => {
    const { presentation, challenge, domain } = cases.ldp2018Vp
    const verify = (value: unknown, options: { challenge: string; domain?: string }) =>
      agent.w3cCredentials.verifyPresentation({
        presentation: JsonTransformer.fromJSON(value, W3cJsonLdVerifiablePresentation),
        ...options,
      })

    it('verifies with its challenge and domain', async () => {
      const result = await verify(presentation, { challenge, domain })
      expect(result.isValid, result.isValid ? '' : String(result.error)).toBe(true)
    })

    it('does not verify with another challenge', async () => {
      expect((await verify(presentation, { challenge: 'other', domain })).isValid).toBe(false)
    })

    it('does not verify once a claim of the embedded credential is changed', async () => {
      const changed = clone(presentation)
      changed.verifiableCredential[0].credentialSubject.name = 'Mallory'
      expect((await verify(changed, { challenge, domain })).isValid).toBe(false)
    })
  })
})
