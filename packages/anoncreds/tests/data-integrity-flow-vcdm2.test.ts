import type { DidRepository } from '@credo-ts/core'
import {
  AgentContext,
  CacheModuleConfig,
  DidResolverService,
  DidsModuleConfig,
  InjectionSymbols,
  InMemoryLruCache,
  KeyDidRegistrar,
  KeyDidResolver,
  Kms,
  SignatureSuiteToken,
  W3cCredentialsModuleConfig,
  W3cV2CredentialRecord,
  W3cV2CredentialService,
} from '@credo-ts/core'
import type { DataIntegrityCredential, DataIntegrityCredentialRequest } from '@credo-ts/didcomm'
import {
  DidCommCredentialExchangeRecord,
  DidCommCredentialPreviewAttribute,
  DidCommCredentialRole,
  DidCommCredentialState,
} from '@credo-ts/didcomm'
import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../tests/InMemoryStorageService'
// Registered by the W3cDataIntegrityModule in a real agent, wired manually here
import { EddsaJcs2022Cryptosuite } from '../../core/src/modules/w3c-di/cryptosuites/eddsa-jcs-2022/EddsaJcs2022Cryptosuite'
import { W3cDataIntegrityCryptosuiteToken } from '../../core/src/modules/w3c-di/cryptosuites/types'
import {
  agentDependencies,
  createDidKidVerificationMethod,
  getAgentConfig,
  getAgentContext,
  testLogger,
} from '../../core/tests'
import { DataIntegrityDidCommCredentialFormatService } from '../src/formats/DataIntegrityDidCommCredentialFormatService'

const agentConfig = getAgentConfig('data integrity format service (vcdm 2.0)')
const inMemoryStorageService = new InMemoryStorageService()

const didsModuleConfig = new DidsModuleConfig({
  registrars: [new KeyDidRegistrar()],
  resolvers: [new KeyDidResolver()],
})

const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.Stop$, new Subject<boolean>()],
    [InjectionSymbols.AgentDependencies, agentDependencies],
    [InjectionSymbols.FileSystem, new agentDependencies.FileSystem()],
    [InjectionSymbols.StorageService, inMemoryStorageService],
    [InjectionSymbols.Logger, testLogger],
    [DidsModuleConfig, didsModuleConfig],
    [DidResolverService, new DidResolverService(testLogger, didsModuleConfig, {} as unknown as DidRepository)],
    [W3cCredentialsModuleConfig, new W3cCredentialsModuleConfig()],
    [SignatureSuiteToken, 'default'],
    [
      W3cDataIntegrityCryptosuiteToken,
      {
        cryptosuiteClass: EddsaJcs2022Cryptosuite,
        cryptosuite: 'eddsa-jcs-2022',
        supportedPublicJwkTypes: [Kms.Ed25519PublicJwk],
      },
    ],
    [CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 500 }) })],
  ],
  agentConfig,
})

agentContext.dependencyManager.registerInstance(AgentContext, agentContext)

const dataIntegrityCredentialFormatService = new DataIntegrityDidCommCredentialFormatService()

describe('data integrity format service (vcdm 2.0)', () => {
  afterEach(async () => {
    inMemoryStorageService.contextCorrelationIdToRecords = {}
  })

  test('issuance flow for a data model 2.0 credential secured with a DataIntegrityProof', async () => {
    const { did, verificationMethod } = await createDidKidVerificationMethod(agentContext)

    const credential = {
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      type: ['VerifiableCredential'],
      issuer: did,
      validFrom: '2024-01-01T00:00:00Z',
      credentialSubject: { name: 'John', age: '25' },
    }

    const credentialExchangeRecord = new DidCommCredentialExchangeRecord({
      protocolVersion: 'v2',
      role: DidCommCredentialRole.Issuer,
      state: DidCommCredentialState.ProposalReceived,
      threadId: 'f365c1a5-2baf-4873-9432-fa83790a9c30',
    })

    // Offer: the advertised data model version is derived from the offered credential
    const { attachment: offerAttachment, previewAttributes } = await dataIntegrityCredentialFormatService.createOffer(
      agentContext,
      {
        credentialExchangeRecord,
        credentialFormats: { dataIntegrity: { credential, bindingRequired: false } },
      }
    )

    expect(offerAttachment.getDataAsJson()).toMatchObject({ data_model_versions_supported: ['2.0'] })

    // Normally set by the credential protocol from the offer preview
    credentialExchangeRecord.credentialAttributes = previewAttributes?.map(
      (attribute) => new DidCommCredentialPreviewAttribute(attribute)
    )

    // Request: the holder echoes the negotiated version
    await dataIntegrityCredentialFormatService.processOffer(agentContext, {
      credentialExchangeRecord,
      attachment: offerAttachment,
    })

    const { attachment: requestAttachment } = await dataIntegrityCredentialFormatService.acceptOffer(agentContext, {
      credentialExchangeRecord,
      offerAttachment,
      credentialFormats: { dataIntegrity: {} },
    })

    expect(requestAttachment.getDataAsJson<DataIntegrityCredentialRequest>().data_model_version).toBe('2.0')

    // Issue: the issuer picks the cryptosuite, it is not negotiated
    const { attachment: credentialAttachment } = await dataIntegrityCredentialFormatService.acceptRequest(
      agentContext,
      {
        credentialExchangeRecord,
        offerAttachment,
        requestAttachment,
        credentialFormats: {
          dataIntegrity: { cryptosuite: 'eddsa-jcs-2022', issuerVerificationMethod: verificationMethod.id },
        },
      }
    )

    const { credential: issuedCredential } = credentialAttachment.getDataAsJson<DataIntegrityCredential>()
    expect(issuedCredential).toMatchObject({
      '@context': ['https://www.w3.org/ns/credentials/v2'],
      proof: { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022' },
    })

    // Store: a data model 2.0 credential lands in a W3cV2CredentialRecord
    await dataIntegrityCredentialFormatService.processCredential(agentContext, {
      credentialExchangeRecord,
      attachment: credentialAttachment,
      requestAttachment,
      offerAttachment,
    })

    expect(credentialExchangeRecord.credentials).toEqual([
      { credentialRecordType: 'w3c-v2', credentialRecordId: expect.any(String) },
    ])

    const w3cV2CredentialService = agentContext.dependencyManager.resolve(W3cV2CredentialService)
    const storedRecord = await w3cV2CredentialService.getCredentialRecordById(
      agentContext,
      credentialExchangeRecord.credentials[0].credentialRecordId
    )
    expect(storedRecord).toBeInstanceOf(W3cV2CredentialRecord)
  })

  test('rejects the anoncreds link secret binding method for a data model 2.0 credential', async () => {
    const { did } = await createDidKidVerificationMethod(agentContext)

    const credentialExchangeRecord = new DidCommCredentialExchangeRecord({
      protocolVersion: 'v2',
      role: DidCommCredentialRole.Issuer,
      state: DidCommCredentialState.ProposalReceived,
      threadId: '9f2a1d0e-3c4b-4a1f-8f2e-7b6c5d4e3f21',
    })

    await expect(
      dataIntegrityCredentialFormatService.createOffer(agentContext, {
        credentialExchangeRecord,
        credentialFormats: {
          dataIntegrity: {
            credential: {
              '@context': ['https://www.w3.org/ns/credentials/v2'],
              type: ['VerifiableCredential'],
              issuer: did,
              validFrom: '2024-01-01T00:00:00Z',
              credentialSubject: { name: 'John' },
            },
            bindingRequired: true,
            anonCredsLinkSecretBinding: {
              credentialDefinitionId: 'did:indy:local:LjgpST2rjsoxYegQDRm7EL/anoncreds/v0/CLAIM_DEF/1/tag',
            },
          },
        },
      })
    ).rejects.toThrow('The anoncreds link secret binding method is not supported for VC Data Model 2.0 credentials.')
  })
})
