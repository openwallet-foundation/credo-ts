import type { CheqdDidCreateOptions } from '@credo-ts/cheqd'
import type { DidCommAutoAcceptProof, DidCommConnectionRecord } from '@credo-ts/didcomm'
import type { EventReplaySubject } from '../../core/tests'
import type { DefaultAgentModulesInput } from '../../didcomm/src/util/modules'
import type {
  AnonCredsDidCommOfferCredentialFormat,
  AnonCredsRegisterCredentialDefinitionOptions,
  AnonCredsRegisterRevocationRegistryDefinitionOptions,
  AnonCredsRegisterRevocationStatusListOptions,
  AnonCredsRegistry,
  AnonCredsRequestedAttribute,
  AnonCredsRequestedPredicate,
  AnonCredsSchema,
  RegisterCredentialDefinitionReturnStateFinished,
  RegisterRevocationRegistryDefinitionReturnStateFinished,
  RegisterRevocationStatusListReturnStateFinished,
  RegisterSchemaReturnStateFinished,
} from '../src'

import { randomUUID } from 'crypto'
import {
  Agent,
  CacheModule,
  CredoError,
  DidDocumentBuilder,
  DidsModule,
  InMemoryLruCache,
  TypedArrayEncoder,
} from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  DidCommCredentialEventTypes,
  DidCommCredentialState,
  DidCommCredentialV2Protocol,
  DidCommCredentialsModule,
  DidCommDifPresentationExchangeProofFormatService,
  DidCommProofEventTypes,
  DidCommProofState,
  DidCommProofV2Protocol,
  DidCommProofsModule,
} from '@credo-ts/didcomm'

import { CheqdDidRegistrar, CheqdDidResolver, CheqdModule } from '../../cheqd/src/index'
import { getCheqdModuleConfig } from '../../cheqd/tests/setupCheqdModule'
import { sleep } from '../../core/src/utils/sleep'
import { setupEventReplaySubjects, setupSubjectTransports } from '../../core/tests'
import {
  getAgentOptions,
  makeConnection,
  waitForCredentialRecordSubject,
  waitForProofExchangeRecordSubject,
} from '../../core/tests/helpers'
import testLogger from '../../core/tests/logger'
import { AnonCredsCredentialFormatService, AnonCredsModule, AnonCredsProofFormatService } from '../src'
import { DataIntegrityDidCommCredentialFormatService } from '../src/formats/DataIntegrityDidCommCredentialFormatService'
import { InMemoryAnonCredsRegistry } from '../tests/InMemoryAnonCredsRegistry'

import { transformPrivateKeyToPrivateJwk } from '../../askar/src/utils'
import { InMemoryTailsFileService } from './InMemoryTailsFileService'
import { LocalDidResolver } from './LocalDidResolver'
import { anoncreds } from './helpers'
import { anoncredsDefinitionFourAttributesNoRevocation } from './preCreatedAnonCredsDefinition'

// Helper type to get the type of the agents (with the custom modules) for the credential tests
export type AnonCredsTestsAgent = Agent<ReturnType<typeof getAnonCredsModules> & DefaultAgentModulesInput>

export const getAnonCredsModules = ({
  autoAcceptCredentials,
  autoAcceptProofs,
  registries,
  cheqd,
}: {
  autoAcceptCredentials?: DidCommAutoAcceptCredential
  autoAcceptProofs?: DidCommAutoAcceptProof
  registries?: [AnonCredsRegistry, ...AnonCredsRegistry[]]
  cheqd?: {
    rpcUrl?: string
    seed?: string
  }
} = {}) => {
  const dataIntegrityCredentialFormatService = new DataIntegrityDidCommCredentialFormatService()
  // Add support for resolving pre-created credential definitions and schemas
  const inMemoryAnonCredsRegistry = new InMemoryAnonCredsRegistry({
    existingCredentialDefinitions: {
      [anoncredsDefinitionFourAttributesNoRevocation.credentialDefinitionId]:
        anoncredsDefinitionFourAttributesNoRevocation.credentialDefinition,
    },
    existingSchemas: {
      [anoncredsDefinitionFourAttributesNoRevocation.schemaId]: anoncredsDefinitionFourAttributesNoRevocation.schema,
    },
  })

  const anonCredsCredentialFormatService = new AnonCredsCredentialFormatService()
  const anonCredsProofFormatService = new AnonCredsProofFormatService()
  const presentationExchangeProofFormatService = new DidCommDifPresentationExchangeProofFormatService()

  const cheqdSdk = cheqd ? new CheqdModule(getCheqdModuleConfig(cheqd.seed, cheqd.rpcUrl)) : undefined
  const modules = {
    ...(cheqdSdk && { cheqdSdk }),
    credentials: new DidCommCredentialsModule({
      autoAcceptCredentials,
      credentialProtocols: [
        new DidCommCredentialV2Protocol({
          credentialFormats: [dataIntegrityCredentialFormatService, anonCredsCredentialFormatService],
        }),
      ],
    }),
    proofs: new DidCommProofsModule({
      autoAcceptProofs,
      proofProtocols: [
        new DidCommProofV2Protocol({
          proofFormats: [anonCredsProofFormatService, presentationExchangeProofFormatService],
        }),
      ],
    }),
    anoncreds: new AnonCredsModule({
      registries: registries ?? [inMemoryAnonCredsRegistry],
      tailsFileService: new InMemoryTailsFileService(),
      anoncreds,
    }),
    dids: new DidsModule({
      resolvers: cheqd ? [new CheqdDidResolver()] : [new LocalDidResolver()],
      registrars: cheqd ? [new CheqdDidRegistrar()] : undefined,
    }),
    cache: new CacheModule({
      cache: new InMemoryLruCache({ limit: 100 }),
    }),
  } as const

  return modules
}

export async function issueAnonCredsCredential({
  issuerAgent,
  issuerReplay,

  holderAgent,
  holderReplay,

  issuerHolderConnectionId,
  revocationRegistryDefinitionId,
  offer,
}: {
  issuerAgent: AnonCredsTestsAgent
  issuerReplay: EventReplaySubject

  holderAgent: AnonCredsTestsAgent
  holderReplay: EventReplaySubject

  issuerHolderConnectionId: string
  revocationRegistryDefinitionId: string | null
  offer: AnonCredsDidCommOfferCredentialFormat
}) {
  let issuerCredentialExchangeRecord = await issuerAgent.modules.credentials.offerCredential({
    comment: 'some comment about credential',
    connectionId: issuerHolderConnectionId,
    protocolVersion: 'v2',
    credentialFormats: {
      anoncreds: {
        ...offer,
        revocationRegistryDefinitionId: revocationRegistryDefinitionId ?? undefined,
        revocationRegistryIndex: 1,
      },
    },
    autoAcceptCredential: DidCommAutoAcceptCredential.ContentApproved,
  })

  let holderCredentialExchangeRecord = await waitForCredentialRecordSubject(holderReplay, {
    threadId: issuerCredentialExchangeRecord.threadId,
    state: DidCommCredentialState.OfferReceived,
  })

  await holderAgent.modules.credentials.acceptOffer({
    credentialExchangeRecordId: holderCredentialExchangeRecord.id,
    autoAcceptCredential: DidCommAutoAcceptCredential.ContentApproved,
  })

  // Because we use auto-accept it can take a while to have the whole credential flow finished
  // Both parties need to interact with the ledger and sign/verify the credential
  holderCredentialExchangeRecord = await waitForCredentialRecordSubject(holderReplay, {
    threadId: issuerCredentialExchangeRecord.threadId,
    state: DidCommCredentialState.Done,
  })
  issuerCredentialExchangeRecord = await waitForCredentialRecordSubject(issuerReplay, {
    threadId: issuerCredentialExchangeRecord.threadId,
    state: DidCommCredentialState.Done,
  })

  return {
    issuerCredentialExchangeRecord,
    holderCredentialExchangeRecord,
  }
}

interface SetupAnonCredsTestsReturn<VerifierName extends string | undefined, CreateConnections extends boolean> {
  issuerAgent: AnonCredsTestsAgent
  issuerReplay: EventReplaySubject

  issuerId: string

  holderAgent: AnonCredsTestsAgent
  holderReplay: EventReplaySubject

  issuerHolderConnectionId: CreateConnections extends true ? string : undefined
  holderIssuerConnectionId: CreateConnections extends true ? string : undefined

  verifierHolderConnectionId: CreateConnections extends true
    ? VerifierName extends string
      ? string
      : undefined
    : undefined
  holderVerifierConnectionId: CreateConnections extends true
    ? VerifierName extends string
      ? string
      : undefined
    : undefined

  verifierAgent: VerifierName extends string ? AnonCredsTestsAgent : undefined
  verifierReplay: VerifierName extends string ? EventReplaySubject : undefined

  schemaId: string
  credentialDefinitionId: string
  revocationRegistryDefinitionId: string | null
  revocationStatusListTimestamp?: number
}

export async function presentAnonCredsProof({
  verifierAgent,
  verifierReplay,

  holderAgent,
  holderReplay,

  verifierHolderConnectionId,

  request: { attributes, predicates },
}: {
  holderAgent: AnonCredsTestsAgent
  holderReplay: EventReplaySubject

  verifierAgent: AnonCredsTestsAgent
  verifierReplay: EventReplaySubject

  verifierHolderConnectionId: string
  request: {
    attributes?: Record<string, AnonCredsRequestedAttribute>
    predicates?: Record<string, AnonCredsRequestedPredicate>
  }
}) {
  let holderProofExchangeRecordPromise = waitForProofExchangeRecordSubject(holderReplay, {
    state: DidCommProofState.RequestReceived,
  })

  let verifierProofExchangeRecord = await verifierAgent.modules.proofs.requestProof({
    connectionId: verifierHolderConnectionId,
    proofFormats: {
      anoncreds: {
        name: 'Test Proof Request',
        requested_attributes: attributes,
        requested_predicates: predicates,
        version: '1.0',
      },
    },
    protocolVersion: 'v2',
  })

  let holderProofExchangeRecord = await holderProofExchangeRecordPromise

  const selectedCredentials = await holderAgent.modules.proofs.selectCredentialsForRequest({
    proofExchangeRecordId: holderProofExchangeRecord.id,
  })

  const verifierProofExchangeRecordPromise = waitForProofExchangeRecordSubject(verifierReplay, {
    threadId: holderProofExchangeRecord.threadId,
    state: DidCommProofState.PresentationReceived,
  })

  await holderAgent.modules.proofs.acceptRequest({
    proofExchangeRecordId: holderProofExchangeRecord.id,
    proofFormats: { anoncreds: selectedCredentials.proofFormats.anoncreds },
  })

  verifierProofExchangeRecord = await verifierProofExchangeRecordPromise

  // assert presentation is valid
  expect(verifierProofExchangeRecord.isVerified).toBe(true)

  holderProofExchangeRecordPromise = waitForProofExchangeRecordSubject(holderReplay, {
    threadId: holderProofExchangeRecord.threadId,
    state: DidCommProofState.Done,
  })

  verifierProofExchangeRecord = await verifierAgent.modules.proofs.acceptPresentation({
    proofExchangeRecordId: verifierProofExchangeRecord.id,
  })
  holderProofExchangeRecord = await holderProofExchangeRecordPromise

  return {
    verifierProofExchangeRecord,
    holderProofExchangeRecord,
  }
}

export async function setupAnonCredsTests<
  VerifierName extends string | undefined = undefined,
  CreateConnections extends boolean = true,
>({
  issuerId,
  issuerName,
  holderName,
  verifierName,
  autoAcceptCredentials,
  autoAcceptProofs,
  attributeNames,
  createConnections,
  supportRevocation,
  registries,
  cheqd,
}: {
  issuerId?: string
  cheqd?: {
    rpcUrl?: string
    seed?: string
  }
  issuerName: string
  holderName: string
  verifierName?: VerifierName
  autoAcceptCredentials?: DidCommAutoAcceptCredential
  autoAcceptProofs?: DidCommAutoAcceptProof
  attributeNames: string[]
  createConnections?: CreateConnections
  supportRevocation?: boolean
  registries?: [AnonCredsRegistry, ...AnonCredsRegistry[]]
}): Promise<SetupAnonCredsTestsReturn<VerifierName, CreateConnections>> {
  const issuerAgent = new Agent(
    getAgentOptions(
      issuerName,
      {
        endpoints: ['rxjs:issuer'],
      },
      {},
      getAnonCredsModules({
        autoAcceptCredentials,
        autoAcceptProofs,
        registries,
        cheqd,
      }),
      { requireDidcomm: true }
    )
  )

  const holderAgent = new Agent(
    getAgentOptions(
      holderName,
      {
        endpoints: ['rxjs:holder'],
      },
      {},
      getAnonCredsModules({
        autoAcceptCredentials,
        autoAcceptProofs,
        registries,
        cheqd,
      }),
      { requireDidcomm: true }
    )
  )

  const verifierAgent = verifierName
    ? new Agent(
        getAgentOptions(
          verifierName,
          {
            endpoints: ['rxjs:verifier'],
          },
          {},
          getAnonCredsModules({
            autoAcceptCredentials,
            autoAcceptProofs,
            registries,
            cheqd,
          })
        )
      )
    : undefined

  setupSubjectTransports(verifierAgent ? [issuerAgent, holderAgent, verifierAgent] : [issuerAgent, holderAgent])
  const [issuerReplay, holderReplay, verifierReplay] = setupEventReplaySubjects(
    verifierAgent ? [issuerAgent, holderAgent, verifierAgent] : [issuerAgent, holderAgent],
    [DidCommCredentialEventTypes.DidCommCredentialStateChanged, DidCommProofEventTypes.ProofStateChanged]
  )

  await issuerAgent.initialize()
  await holderAgent.initialize()
  if (verifierAgent) await verifierAgent.initialize()

  // Create default link secret for holder
  await holderAgent.modules.anoncreds.createLinkSecret({
    linkSecretId: 'default',
    setAsDefault: true,
  })

  if (issuerId) {
    const didDocument = new DidDocumentBuilder(issuerId).build()
    await issuerAgent.dids.import({ did: issuerId, didDocument })
  } else if (cheqd) {
    const privateKey = TypedArrayEncoder.fromString('000000000000000000000000001cheqd')
    const { privateJwk } = transformPrivateKeyToPrivateJwk({
      type: {
        kty: 'OKP',
        crv: 'Ed25519',
      },
      privateKey,
    })
    const didDocumentKey = await issuerAgent.kms.importKey({
      privateJwk,
    })

    const did = await issuerAgent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      options: {
        network: 'testnet',
        methodSpecificIdAlgo: 'uuid',
        keyId: didDocumentKey.keyId,
      },
    })
    issuerId = did.didState.did as string
  } else {
    throw new CredoError('issuerId is required if cheqd is not used')
  }

  const { credentialDefinition, revocationRegistryDefinition, revocationStatusList, schema } =
    await prepareForAnonCredsIssuance(issuerAgent, {
      issuerId,
      attributeNames,
      supportRevocation,
    })

  let issuerHolderConnection: DidCommConnectionRecord | undefined
  let holderIssuerConnection: DidCommConnectionRecord | undefined
  let verifierHolderConnection: DidCommConnectionRecord | undefined
  let holderVerifierConnection: DidCommConnectionRecord | undefined

  if (createConnections ?? true) {
    ;[issuerHolderConnection, holderIssuerConnection] = await makeConnection(issuerAgent, holderAgent)

    if (verifierAgent) {
      ;[holderVerifierConnection, verifierHolderConnection] = await makeConnection(holderAgent, verifierAgent)
    }
  }

  return {
    issuerAgent,
    issuerReplay,

    holderAgent,
    holderReplay,

    issuerId,

    verifierAgent: verifierName ? verifierAgent : undefined,
    verifierReplay: verifierName ? verifierReplay : undefined,

    revocationRegistryDefinitionId: revocationRegistryDefinition?.revocationRegistryDefinitionId,
    revocationStatusListTimestamp: revocationStatusList.revocationStatusList?.timestamp,
    credentialDefinitionId: credentialDefinition.credentialDefinitionId,
    schemaId: schema.schemaId,

    issuerHolderConnectionId: issuerHolderConnection?.id,
    holderIssuerConnectionId: holderIssuerConnection?.id,
    holderVerifierConnectionId: holderVerifierConnection?.id,
    verifierHolderConnectionId: verifierHolderConnection?.id,
  } as unknown as SetupAnonCredsTestsReturn<VerifierName, CreateConnections>
}

export async function prepareForAnonCredsIssuance(
  agent: Agent,
  {
    attributeNames,
    supportRevocation,
    issuerId,
  }: { attributeNames: string[]; supportRevocation?: boolean; issuerId: string }
) {
  const schema = await registerSchema(agent, {
    // TODO: update attrNames to attributeNames
    attrNames: attributeNames,
    name: `Schema ${randomUUID()}`,
    version: '1.0',
    issuerId,
  })

  // Wait some time pass to let ledger settle the object
  await sleep(1000)

  const credentialDefinition = await registerCredentialDefinition(
    agent,
    {
      schemaId: schema.schemaId,
      issuerId,
      tag: 'default',
    },
    supportRevocation
  )

  // Wait some time pass to let ledger settle the object
  await sleep(1000)

  let revocationRegistryDefinition: RegisterRevocationRegistryDefinitionReturnStateFinished | undefined
  let revocationStatusList: RegisterRevocationStatusListReturnStateFinished | undefined
  if (supportRevocation) {
    revocationRegistryDefinition = await registerRevocationRegistryDefinition(agent, {
      issuerId,
      tag: 'default',
      credentialDefinitionId: credentialDefinition.credentialDefinitionId,
      maximumCredentialNumber: 10,
    })

    // Wait some time pass to let ledger settle the object
    await sleep(1000)

    revocationStatusList = await registerRevocationStatusList(agent, {
      revocationRegistryDefinitionId: revocationRegistryDefinition?.revocationRegistryDefinitionId,
      issuerId,
    })

    // Wait some time pass to let ledger settle the object
    await sleep(1000)
  }

  return {
    schema: {
      ...schema,
      schemaId: schema.schemaId,
    },
    credentialDefinition: {
      ...credentialDefinition,
      credentialDefinitionId: credentialDefinition.credentialDefinitionId,
    },
    revocationRegistryDefinition: {
      ...revocationRegistryDefinition,
      revocationRegistryDefinitionId: revocationRegistryDefinition?.revocationRegistryDefinitionId,
    },
    revocationStatusList: {
      ...revocationStatusList,
    },
  }
}

async function registerSchema(
  agent: AnonCredsTestsAgent,
  schema: AnonCredsSchema
): Promise<RegisterSchemaReturnStateFinished> {
  const { schemaState } = await agent.modules.anoncreds.registerSchema({
    schema,
    options: {},
  })

  testLogger.test(`created schema with id ${schemaState.schemaId}`, schema)

  if (schemaState.state !== 'finished') {
    throw new CredoError(`Schema not created: ${schemaState.state === 'failed' ? schemaState.reason : 'Not finished'}`)
  }

  return schemaState
}

async function registerCredentialDefinition(
  agent: AnonCredsTestsAgent,
  credentialDefinition: AnonCredsRegisterCredentialDefinitionOptions,
  supportRevocation?: boolean
): Promise<RegisterCredentialDefinitionReturnStateFinished> {
  const { credentialDefinitionState } = await agent.modules.anoncreds.registerCredentialDefinition({
    credentialDefinition,
    options: {
      supportRevocation: supportRevocation ?? false,
    },
  })

  if (credentialDefinitionState.state !== 'finished') {
    throw new CredoError(
      `Credential definition not created: ${
        credentialDefinitionState.state === 'failed' ? credentialDefinitionState.reason : 'Not finished'
      }`
    )
  }

  return credentialDefinitionState
}

async function registerRevocationRegistryDefinition(
  agent: AnonCredsTestsAgent,
  revocationRegistryDefinition: AnonCredsRegisterRevocationRegistryDefinitionOptions
): Promise<RegisterRevocationRegistryDefinitionReturnStateFinished> {
  const { revocationRegistryDefinitionState } = await agent.modules.anoncreds.registerRevocationRegistryDefinition({
    revocationRegistryDefinition,
    options: {},
  })

  if (revocationRegistryDefinitionState.state !== 'finished') {
    throw new CredoError(
      `Revocation registry definition not created: ${
        revocationRegistryDefinitionState.state === 'failed' ? revocationRegistryDefinitionState.reason : 'Not finished'
      }`
    )
  }

  return revocationRegistryDefinitionState
}

async function registerRevocationStatusList(
  agent: AnonCredsTestsAgent,
  revocationStatusList: AnonCredsRegisterRevocationStatusListOptions
): Promise<RegisterRevocationStatusListReturnStateFinished> {
  const { revocationStatusListState } = await agent.modules.anoncreds.registerRevocationStatusList({
    revocationStatusList,
    options: {},
  })

  if (revocationStatusListState.state !== 'finished') {
    throw new CredoError(
      `Revocation status list not created: ${
        revocationStatusListState.state === 'failed' ? revocationStatusListState.reason : 'Not finished'
      }`
    )
  }

  return revocationStatusListState
}
