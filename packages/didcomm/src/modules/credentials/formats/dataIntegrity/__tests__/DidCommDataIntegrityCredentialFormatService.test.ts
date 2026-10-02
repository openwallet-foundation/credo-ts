import {
  type AgentContext,
  ClaimFormat,
  DidDocument,
  DidsApi,
  Ed25519Signature2018,
  Ed25519Signature2020,
  getEcdsaSecp256k1VerificationKey2019,
  getEd25519VerificationKey2018,
  getEd25519VerificationKey2020,
  Kms,
  SignatureSuiteRegistry,
  VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
  type VerificationMethod,
  W3cCredentialService,
  W3cJsonLdVerifiableCredential,
  type W3cSignCredentialOptions,
} from '@credo-ts/core'
import { getAgentContext } from '../../../../../../../core/tests'
import { DidCommCredentialRole, DidCommCredentialState } from '../../../models'
import { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
import { getFormatDataAttachment } from '../../../util/formatData'
import { DidCommDataIntegrityCredentialFormatService } from '../DidCommDataIntegrityCredentialFormatService'

const issuer = 'did:example:issuer'
const verificationMethodId = `${issuer}#key-1`
const publicJwk = Kms.PublicJwk.fromFingerprint('z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th')
const ed25519PublicJwk = publicJwk.is(Kms.Ed25519PublicJwk) ? publicJwk : undefined
if (!ed25519PublicJwk) throw new Error('Expected Ed25519 test key')

const credential = {
  '@context': ['https://www.w3.org/2018/credentials/v1'],
  type: ['VerifiableCredential'],
  issuer,
  issuanceDate: '2024-01-01T00:00:00Z',
  credentialSubject: { id: 'did:example:holder' },
}

describe('DidCommDataIntegrityCredentialFormatService VC 1.1 suite selection', () => {
  const service = new DidCommDataIntegrityCredentialFormatService()
  let resolveDidDocument: ReturnType<typeof vi.fn>
  let signCredential: ReturnType<typeof vi.fn>
  let agentContext: AgentContext
  let credentialExchangeRecord: DidCommCredentialExchangeRecord
  const offerAttachment = getFormatDataAttachment({ credential, data_model_versions_supported: ['1.1'] }, 'offer')
  const requestAttachment = getFormatDataAttachment({ data_model_version: '1.1' }, 'request')

  function setIssuerVerificationMethod(verificationMethod: VerificationMethod) {
    resolveDidDocument.mockResolvedValue(
      new DidDocument({
        id: issuer,
        verificationMethod: [verificationMethod],
        assertionMethod: [verificationMethodId],
      })
    )
  }

  beforeEach(() => {
    resolveDidDocument = vi.fn()
    signCredential = vi.fn(
      async (_agentContext: AgentContext, options: W3cSignCredentialOptions<ClaimFormat.LdpVc>) => {
        return new W3cJsonLdVerifiableCredential({
          context: credential['@context'],
          type: credential.type,
          issuer,
          issuanceDate: credential.issuanceDate,
          credentialSubject: credential.credentialSubject,
          proof: {
            type: options.proofType,
            verificationMethod: options.verificationMethod,
            proofPurpose: 'assertionMethod',
            created: credential.issuanceDate,
          },
        })
      }
    )
    const registry = new SignatureSuiteRegistry([
      {
        suiteClass: Ed25519Signature2018,
        proofType: 'Ed25519Signature2018',
        verificationMethodTypes: [VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018],
        supportedPublicJwkTypes: [Kms.Ed25519PublicJwk],
      },
      {
        suiteClass: Ed25519Signature2020,
        proofType: 'Ed25519Signature2020',
        verificationMethodTypes: [VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020],
        supportedPublicJwkTypes: [Kms.Ed25519PublicJwk],
      },
    ])
    agentContext = getAgentContext({
      registerInstances: [
        [DidsApi, { resolveDidDocument } as unknown as DidsApi],
        [W3cCredentialService, { signCredential } as unknown as W3cCredentialService],
        [SignatureSuiteRegistry, registry],
      ],
    })
    credentialExchangeRecord = new DidCommCredentialExchangeRecord({
      protocolVersion: 'v2',
      role: DidCommCredentialRole.Issuer,
      state: DidCommCredentialState.RequestReceived,
      threadId: 'a5c89015-d45e-49b1-a7d0-80606da35ea8',
    })
  })

  test('selects Ed25519Signature2018 for an Ed25519VerificationKey2018 issuer method', async () => {
    setIssuerVerificationMethod(
      getEd25519VerificationKey2018({ id: verificationMethodId, controller: issuer, publicJwk: ed25519PublicJwk })
    )

    const { attachment } = await service.acceptRequest(agentContext, {
      credentialExchangeRecord,
      offerAttachment,
      requestAttachment,
      credentialFormats: { dataIntegrity: {} },
    })

    expect(signCredential).toHaveBeenCalledWith(
      agentContext,
      expect.objectContaining({
        format: ClaimFormat.LdpVc,
        proofType: 'Ed25519Signature2018',
        verificationMethod: verificationMethodId,
      })
    )
    expect(attachment.getDataAsJson()).toMatchObject({
      credential: { proof: { type: 'Ed25519Signature2018', verificationMethod: verificationMethodId } },
    })
  })

  test('selects Ed25519Signature2020 for an Ed25519VerificationKey2020 issuer method', async () => {
    setIssuerVerificationMethod(
      getEd25519VerificationKey2020({ id: verificationMethodId, controller: issuer, publicJwk: ed25519PublicJwk })
    )

    const { attachment } = await service.acceptRequest(agentContext, {
      credentialExchangeRecord,
      offerAttachment,
      requestAttachment,
      credentialFormats: { dataIntegrity: {} },
    })

    expect(signCredential).toHaveBeenCalledWith(
      agentContext,
      expect.objectContaining({
        format: ClaimFormat.LdpVc,
        proofType: 'Ed25519Signature2020',
        verificationMethod: verificationMethodId,
      })
    )
    expect(attachment.getDataAsJson()).toMatchObject({
      credential: { proof: { type: 'Ed25519Signature2020', verificationMethod: verificationMethodId } },
    })
  })

  test('rejects a secp256k1 issuer method when only Ed25519 suites are registered', async () => {
    const secp256k1PublicJwk = Kms.PublicJwk.fromPublicJwk({
      kty: 'EC',
      crv: 'secp256k1',
      x: 'RwiZITTa2Dcmq-V1j-5tgPUshOLO31FbsnhVS-7lskc',
      y: '3o1-UCc3ABh757P58gDISSc4hOj9qyfSGl3SGGA7xdc',
    })
    setIssuerVerificationMethod(
      getEcdsaSecp256k1VerificationKey2019({
        id: verificationMethodId,
        controller: issuer,
        publicJwk: secp256k1PublicJwk,
      })
    )

    await expect(
      service.acceptRequest(agentContext, {
        credentialExchangeRecord,
        offerAttachment,
        requestAttachment,
        credentialFormats: { dataIntegrity: {} },
      })
    ).rejects.toThrow(
      `Could not find signature suite for verification method type ${VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019}`
    )
    expect(signCredential).not.toHaveBeenCalled()
  })
})
