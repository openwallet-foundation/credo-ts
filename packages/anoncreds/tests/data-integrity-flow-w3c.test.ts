import type { KeyDidCreateOptions } from '@credo-ts/core'

import {
  AgentContext,
  CredentialExchangeRecord,
  CredentialPreviewAttribute,
  CredentialState,
  DidKey,
  DidResolverService,
  DidsApi,
  DidsModuleConfig,
  Ed25519Signature2018,
  InjectionSymbols,
  KeyDidRegistrar,
  KeyDidResolver,
  KeyType,
  SignatureSuiteToken,
  SigningProviderRegistry,
  TypedArrayEncoder,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
  W3cCredential,
  W3cCredentialService,
  W3cCredentialSubject,
  W3cCredentialsModuleConfig,
} from '@credo-ts/core'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../tests/InMemoryStorageService'
import { DataIntegrityCredentialFormatService } from '../../anoncreds/src/formats/DataIntegrityCredentialFormatService'
import { AnonCredsRegistryService } from '../../anoncreds/src/services/registry/AnonCredsRegistryService'
import { InMemoryAnonCredsRegistry } from '../../anoncreds/tests/InMemoryAnonCredsRegistry'
import { RegisteredAskarTestWallet } from '../../askar/tests/helpers'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../core/tests/helpers'
import {
  AnonCredsHolderServiceSymbol,
  AnonCredsIssuerServiceSymbol,
  AnonCredsModuleConfig,
  AnonCredsVerifierServiceSymbol,
} from '../src'
import { AnonCredsRsHolderService, AnonCredsRsIssuerService, AnonCredsRsVerifierService } from '../src/anoncreds-rs'

import { InMemoryTailsFileService } from './InMemoryTailsFileService'
import { anoncreds } from './helpers'

const registry = new InMemoryAnonCredsRegistry()
const tailsFileService = new InMemoryTailsFileService()
const anonCredsModuleConfig = new AnonCredsModuleConfig({
  anoncreds,
  registries: [registry],
  tailsFileService,
})

const agentConfig = getAgentConfig('AnonCreds format services using anoncreds-rs')
const anonCredsVerifierService = new AnonCredsRsVerifierService()
const anonCredsHolderService = new AnonCredsRsHolderService()
const anonCredsIssuerService = new AnonCredsRsIssuerService()

const inMemoryStorageService = new InMemoryStorageService()

const logger = agentConfig.logger

const didsModuleConfig = new DidsModuleConfig({
  registrars: [new KeyDidRegistrar()],
  resolvers: [new KeyDidResolver()],
})
const fileSystem = new agentDependencies.FileSystem()

const wallet = new RegisteredAskarTestWallet(
  agentConfig.logger,
  new agentDependencies.FileSystem(),
  new SigningProviderRegistry([])
)

const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.Stop$, new Subject<boolean>()],
    [InjectionSymbols.AgentDependencies, agentDependencies],
    [InjectionSymbols.FileSystem, fileSystem],
    [InjectionSymbols.StorageService, inMemoryStorageService],
    [AnonCredsIssuerServiceSymbol, anonCredsIssuerService],
    [AnonCredsHolderServiceSymbol, anonCredsHolderService],
    [AnonCredsVerifierServiceSymbol, anonCredsVerifierService],
    [InjectionSymbols.Logger, logger],
    [DidsModuleConfig, didsModuleConfig],
    [DidResolverService, new DidResolverService(logger, didsModuleConfig)],
    [AnonCredsRegistryService, new AnonCredsRegistryService()],
    [AnonCredsModuleConfig, anonCredsModuleConfig],
    [W3cCredentialsModuleConfig, new W3cCredentialsModuleConfig()],
    [
      SignatureSuiteToken,
      {
        suiteClass: Ed25519Signature2018,
        proofType: 'Ed25519Signature2018',
        verificationMethodTypes: [
          VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
          VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
        ],
        keyTypes: [KeyType.Ed25519],
      },
    ],
  ],
  agentConfig,
  wallet,
})

agentContext.dependencyManager.registerInstance(AgentContext, agentContext)

const dataIntegrityCredentialFormatService = new DataIntegrityCredentialFormatService()

const indyDid = 'did:indy:local:LjgpST2rjsoxYegQDRm7EL'

describe('data integrity format service (w3c)', () => {
  let issuer: Awaited<ReturnType<typeof createDidKidVerificationMethod>>
  let holder: Awaited<ReturnType<typeof createDidKidVerificationMethod>>

  beforeAll(async () => {
    await wallet.createAndOpen(agentConfig.walletConfig)

    issuer = await createDidKidVerificationMethod(agentContext, '96213c3d7fc8d4d6754c7a0fd969598g')
    holder = await createDidKidVerificationMethod(agentContext, '96213c3d7fc8d4d6754c7a0fd969598f')
  })

  afterEach(async () => {
    inMemoryStorageService.contextCorrelationIdToRecords = {}
  })

  test('issuance and verification flow w3c starting from offer without negotiation and without revocation', async () => {
    await anonCredsFlowTest({ issuerId: indyDid, revocable: false, issuer, holder })
  })
})

export async function createDidKidVerificationMethod(agentContext: AgentContext, secretKey: string) {
  const dids = agentContext.dependencyManager.resolve(DidsApi)
  const didCreateResult = await dids.create<KeyDidCreateOptions>({
    method: 'key',
    options: { keyType: KeyType.Ed25519 },
    secret: { privateKey: TypedArrayEncoder.fromString(secretKey) },
  })

  const did = didCreateResult.didState.did as string
  const didKey = DidKey.fromDid(did)
  const kid = `${did}#${didKey.key.fingerprint}`

  const verificationMethod = didCreateResult.didState.didDocument?.dereferenceKey(kid, ['authentication'])
  if (!verificationMethod) throw new Error('No verification method found')

  return {
    did,
    kid,
    verificationMethod,
  }
}

async function anonCredsFlowTest(options: {
  issuerId: string
  revocable: boolean
  issuer: Awaited<ReturnType<typeof createDidKidVerificationMethod>>
  holder: Awaited<ReturnType<typeof createDidKidVerificationMethod>>
}) {
  const { issuer, holder } = options

  const holderCredentialRecord = new CredentialExchangeRecord({
    protocolVersion: 'v1',
    state: CredentialState.ProposalSent,
    threadId: 'f365c1a5-2baf-4873-9432-fa87c888a0aa',
  })

  const issuerCredentialRecord = new CredentialExchangeRecord({
    protocolVersion: 'v1',
    state: CredentialState.ProposalReceived,
    threadId: 'f365c1a5-2baf-4873-9432-fa87c888a0aa',
  })

  const credentialAttributes = [
    new CredentialPreviewAttribute({ name: 'name', value: 'John' }),
    new CredentialPreviewAttribute({ name: 'age', value: '25' }),
  ]

  // Set attributes on the credential record, this is normally done by the protocol service
  holderCredentialRecord.credentialAttributes = credentialAttributes
  issuerCredentialRecord.credentialAttributes = credentialAttributes

  // --------------------------------------------------------------------------------------------------------

  const credential = new W3cCredential({
    context: [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/security/data-integrity/v2',
      {
        '@vocab': 'https://www.w3.org/ns/credentials/issuer-dependent#',
      },
    ],
    type: ['VerifiableCredential'],
    issuer: issuer.did,
    issuanceDate: new Date().toISOString(),
    credentialSubject: new W3cCredentialSubject({ claims: { name: 'John', age: 25 } }),
  })

  const { attachment: offerAttachment } = await dataIntegrityCredentialFormatService.createOffer(agentContext, {
    credentialRecord: issuerCredentialRecord,
    credentialFormats: {
      dataIntegrity: {
        bindingRequired: true,
        credential,
        didCommSignedAttachmentBindingMethodOptions: {},
      },
    },
  })

  // Holder processes and accepts offer
  await dataIntegrityCredentialFormatService.processOffer(agentContext, {
    credentialRecord: holderCredentialRecord,
    attachment: offerAttachment,
  })
  const { attachment: requestAttachment, appendAttachments: requestAppendAttachments } =
    await dataIntegrityCredentialFormatService.acceptOffer(agentContext, {
      credentialRecord: holderCredentialRecord,
      offerAttachment,
      credentialFormats: {
        dataIntegrity: {
          didCommSignedAttachmentAcceptOfferOptions: {
            kid: holder.kid,
          },
        },
      },
    })

  // Issuer processes and accepts request
  await dataIntegrityCredentialFormatService.processRequest(agentContext, {
    credentialRecord: issuerCredentialRecord,
    attachment: requestAttachment,
  })
  const { attachment: credentialAttachment } = await dataIntegrityCredentialFormatService.acceptRequest(agentContext, {
    credentialRecord: issuerCredentialRecord,
    requestAttachment,
    offerAttachment,
    requestAppendAttachments,
    credentialFormats: {
      dataIntegrity: {
        credentialSubjectId: issuer.did,
        didCommSignedAttachmentAcceptRequestOptions: {
          kid: issuer.kid,
        },
      },
    },
  })

  // Holder processes and accepts credential
  await dataIntegrityCredentialFormatService.processCredential(agentContext, {
    offerAttachment,
    credentialRecord: holderCredentialRecord,
    attachment: credentialAttachment,
    requestAttachment,
  })

  expect(holderCredentialRecord.credentials).toEqual([
    { credentialRecordType: 'w3c', credentialRecordId: expect.any(String) },
  ])

  await expect(
    anonCredsHolderService.getCredential(agentContext, {
      credentialId: holderCredentialRecord.id,
    })
  ).rejects.toThrow()

  const expectedCredentialMetadata = {}
  expect(holderCredentialRecord.metadata.data).toEqual({
    '_dataIntegrity/credential': expectedCredentialMetadata,
    '_dataIntegrity/credentialRequest': {},
  })

  expect(issuerCredentialRecord.metadata.data).toEqual({
    '_dataIntegrity/credential': expectedCredentialMetadata,
  })

  const credentialRecordId = holderCredentialRecord.credentials[0].credentialRecordId
  const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)
  const credentialRecord = await w3cCredentialService.getCredentialRecordById(agentContext, credentialRecordId)
  const credentialId = credentialRecord.getAnonCredsTags()?.credentialId
  expect(credentialId).toBeUndefined()

  expect(credentialRecord.credential).toEqual({
    ...{
      ...credential,
      credentialSubject: new W3cCredentialSubject({
        id: issuer.did,
        claims: (credential.credentialSubject as W3cCredentialSubject).claims,
      }),
    },
    proof: expect.any(Object),
  })
}
