import type { DidCommAutoAcceptProof, DidCommConnectionRecord } from '@credo-ts/didcomm'
import type { DefaultAgentModulesInput } from '../..//didcomm/src/util/modules'
import type { EventReplaySubject } from '../../core/tests'
import type {
  AnonCredsDidCommOfferCredentialFormat,
  AnonCredsRegisterCredentialDefinitionOptions,
  AnonCredsRequestedAttribute,
  AnonCredsRequestedPredicate,
  AnonCredsSchema,
  RegisterCredentialDefinitionReturnStateFinished,
  RegisterSchemaReturnStateFinished,
} from '../src'
import type { PreCreatedAnonCredsDefinition } from './preCreatedAnonCredsDefinition'

import { randomUUID } from 'crypto'
import { Agent, CacheModule, CredoError, DidsModule, InMemoryLruCache, TypedArrayEncoder } from '@credo-ts/core'
import {
  DidCommAutoAcceptCredential,
  DidCommCredentialEventTypes,
  DidCommCredentialState,
  DidCommCredentialV2Protocol,
  DidCommCredentialsModule,
  DidCommEventTypes,
  DidCommProofEventTypes,
  DidCommProofState,
  DidCommProofV2Protocol,
  DidCommProofsModule,
} from '@credo-ts/didcomm'

import { sleep } from '../../core/src/utils/sleep'
import { setupEventReplaySubjects, setupSubjectTransports } from '../../core/tests'
import {
  getAgentOptions,
  importExistingIndyDidFromPrivateKey,
  makeConnection,
  publicDidSeed,
  waitForCredentialRecordSubject,
  waitForProofExchangeRecordSubject,
} from '../../core/tests/helpers'
import testLogger from '../../core/tests/logger'
import {
  IndyVdrAnonCredsRegistry,
  IndyVdrIndyDidRegistrar,
  IndyVdrIndyDidResolver,
  IndyVdrModule,
  IndyVdrSovDidResolver,
} from '../../indy-vdr/src'
import { indyVdrModuleConfig } from '../../indy-vdr/tests/helpers'
import {
  AnonCredsCredentialFormatService,
  AnonCredsModule,
  AnonCredsDidCommProofFormatService,
  DidCommCredentialV1Protocol,
  DidCommProofV1Protocol,
  LegacyIndyCredentialFormatService,
  LegacyIndyDidCommProofFormatService,
  getUnqualifiedCredentialDefinitionId,
  getUnqualifiedSchemaId,
  parseIndyCredentialDefinitionId,
  parseIndySchemaId,
} from '../src'

import { DrizzleStorageModule } from '../../drizzle-storage/src'
import {
  createDrizzlePostgresTestDatabase,
  inMemoryDrizzleSqliteDatabase,
  pushDrizzleSchema,
} from '../../drizzle-storage/tests/testDatabase'
import { InMemoryAnonCredsRegistry } from './InMemoryAnonCredsRegistry'
import { anoncreds } from './helpers'
import {
  anoncredsDefinitionFourAttributesNoRevocation,
  storePreCreatedAnonCredsDefinition,
} from './preCreatedAnonCredsDefinition'

// Helper type to get the type of the agents (with the custom modules) for the credential tests
export type AnonCredsTestsAgent = Agent<ReturnType<typeof getAnonCredsIndyModules> & DefaultAgentModulesInput>

export const getAnonCredsIndyModules = ({
  autoAcceptCredentials,
  autoAcceptProofs,
}: {
  autoAcceptCredentials?: DidCommAutoAcceptCredential
  autoAcceptProofs?: DidCommAutoAcceptProof
} = {}) => {
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

  const legacyIndyCredentialFormatService = new LegacyIndyCredentialFormatService()
  const legacyIndyProofFormatService = new LegacyIndyDidCommProofFormatService()

  const modules = {
    credentials: new DidCommCredentialsModule({
      autoAcceptCredentials,
      credentialProtocols: [
        new DidCommCredentialV1Protocol({
          indyCredentialFormat: legacyIndyCredentialFormatService,
        }),
        new DidCommCredentialV2Protocol({
          credentialFormats: [legacyIndyCredentialFormatService, new AnonCredsCredentialFormatService()],
        }),
      ],
    }),
    proofs: new DidCommProofsModule({
      autoAcceptProofs,
      proofProtocols: [
        new DidCommProofV1Protocol({
          indyProofFormat: legacyIndyProofFormatService,
        }),
        new DidCommProofV2Protocol({
          proofFormats: [legacyIndyProofFormatService, new AnonCredsDidCommProofFormatService()],
        }),
      ],
    }),
    anoncreds: new AnonCredsModule({
      registries: [new IndyVdrAnonCredsRegistry(), inMemoryAnonCredsRegistry],
      anoncreds,
    }),
    indyVdr: new IndyVdrModule(indyVdrModuleConfig),
    dids: new DidsModule({
      resolvers: [new IndyVdrSovDidResolver(), new IndyVdrIndyDidResolver()],
      registrars: [new IndyVdrIndyDidRegistrar()],
    }),
    cache: new CacheModule({
      cache: new InMemoryLruCache({ limit: 100 }),
    }),
  } as const

  return modules
}

export async function presentLegacyAnonCredsProof({
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
      indy: {
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
    proofFormats: { indy: selectedCredentials.proofFormats.indy },
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

export async function issueLegacyAnonCredsCredential({
  issuerAgent,
  issuerReplay,

  holderAgent,
  holderReplay,

  issuerHolderConnectionId,
  offer,
}: {
  issuerAgent: AnonCredsTestsAgent
  issuerReplay: EventReplaySubject

  holderAgent: AnonCredsTestsAgent
  holderReplay: EventReplaySubject

  issuerHolderConnectionId: string
  offer: AnonCredsDidCommOfferCredentialFormat
}) {
  let issuerCredentialExchangeRecord = await issuerAgent.modules.credentials.offerCredential({
    comment: 'some comment about credential',
    connectionId: issuerHolderConnectionId,
    protocolVersion: 'v1',
    credentialFormats: {
      indy: offer,
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

  teardown: () => Promise<void>
}

export async function setupAnonCredsTests<
  VerifierName extends string | undefined = undefined,
  CreateConnections extends boolean = true,
>({
  issuerName,
  holderName,
  verifierName,
  autoAcceptCredentials,
  autoAcceptProofs,
  attributeNames,
  preCreatedDefinition,
  createConnections,
  useDrizzleStorage,
}: {
  issuerName: string
  holderName: string
  verifierName?: VerifierName
  autoAcceptCredentials?: DidCommAutoAcceptCredential
  autoAcceptProofs?: DidCommAutoAcceptProof
  attributeNames?: string[]
  preCreatedDefinition?: PreCreatedAnonCredsDefinition
  createConnections?: CreateConnections
  useDrizzleStorage?: 'postgres' | 'sqlite'
}): Promise<SetupAnonCredsTestsReturn<VerifierName, CreateConnections>> {
  const issuerPostgresDrizzle = useDrizzleStorage === 'postgres' ? await createDrizzlePostgresTestDatabase() : undefined
  const issuerDrizzle =
    useDrizzleStorage === 'postgres'
      ? issuerPostgresDrizzle?.drizzle
      : useDrizzleStorage === 'sqlite'
        ? inMemoryDrizzleSqliteDatabase()
        : undefined

  const issuerAgent = new Agent(
    getAgentOptions(
      issuerName,
      {
        endpoints: ['rxjs:issuer'],
      },
      {
        logger: testLogger,
      },
      getAnonCredsIndyModules({
        autoAcceptCredentials,
        autoAcceptProofs,
      }),
      { requireDidcomm: true, drizzle: issuerDrizzle }
    )
  )

  const holderPostgresDrizzle = useDrizzleStorage === 'postgres' ? await createDrizzlePostgresTestDatabase() : undefined
  const holderDrizzle =
    useDrizzleStorage === 'postgres'
      ? holderPostgresDrizzle?.drizzle
      : useDrizzleStorage === 'sqlite'
        ? inMemoryDrizzleSqliteDatabase()
        : undefined
  const holderAgent = new Agent(
    getAgentOptions(
      holderName,
      {
        endpoints: ['rxjs:holder'],
      },
      {},
      getAnonCredsIndyModules({
        autoAcceptCredentials,
        autoAcceptProofs,
      }),
      { requireDidcomm: true, drizzle: holderDrizzle }
    )
  )

  const verifierPostgresDrizzle =
    useDrizzleStorage === 'postgres' ? await createDrizzlePostgresTestDatabase() : undefined
  const verifierDrizzle =
    useDrizzleStorage === 'postgres'
      ? verifierPostgresDrizzle?.drizzle
      : useDrizzleStorage === 'sqlite'
        ? inMemoryDrizzleSqliteDatabase()
        : undefined
  const verifierAgent = verifierName
    ? new Agent(
        getAgentOptions(
          verifierName,
          {
            endpoints: ['rxjs:verifier'],
          },
          {},
          getAnonCredsIndyModules({
            autoAcceptCredentials,
            autoAcceptProofs,
          }),
          { requireDidcomm: true, drizzle: verifierDrizzle }
        )
      )
    : undefined

  setupSubjectTransports(verifierAgent ? [issuerAgent, holderAgent, verifierAgent] : [issuerAgent, holderAgent])
  const [issuerReplay, holderReplay, verifierReplay] = setupEventReplaySubjects(
    verifierAgent ? [issuerAgent, holderAgent, verifierAgent] : [issuerAgent, holderAgent],
    [
      DidCommCredentialEventTypes.DidCommCredentialStateChanged,
      DidCommProofEventTypes.ProofStateChanged,
      DidCommEventTypes.DidCommMessageProcessed,
    ]
  )

  if (issuerAgent.dependencyManager.registeredModules.drizzle) {
    await pushDrizzleSchema(issuerAgent.dependencyManager.registeredModules.drizzle as DrizzleStorageModule)
  }
  if (holderAgent.dependencyManager.registeredModules.drizzle) {
    await pushDrizzleSchema(holderAgent.dependencyManager.registeredModules.drizzle as DrizzleStorageModule)
  }
  if (verifierAgent?.dependencyManager.registeredModules.drizzle) {
    await pushDrizzleSchema(verifierAgent.dependencyManager.registeredModules.drizzle as DrizzleStorageModule)
  }

  await issuerAgent.initialize()
  await holderAgent.initialize()
  if (verifierAgent) await verifierAgent.initialize()

  let credentialDefinitionId: string
  let schemaId: string

  if (attributeNames) {
    const result = await prepareForAnonCredsIssuance(issuerAgent, {
      attributeNames,
    })
    schemaId = result.schema.schemaId
    credentialDefinitionId = result.credentialDefinition.credentialDefinitionId
  } else if (preCreatedDefinition) {
    const result = await storePreCreatedAnonCredsDefinition(issuerAgent, preCreatedDefinition)
    schemaId = result.schemaId
    credentialDefinitionId = result.credentialDefinitionId
  } else {
    throw new CredoError('Either attributeNames or preCreatedDefinition must be provided')
  }

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

    verifierAgent: verifierName ? verifierAgent : undefined,
    verifierReplay: verifierName ? verifierReplay : undefined,

    credentialDefinitionId,
    schemaId,

    issuerHolderConnectionId: issuerHolderConnection?.id,
    holderIssuerConnectionId: holderIssuerConnection?.id,
    holderVerifierConnectionId: holderVerifierConnection?.id,
    verifierHolderConnectionId: verifierHolderConnection?.id,

    teardown: async () => {
      await issuerPostgresDrizzle?.teardown()
      await holderPostgresDrizzle?.teardown()
      await verifierPostgresDrizzle?.teardown()
    },
  } as unknown as SetupAnonCredsTestsReturn<VerifierName, CreateConnections>
}

export async function prepareForAnonCredsIssuance(agent: Agent, { attributeNames }: { attributeNames: string[] }) {
  // Add existing endorser did to the wallet
  const unqualifiedDid = await importExistingIndyDidFromPrivateKey(agent, TypedArrayEncoder.fromString(publicDidSeed))
  const didIndyDid = `did:indy:pool:localtest:${unqualifiedDid}`

  const schema = await registerSchema(agent, {
    // TODO: update attrNames to attributeNames
    attrNames: attributeNames,
    name: `Schema ${randomUUID()}`,
    version: '1.0',
    issuerId: didIndyDid,
  })

  // Wait some time pass to let ledger settle the object
  await sleep(1000)

  const credentialDefinition = await registerCredentialDefinition(agent, {
    schemaId: schema.schemaId,
    issuerId: didIndyDid,
    tag: 'default',
  })

  const s = parseIndySchemaId(schema.schemaId)
  const cd = parseIndyCredentialDefinitionId(credentialDefinition.credentialDefinitionId)

  const legacySchemaId = getUnqualifiedSchemaId(s.namespaceIdentifier, s.schemaName, s.schemaVersion)
  const legacyCredentialDefinitionId = getUnqualifiedCredentialDefinitionId(
    cd.namespaceIdentifier,
    cd.schemaSeqNo,
    cd.tag
  )

  // Wait some time pass to let ledger settle the object
  await sleep(1000)

  // NOTE: we return the legacy schema and credential definition ids here because that's what currently expected
  // in all tests. If we also support did:indy in tests we probably want to return the qualified identifiers here
  // and transform them to the legacy variant in the specific tests that need it.
  return {
    schema: {
      ...schema,
      schemaId: legacySchemaId,
    },
    credentialDefinition: {
      ...credentialDefinition,
      credentialDefinitionId: legacyCredentialDefinitionId,
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
