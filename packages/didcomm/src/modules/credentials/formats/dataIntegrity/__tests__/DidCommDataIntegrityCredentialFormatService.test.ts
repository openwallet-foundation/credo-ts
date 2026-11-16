import {
  getCredentialHolderBindingDids,
  type JsonObject,
  JsonTransformer,
  W3cCredentialRecord,
  W3cCredentialRepository,
  W3cCredentialService,
} from '@credo-ts/core'
import { getAgentContext } from '../../../../../../../core/tests'
import { DidCommAttachment, DidCommAttachmentData } from '../../../../../decorators/attachment/DidCommAttachment'
import { DidCommCredentialPreviewAttribute } from '../../../models/DidCommCredentialPreviewAttribute'
import { DidCommCredentialRole } from '../../../models/DidCommCredentialRole'
import { DidCommCredentialState } from '../../../models/DidCommCredentialState'
import { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
import { addExchangeHolderBindingDids, takeExchangeHolderBindingDids } from '../../../util/holderBinding'
import { DidCommDataIntegrityCredentialFormatService } from '../DidCommDataIntegrityCredentialFormatService'
import type { DidCommDataIntegrityLinkSecretBindingProvider } from '../DidCommDataIntegrityLinkSecretBinding'

describe('Data Integrity link-secret binding injection', () => {
  const credentialExchangeRecord = new DidCommCredentialExchangeRecord({
    threadId: 'thread',
    role: DidCommCredentialRole.Issuer,
    state: DidCommCredentialState.OfferSent,
    protocolVersion: 'v2',
  })
  const credential = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential'],
    issuer: 'did:example:issuer',
    issuanceDate: '2026-01-01T00:00:00Z',
    credentialSubject: { name: 'Alice' },
  }

  function setup() {
    const provider = {
      createOfferBindingMethod: vi.fn().mockResolvedValue({
        credentialDefinitionId: 'credential-definition',
        nonce: '123',
        keyCorrectnessProof: {},
      }),
      createBindingProof: vi.fn(),
      issueBoundCredential: vi.fn(),
      storeBoundCredential: vi.fn(),
      isBoundCredentialRecord: vi.fn().mockReturnValue(true),
      deleteCredentialRecord: vi.fn(),
    } satisfies DidCommDataIntegrityLinkSecretBindingProvider
    const record = JsonTransformer.fromJSON({ id: 'credential' }, W3cCredentialRecord)
    const repository = {
      findById: vi.fn().mockResolvedValue(record),
      getById: vi.fn().mockResolvedValue(record),
      update: vi.fn(),
      delete: vi.fn(),
    }
    const w3cCredentialService = { verifyCredential: vi.fn().mockResolvedValue({ isValid: true }) }
    const context = getAgentContext({
      registerInstances: [
        [W3cCredentialRepository, repository],
        [W3cCredentialService, w3cCredentialService],
      ],
    })
    return { provider, record, repository, w3cCredentialService, context }
  }

  test('rejects link-secret binding explicitly when no provider is supplied', async () => {
    const { context } = setup()
    const service = new DidCommDataIntegrityCredentialFormatService()

    await expect(
      service.createOffer(context, {
        credentialExchangeRecord,
        credentialFormats: {
          dataIntegrity: {
            credential,
            bindingRequired: true,
            anonCredsLinkSecretBinding: { credentialDefinitionId: 'credential-definition' },
          },
        },
      })
    ).rejects.toThrow('Pass a linkSecretBinding provider')
  })

  test('uses the injected provider without registering a DI token', async () => {
    const { context, provider } = setup()
    const service = new DidCommDataIntegrityCredentialFormatService({ linkSecretBinding: provider })

    await service.createOffer(context, {
      credentialExchangeRecord,
      credentialFormats: {
        dataIntegrity: {
          credential,
          bindingRequired: true,
          anonCredsLinkSecretBinding: { credentialDefinitionId: 'credential-definition' },
        },
      },
    })

    expect(provider.createOfferBindingMethod).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ credentialExchangeRecord, offeredCredential: credential })
    )
  })

  test('uses the injected provider to clean up link-secret-bound credentials', async () => {
    const { context, provider, record, repository } = setup()
    const service = new DidCommDataIntegrityCredentialFormatService({ linkSecretBinding: provider })

    await service.deleteCredentialById(context, record.id)

    expect(provider.deleteCredentialRecord).toHaveBeenCalledWith(context, record)
    expect(repository.delete).not.toHaveBeenCalled()
  })

  describe('credential bound to both a link secret and a DID', () => {
    const proof = { proofPurpose: 'assertionMethod', verificationMethod: 'did:example:issuer#key-1', proofValue: 'z' }
    const anonCredsProof = { ...proof, type: 'DataIntegrityProof', cryptosuite: 'anoncreds-2023' }
    const issuerProof = { ...proof, type: 'Ed25519Signature2018', created: '2026-01-01T00:00:00Z' }

    async function processCredential({ context, provider, record }: ReturnType<typeof setup>, proof: JsonObject[]) {
      provider.storeBoundCredential.mockResolvedValue(record.id)
      const service = new DidCommDataIntegrityCredentialFormatService({ linkSecretBinding: provider })
      const holderExchangeRecord = new DidCommCredentialExchangeRecord({
        threadId: 'thread',
        role: DidCommCredentialRole.Holder,
        state: DidCommCredentialState.RequestSent,
        protocolVersion: 'v2',
        credentialAttributes: [new DidCommCredentialPreviewAttribute({ name: 'name', value: 'Alice' })],
      })
      addExchangeHolderBindingDids(holderExchangeRecord, service.formatKey, ['did:key:z6MkHolder'])
      const toAttachment = (json: JsonObject) => new DidCommAttachment({ data: new DidCommAttachmentData({ json }) })

      await service.processCredential(context, {
        credentialExchangeRecord: holderExchangeRecord,
        offerAttachment: toAttachment({ data_model_versions_supported: ['1.1'], credential }),
        requestAttachment: toAttachment({
          data_model_version: '1.1',
          binding_proof: { anoncreds_link_secret: {}, didcomm_signed_attachment: { attachment_id: 'binding' } },
        }),
        attachment: toAttachment({ credential: { ...credential, proof } }),
      })

      return { service, holderExchangeRecord }
    }

    test('verifies the issuer proof and stores the holder DIDs on the credential record', async () => {
      const mocks = setup()
      const { service, holderExchangeRecord } = await processCredential(mocks, [anonCredsProof, issuerProof])

      const [{ credential: verifiedCredential }] = mocks.w3cCredentialService.verifyCredential.mock.calls[0].slice(1)
      expect(verifiedCredential.proof).toEqual([expect.objectContaining(issuerProof)])
      expect(mocks.provider.storeBoundCredential).toHaveBeenCalled()
      expect(mocks.repository.update).toHaveBeenCalledWith(mocks.context, mocks.record)
      expect(getCredentialHolderBindingDids(mocks.record)).toEqual(['did:key:z6MkHolder'])
      expect(takeExchangeHolderBindingDids(holderExchangeRecord, service.formatKey)).toEqual([])
    })

    test('rejects an invalid issuer proof before storing', async () => {
      const mocks = setup()
      mocks.w3cCredentialService.verifyCredential.mockResolvedValue({ isValid: false, error: 'invalid signature' })

      await expect(processCredential(mocks, [anonCredsProof, issuerProof])).rejects.toThrow('invalid signature')
      expect(mocks.provider.storeBoundCredential).not.toHaveBeenCalled()
    })

    test('rejects a credential without an issuer proof', async () => {
      const mocks = setup()

      await expect(processCredential(mocks, [anonCredsProof])).rejects.toThrow('missing an issuer proof')
      expect(mocks.provider.storeBoundCredential).not.toHaveBeenCalled()
    })
  })

  test('retains plain W3C credential deletion without a provider', async () => {
    const { context, record, repository } = setup()
    const service = new DidCommDataIntegrityCredentialFormatService()

    await service.deleteCredentialById(context, record.id)

    expect(repository.delete).toHaveBeenCalledWith(context, record)
  })
})
