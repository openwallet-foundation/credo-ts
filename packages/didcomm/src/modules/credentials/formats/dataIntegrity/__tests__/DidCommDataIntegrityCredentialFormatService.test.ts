import { JsonTransformer, W3cCredentialRecord, W3cCredentialRepository } from '@credo-ts/core'
import { getAgentContext } from '../../../../../../../core/tests'
import { DidCommCredentialRole } from '../../../models/DidCommCredentialRole'
import { DidCommCredentialState } from '../../../models/DidCommCredentialState'
import { DidCommCredentialExchangeRecord } from '../../../repository/DidCommCredentialExchangeRecord'
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
      delete: vi.fn(),
    }
    const context = getAgentContext({
      registerInstances: [[W3cCredentialRepository, repository]],
    })
    return { provider, record, repository, context }
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

  test('retains plain W3C credential deletion without a provider', async () => {
    const { context, record, repository } = setup()
    const service = new DidCommDataIntegrityCredentialFormatService()

    await service.deleteCredentialById(context, record.id)

    expect(repository.delete).toHaveBeenCalledWith(context, record)
  })
})
