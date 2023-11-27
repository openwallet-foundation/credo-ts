import type {
  AnonCredsRegisterCredentialDefinitionOptions,
  AnonCredsRequestedAttribute,
  AnonCredsRequestedPredicate,
  AnonCredsOfferCredentialFormat,
  AnonCredsSchema,
  RegisterCredentialDefinitionReturnStateFinished,
  RegisterSchemaReturnStateFinished,
  AnonCredsRegistry,
  AnonCredsRegisterRevocationRegistryDefinitionOptions,
  RegisterRevocationRegistryDefinitionReturnStateFinished,
  AnonCredsRegisterRevocationStatusListOptions,
  RegisterRevocationStatusListReturnStateFinished,
} from '../../anoncreds/src'
import type { EventReplaySubject } from '../../core/tests'
import type { AutoAcceptProof, ConnectionRecord } from '@aries-framework/core'

import {
  DidDocumentBuilder,
  CacheModule,
  InMemoryLruCache,
  Agent,
  AriesFrameworkError,
  AutoAcceptCredential,
  CredentialEventTypes,
  CredentialsModule,
  CredentialState,
  ProofEventTypes,
  ProofsModule,
  ProofState,
  V2CredentialProtocol,
  V2ProofProtocol,
  DidsModule,
} from '@aries-framework/core'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'
import { randomUUID } from 'crypto'

import { AnonCredsCredentialFormatService, AnonCredsProofFormatService, AnonCredsModule } from '../../anoncreds/src'
import { InMemoryAnonCredsRegistry } from '../../anoncreds/tests/InMemoryAnonCredsRegistry'
import { AskarModule } from '../../askar/src'
import { askarModuleConfig } from '../../askar/tests/helpers'
import { sleep } from '../../core/src/utils/sleep'
import { setupSubjectTransports, setupEventReplaySubjects } from '../../core/tests'
import {
  getAgentOptions,
  makeConnection,
  waitForCredentialRecordSubject,
  waitForProofExchangeRecordSubject,
} from '../../core/tests/helpers'
import testLogger from '../../core/tests/logger'
import { AnonCredsRsModule } from '../src'

import { InMemoryTailsFileService } from './InMemoryTailsFileService'
import { LocalDidResolver } from './LocalDidResolver'

// Helper type to get the type of the agents (with the custom modules) for the credential tests
export type AnonCredsTestsAgent = Agent<
  ReturnType<typeof getAnonCredsModules> & { mediationRecipient?: any; mediator?: any }
>

export const getAnonCredsModules = ({
  autoAcceptCredentials,
  autoAcceptProofs,
  registries,
}: {
  autoAcceptCredentials?: AutoAcceptCredential
  autoAcceptProofs?: AutoAcceptProof
  registries?: [AnonCredsRegistry, ...AnonCredsRegistry[]]
} = {}) => {
  const anonCredsCredentialFormatService = new AnonCredsCredentialFormatService()
  const anonCredsProofFormatService = new AnonCredsProofFormatService()

  const modules = {
    credentials: new CredentialsModule({
      autoAcceptCredentials,
      credentialProtocols: [
        new V2CredentialProtocol({
          credentialFormats: [anonCredsCredentialFormatService],
        }),
      ],
    }),
    proofs: new ProofsModule({
      autoAcceptProofs,
      proofProtocols: [
        new V2ProofProtocol({
          proofFormats: [anonCredsProofFormatService],
        }),
      ],
    }),
    anoncreds: new AnonCredsModule({
      registries: registries ?? [new InMemoryAnonCredsRegistry()],
      tailsFileService: new InMemoryTailsFileService(),
    }),
    anoncredsRs: new AnonCredsRsModule({
      anoncreds,
    }),
    dids: new DidsModule({
      resolvers: [new LocalDidResolver()],
    }),
    askar: new AskarModule(askarModuleConfig),
    cache: new CacheModule({
      cache: new InMemoryLruCache({ limit: 100 }),
    }),
  } as const

  return modules
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
    state: ProofState.RequestReceived,
  })

  let verifierProofExchangeRecord = await verifierAgent.proofs.requestProof({
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

  const selectedCredentials = await holderAgent.proofs.selectCredentialsForRequest({
    proofRecordId: holderProofExchangeRecord.id,
  })

  const verifierProofExchangeRecordPromise = waitForProofExchangeRecordSubject(verifierReplay, {
    threadId: holderProofExchangeRecord.threadId,
    state: ProofState.PresentationReceived,
  })

  await holderAgent.proofs.acceptRequest({
    proofRecordId: holderProofExchangeRecord.id,
    proofFormats: { anoncreds: selectedCredentials.proofFormats.anoncreds },
  })

  verifierProofExchangeRecord = await verifierProofExchangeRecordPromise

  // assert presentation is valid
  expect(verifierProofExchangeRecord.isVerified).toBe(true)

  holderProofExchangeRecordPromise = waitForProofExchangeRecordSubject(holderReplay, {
    threadId: holderProofExchangeRecord.threadId,
    state: ProofState.Done,
  })

  verifierProofExchangeRecord = await verifierAgent.proofs.acceptPresentation({
    proofRecordId: verifierProofExchangeRecord.id,
  })
  holderProofExchangeRecord = await holderProofExchangeRecordPromise

  return {
    verifierProofExchangeRecord,
    holderProofExchangeRecord,
  }
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
  revocationRegistryDefinitionId?: string
  offer: AnonCredsOfferCredentialFormat
}) {
  let issuerCredentialExchangeRecord = await issuerAgent.credentials.offerCredential({
    comment: 'some comment about credential',
    connectionId: issuerHolderConnectionId,
    protocolVersion: 'v2',
    credentialFormats: {
      anoncreds: { ...offer, revocationRegistryDefinitionId, revocationRegistryIndex: 1 },
    },
    autoAcceptCredential: AutoAcceptCredential.ContentApproved,
  })

  let holderCredentialExchangeRecord = await waitForCredentialRecordSubject(holderReplay, {
    threadId: issuerCredentialExchangeRecord.threadId,
    state: CredentialState.OfferReceived,
  })

  await holderAgent.credentials.acceptOffer({
    credentialRecordId: holderCredentialExchangeRecord.id,
    autoAcceptCredential: AutoAcceptCredential.ContentApproved,
  })

  // Because we use auto-accept it can take a while to have the whole credential flow finished
  // Both parties need to interact with the ledger and sign/verify the credential
  holderCredentialExchangeRecord = await waitForCredentialRecordSubject(holderReplay, {
    threadId: issuerCredentialExchangeRecord.threadId,
    state: CredentialState.Done,
  })
  issuerCredentialExchangeRecord = await waitForCredentialRecordSubject(issuerReplay, {
    threadId: issuerCredentialExchangeRecord.threadId,
    state: CredentialState.Done,
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
  revocationRegistryDefinitionId?: string
  revocationStatusListTimestamp?: number
}

export async function setupAnonCredsTests<
  VerifierName extends string | undefined = undefined,
  CreateConnections extends boolean = true
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
}: {
  issuerId: string
  issuerName: string
  holderName: string
  verifierName?: VerifierName
  autoAcceptCredentials?: AutoAcceptCredential
  autoAcceptProofs?: AutoAcceptProof
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
      getAnonCredsModules({
        autoAcceptCredentials,
        autoAcceptProofs,
        registries,
      })
    )
  )

  const holderAgent = new Agent(
    getAgentOptions(
      holderName,
      {
        endpoints: ['rxjs:holder'],
      },
      getAnonCredsModules({
        autoAcceptCredentials,
        autoAcceptProofs,
        registries,
      })
    )
  )

  const verifierAgent = verifierName
    ? new Agent(
        getAgentOptions(
          verifierName,
          {
            endpoints: ['rxjs:verifier'],
          },
          getAnonCredsModules({
            autoAcceptCredentials,
            autoAcceptProofs,
            registries,
          })
        )
      )
    : undefined

  setupSubjectTransports(verifierAgent ? [issuerAgent, holderAgent, verifierAgent] : [issuerAgent, holderAgent])
  const [issuerReplay, holderReplay, verifierReplay] = setupEventReplaySubjects(
    verifierAgent ? [issuerAgent, holderAgent, verifierAgent] : [issuerAgent, holderAgent],
    [CredentialEventTypes.CredentialStateChanged, ProofEventTypes.ProofStateChanged]
  )

  await issuerAgent.initialize()
  await holderAgent.initialize()
  if (verifierAgent) await verifierAgent.initialize()

  // Create default link secret for holder
  await holderAgent.modules.anoncreds.createLinkSecret({
    linkSecretId: 'default',
    setAsDefault: true,
  })

  const { credentialDefinition, revocationRegistryDefinition, revocationStatusList, schema } =
    await prepareForAnonCredsIssuance(issuerAgent, {
      issuerId,
      attributeNames,
      supportRevocation,
    })

  let issuerHolderConnection: ConnectionRecord | undefined
  let holderIssuerConnection: ConnectionRecord | undefined
  let verifierHolderConnection: ConnectionRecord | undefined
  let holderVerifierConnection: ConnectionRecord | undefined

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
  //const key = await agent.wallet.createKey({ keyType: KeyType.Ed25519 })

  const didDocument = new DidDocumentBuilder(issuerId).build()

  await agent.dids.import({ did: issuerId, didDocument })

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

  let revocationRegistryDefinition
  let revocationStatusList
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
    throw new AriesFrameworkError(
      `Schema not created: ${schemaState.state === 'failed' ? schemaState.reason : 'Not finished'}`
    )
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
    throw new AriesFrameworkError(
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
    throw new AriesFrameworkError(
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
    throw new AriesFrameworkError(
      `Revocation status list not created: ${
        revocationStatusListState.state === 'failed' ? revocationStatusListState.reason : 'Not finished'
      }`
    )
  }

  return revocationStatusListState
}
