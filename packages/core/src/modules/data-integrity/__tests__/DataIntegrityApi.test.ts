import type { AgentContext } from '../../../agent/context'
import { CredoError } from '../../../error'
import { MultiBaseEncoder } from '../../../utils/MultiBaseEncoder'
import { TypedArrayEncoder } from '../../../utils/TypedArrayEncoder'
import { DataIntegrityApi } from '../DataIntegrityApi'
import type { DataIntegrityCryptosuiteRegistry } from '../DataIntegrityCryptosuiteRegistry'
import type { DataIntegrityProofService } from '../DataIntegrityProofService'

const validProofValue = MultiBaseEncoder.encode(TypedArrayEncoder.fromUtf8String('proof-value'), 'base58btc')

describe('DataIntegrityApi', () => {
  const agentContext = {} as AgentContext

  test('delegates createProof to DataIntegrityProofService', async () => {
    const proofService = {
      createProof: vi.fn().mockResolvedValue({
        created: true,
        proof: {
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue,
        },
        warnings: [],
        errors: [],
      }),
    } as unknown as DataIntegrityProofService

    const cryptosuiteRegistry = {
      supportedCryptosuites: ['eddsa-jcs-2022'],
    } as unknown as DataIntegrityCryptosuiteRegistry

    const api = new DataIntegrityApi(agentContext, proofService, cryptosuiteRegistry)

    await api.createProof({
      unsecuredDocument: { id: 'urn:example:test' },
      verificationMethod: 'did:example:123#key-1',
      proofPurpose: 'assertionMethod',
      cryptosuite: 'eddsa-jcs-2022',
    })

    expect(proofService.createProof).toHaveBeenCalledWith(agentContext, {
      unsecuredDocument: { id: 'urn:example:test' },
      verificationMethod: 'did:example:123#key-1',
      proofPurpose: 'assertionMethod',
      cryptosuite: 'eddsa-jcs-2022',
    })
  })

  test('delegates verify methods and exposes supported cryptosuites', async () => {
    const proofService = {
      verifyProof: vi.fn().mockResolvedValue({ verified: true, verifiedDocument: {}, mediaType: null }),
      verifyProofSetAndChain: vi.fn().mockResolvedValue({ verified: true, verifiedDocument: {}, mediaType: null }),
      verifyProofDocument: vi.fn().mockResolvedValue({
        verified: true,
        verifiedDocument: {},
        mediaType: 'application/json',
      }),
    } as unknown as DataIntegrityProofService

    const cryptosuiteRegistry = {
      supportedCryptosuites: ['eddsa-jcs-2022'],
    } as unknown as DataIntegrityCryptosuiteRegistry

    const api = new DataIntegrityApi(agentContext, proofService, cryptosuiteRegistry)

    await api.verifyProof({
      id: 'urn:example:test',
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      },
    })

    await api.verifyProofSetAndChain({
      id: 'urn:example:test',
      proof: [
        {
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue,
        },
      ],
    })

    await api.verifyProofDocument({
      mediaType: 'application/json',
      documentBytes: new Uint8Array([123, 125]),
    })

    await api.verifySecuredDocument({
      id: 'urn:example:test',
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      },
    })

    await api.verifySecuredDocument({
      id: 'urn:example:test',
      proof: [
        {
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue,
        },
      ],
    })

    expect(proofService.verifyProof).toHaveBeenCalled()
    expect(proofService.verifyProofSetAndChain).toHaveBeenCalled()
    expect(proofService.verifyProofDocument).toHaveBeenCalled()
    expect(api.getSupportedCryptosuites()).toEqual(['eddsa-jcs-2022'])
  })

  test('createProofOrThrow returns success and throws on failure', async () => {
    const proofService = {
      createProof: vi
        .fn()
        .mockResolvedValueOnce({
          created: true,
          proof: {
            type: 'DataIntegrityProof',
            cryptosuite: 'eddsa-jcs-2022',
            verificationMethod: 'did:example:123#key-1',
            proofPurpose: 'assertionMethod',
            proofValue: validProofValue,
          },
        })
        .mockResolvedValueOnce({
          created: false,
          proof: null,
          errors: [
            {
              type: 'https://w3id.org/security#PROOF_GENERATION_ERROR',
              title: 'Proof generation failed',
            },
          ],
        }),
    } as unknown as DataIntegrityProofService

    const cryptosuiteRegistry = {
      supportedCryptosuites: ['eddsa-jcs-2022'],
    } as unknown as DataIntegrityCryptosuiteRegistry

    const api = new DataIntegrityApi(agentContext, proofService, cryptosuiteRegistry)

    const success = await api.createProofOrThrow({
      unsecuredDocument: { id: 'urn:example:test' },
      verificationMethod: 'did:example:123#key-1',
      proofPurpose: 'assertionMethod',
      cryptosuite: 'eddsa-jcs-2022',
    })

    expect(success.created).toBe(true)
    await expect(
      api.createProofOrThrow({
        unsecuredDocument: { id: 'urn:example:test' },
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        cryptosuite: 'eddsa-jcs-2022',
      })
    ).rejects.toThrow(CredoError)
  })

  test('verifySecuredDocumentOrThrow returns success and throws on failure', async () => {
    const proofService = {
      verifyProof: vi
        .fn()
        .mockResolvedValueOnce({
          verified: true,
          verifiedDocument: { id: 'urn:example:test' },
          mediaType: null,
        })
        .mockResolvedValueOnce({
          verified: false,
          verifiedDocument: null,
          mediaType: null,
          errors: [
            {
              type: 'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
              title: 'Proof verification failed',
            },
          ],
        }),
    } as unknown as DataIntegrityProofService

    const cryptosuiteRegistry = {
      supportedCryptosuites: ['eddsa-jcs-2022'],
    } as unknown as DataIntegrityCryptosuiteRegistry

    const api = new DataIntegrityApi(agentContext, proofService, cryptosuiteRegistry)

    const success = await api.verifySecuredDocumentOrThrow({
      id: 'urn:example:test',
      proof: {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:example:123#key-1',
        proofPurpose: 'assertionMethod',
        proofValue: validProofValue,
      },
    })

    expect(success.verified).toBe(true)
    await expect(
      api.verifySecuredDocumentOrThrow({
        id: 'urn:example:test',
        proof: {
          type: 'DataIntegrityProof',
          cryptosuite: 'eddsa-jcs-2022',
          verificationMethod: 'did:example:123#key-1',
          proofPurpose: 'assertionMethod',
          proofValue: validProofValue,
        },
      })
    ).rejects.toThrow(CredoError)
  })
})
