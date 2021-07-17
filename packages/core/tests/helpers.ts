import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { BasicMessage, BasicMessageReceivedEvent } from '../src/modules/basic-messages'
import type { ConnectionRecordProps } from '../src/modules/connections'
import type { CredentialOfferTemplate, CredentialStateChangedEvent } from '../src/modules/credentials'
import type { CredentialDefinitionTemplate, SchemaTemplate } from '../src/modules/ledger'
import type { ProofAttributeInfo, ProofPredicateInfo, ProofStateChangedEvent } from '../src/modules/proofs'
import type { InitConfig } from '../src/types'
import type { CredDef, Did, Schema } from 'indy-sdk'

import path from 'path'
import { firstValueFrom, Subject } from 'rxjs'
import { catchError, filter, first, map, timeout } from 'rxjs/operators'

import { SubjectInboundTransporter } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransporter } from '../../../tests/transport/SubjectOutboundTransport'
import { agentDependencies } from '../../node/src'
import { Agent } from '../src/agent/Agent'
import { AgentConfig } from '../src/agent/AgentConfig'
import { LogLevel } from '../src/logger/Logger'
import { BasicMessageEventTypes } from '../src/modules/basic-messages'
import {
  ConnectionInvitationMessage,
  ConnectionRecord,
  ConnectionRole,
  ConnectionState,
  DidCommService,
  DidDoc,
} from '../src/modules/connections'
import {
  CredentialEventTypes,
  CredentialPreview,
  CredentialPreviewAttribute,
  CredentialState,
} from '../src/modules/credentials'
import { AutoAcceptCredential } from '../src/modules/credentials/CredentialAutoAcceptType'
import { ProofEventTypes, ProofState } from '../src/modules/proofs'
import { uuid } from '../src/utils/uuid'

import testLogger, { TestLogger } from './logger'

import { AriesFrameworkError } from '@aries-framework/core'

export const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../../network/genesis/local-genesis.txn')

export const publicDidSeed = process.env.TEST_AGENT_PUBLIC_DID_SEED ?? '000000000000000000000000Trustee9'

export function getBaseConfig(name: string, extraConfig: Partial<InitConfig> = {}) {
  const config: InitConfig = {
    label: `Agent: ${name}`,
    walletConfig: { id: `Wallet: ${name}` },
    walletCredentials: { key: `Key: ${name}` },
    publicDidSeed,
    autoAcceptConnections: true,
    genesisPath,
    poolName: `pool-${name.toLowerCase()}`,
    logger: new TestLogger(LogLevel.error, name),
    ...extraConfig,
  }

  return { config, agentDependencies: agentDependencies } as const
}

export function getAgentConfig(name: string, extraConfig: Partial<InitConfig> = {}) {
  const { config, agentDependencies } = getBaseConfig(name, extraConfig)
  return new AgentConfig(config, agentDependencies)
}

export async function waitForProofRecord(
  agent: Agent,
  {
    threadId,
    state,
    previousState,
    timeoutMs = 5000,
  }: {
    threadId?: string
    state?: ProofState
    previousState?: ProofState | null
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged).pipe(
    filter((e) => previousState === undefined || e.payload.previousState === previousState),
    filter((e) => threadId === undefined || e.payload.proofRecord.threadId === threadId),
    filter((e) => state === undefined || e.payload.proofRecord.state === state),
    timeout(timeoutMs),
    catchError(() => {
      throw new Error(`ProofStateChanged event not emitted within specified timeout: {
  previousState: ${previousState},
  threadId: ${threadId},
  state: ${state}
}`)
    }),
    first(),
    map((e) => e.payload.proofRecord)
  )

  return firstValueFrom(observable)
}

export async function waitForCredentialRecord(
  agent: Agent,
  {
    threadId,
    state,
    previousState,
    timeoutMs = 5000,
  }: {
    threadId?: string
    state?: CredentialState
    previousState?: CredentialState | null
    timeoutMs?: number
  }
) {
  const observable = agent.events
    .observable<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged)
    .pipe(
      filter((e) => previousState === undefined || e.payload.previousState === previousState),
      filter((e) => threadId === undefined || e.payload.credentialRecord.threadId === threadId),
      filter((e) => state === undefined || e.payload.credentialRecord.state === state),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(`CredentialStateChanged event not emitted within specified timeout: {
  previousState: ${previousState},
  threadId: ${threadId},
  state: ${state}
}`)
      }),
      first(),
      map((e) => e.payload.credentialRecord)
    )

  return firstValueFrom(observable)
}

export async function waitForBasicMessage(agent: Agent, { content }: { content?: string }): Promise<BasicMessage> {
  return new Promise((resolve) => {
    const listener = (event: BasicMessageReceivedEvent) => {
      const contentMatches = content === undefined || event.payload.message.content === content

      if (contentMatches) {
        agent.events.off<BasicMessageReceivedEvent>(BasicMessageEventTypes.BasicMessageReceived, listener)

        resolve(event.payload.message)
      }
    }

    agent.events.on<BasicMessageReceivedEvent>(BasicMessageEventTypes.BasicMessageReceived, listener)
  })
}

export function getMockConnection({
  state = ConnectionState.Invited,
  role = ConnectionRole.Invitee,
  id = 'test',
  did = 'test-did',
  threadId = 'threadId',
  verkey = 'key-1',
  didDoc = new DidDoc({
    id: did,
    publicKey: [],
    authentication: [],
    service: [
      new DidCommService({
        id: `${did};indy`,
        serviceEndpoint: 'https://endpoint.com',
        recipientKeys: [verkey],
      }),
    ],
  }),
  tags = {},
  invitation = new ConnectionInvitationMessage({
    label: 'test',
    recipientKeys: [verkey],
    serviceEndpoint: 'https:endpoint.com/msg',
  }),
  theirDid = 'their-did',
  theirDidDoc = new DidDoc({
    id: theirDid,
    publicKey: [],
    authentication: [],
    service: [
      new DidCommService({
        id: `${did};indy`,
        serviceEndpoint: 'https://endpoint.com',
        recipientKeys: [verkey],
      }),
    ],
  }),
}: Partial<ConnectionRecordProps> = {}) {
  return new ConnectionRecord({
    did,
    didDoc,
    threadId,
    theirDid,
    theirDidDoc,
    id,
    role,
    state,
    tags,
    verkey,
    invitation,
  })
}

export async function makeConnection(
  agentA: Agent,
  agentB: Agent,
  config?: {
    autoAcceptConnection?: boolean
    alias?: string
    mediatorId?: string
  }
) {
  // eslint-disable-next-line prefer-const
  let { invitation, connectionRecord: agentAConnection } = await agentA.connections.createConnection(config)
  let agentBConnection = await agentB.connections.receiveInvitation(invitation)

  agentAConnection = await agentA.connections.returnWhenIsConnected(agentAConnection.id)
  agentBConnection = await agentB.connections.returnWhenIsConnected(agentBConnection.id)

  return [agentAConnection, agentBConnection]
}

export async function registerSchema(agent: Agent, schemaTemplate: SchemaTemplate): Promise<Schema> {
  const schema = await agent.ledger.registerSchema(schemaTemplate)
  testLogger.test(`created schema with id ${schema.id}`, schema)
  return schema
}

export async function registerDefinition(
  agent: Agent,
  definitionTemplate: CredentialDefinitionTemplate
): Promise<CredDef> {
  const credentialDefinition = await agent.ledger.registerCredentialDefinition(definitionTemplate)
  testLogger.test(`created credential definition with id ${credentialDefinition.id}`, credentialDefinition)
  return credentialDefinition
}

export function previewFromAttributes(attributes: Record<string, string>): CredentialPreview {
  return new CredentialPreview({
    attributes: Object.entries(attributes).map(
      ([name, value]) =>
        new CredentialPreviewAttribute({
          name,
          value,
        })
    ),
  })
}

export async function prepareForIssuance(agent: Agent, attributes: string[]) {
  const publicDid = agent.publicDid?.did

  if (!publicDid) {
    throw new AriesFrameworkError('No public did')
  }

  await ensurePublicDidIsOnLedger(agent, publicDid)

  const schema = await registerSchema(agent, {
    attributes,
    name: `schema-${uuid()}`,
    version: '1.0',
  })

  const definition = await registerDefinition(agent, {
    schema,
    signatureType: 'CL',
    supportRevocation: false,
    tag: 'default',
  })

  return {
    schema,
    definition,
    publicDid,
  }
}

export async function ensurePublicDidIsOnLedger(agent: Agent, publicDid: Did) {
  try {
    testLogger.test(`Ensure test DID ${publicDid} is written to ledger`)
    await agent.ledger.getPublicDid(publicDid)
  } catch (error) {
    // Unfortunately, this won't prevent from the test suite running because of Jest runner runs all tests
    // regardless of thrown errors. We're more explicit about the problem with this error handling.
    throw new Error(`Test DID ${publicDid} is not written on ledger or ledger is not available: ${error.message}`)
  }
}

/**
 * Assumes that the autoAcceptCredential is set to {@link AutoAcceptCredential.ContentApproved}
 */
export async function issueCredential({
  issuerAgent,
  issuerConnectionId,
  holderAgent,
  credentialTemplate,
}: {
  issuerAgent: Agent
  issuerConnectionId: string
  holderAgent: Agent
  credentialTemplate: Omit<CredentialOfferTemplate, 'autoAcceptCredential'>
}) {
  let issuerCredentialRecord = await issuerAgent.credentials.offerCredential(issuerConnectionId, {
    ...credentialTemplate,
    autoAcceptCredential: AutoAcceptCredential.ContentApproved,
  })

  let holderCredentialRecord = await waitForCredentialRecord(holderAgent, {
    threadId: issuerCredentialRecord.threadId,
    state: CredentialState.OfferReceived,
  })

  await holderAgent.credentials.acceptOffer(holderCredentialRecord.id, {
    autoAcceptCredential: AutoAcceptCredential.ContentApproved,
  })

  holderCredentialRecord = await waitForCredentialRecord(holderAgent, {
    threadId: issuerCredentialRecord.threadId,
    state: CredentialState.Done,
  })

  issuerCredentialRecord = await waitForCredentialRecord(issuerAgent, {
    threadId: issuerCredentialRecord.threadId,
    state: CredentialState.Done,
  })

  return {
    issuerCredential: issuerCredentialRecord,
    holderCredential: holderCredentialRecord,
  }
}

export async function issueConnectionLessCredential({
  issuerAgent,
  holderAgent,
  credentialTemplate,
}: {
  issuerAgent: Agent
  holderAgent: Agent
  credentialTemplate: Omit<CredentialOfferTemplate, 'autoAcceptCredential'>
}) {
  // eslint-disable-next-line prefer-const
  let { credentialRecord: issuerCredentialRecord, offerMessage } = await issuerAgent.credentials.createOutOfBandOffer({
    ...credentialTemplate,
    autoAcceptCredential: AutoAcceptCredential.ContentApproved,
  })

  const credentialRecordPromise = waitForCredentialRecord(holderAgent, {
    threadId: issuerCredentialRecord.threadId,
    state: CredentialState.OfferReceived,
  })

  await holderAgent.receiveMessage(offerMessage.toJSON())
  let holderCredentialRecord = await credentialRecordPromise

  holderCredentialRecord = await holderAgent.credentials.acceptOffer(holderCredentialRecord.id, {
    autoAcceptCredential: AutoAcceptCredential.ContentApproved,
  })

  holderCredentialRecord = await waitForCredentialRecord(holderAgent, {
    threadId: issuerCredentialRecord.threadId,
    state: CredentialState.Done,
  })

  issuerCredentialRecord = await waitForCredentialRecord(issuerAgent, {
    threadId: issuerCredentialRecord.threadId,
    state: CredentialState.Done,
  })

  return {
    issuerCredential: issuerCredentialRecord,
    holderCredential: holderCredentialRecord,
  }
}

export async function presentProof({
  verifierAgent,
  verifierConnectionId,
  holderAgent,
  presentationTemplate: { attributes, predicates },
}: {
  verifierAgent: Agent
  verifierConnectionId: string
  holderAgent: Agent
  presentationTemplate: {
    attributes?: Record<string, ProofAttributeInfo>
    predicates?: Record<string, ProofPredicateInfo>
  }
}) {
  let verifierRecord = await verifierAgent.proofs.requestProof(verifierConnectionId, {
    name: 'test-proof-request',
    requestedAttributes: attributes,
    requestedPredicates: predicates,
  })

  let holderRecord = await waitForProofRecord(holderAgent, {
    threadId: verifierRecord.threadId,
    state: ProofState.RequestReceived,
  })

  const verifierRecordPromise = waitForProofRecord(verifierAgent, {
    threadId: holderRecord.threadId,
    state: ProofState.PresentationReceived,
  })

  const indyProofRequest = holderRecord.requestMessage?.indyProofRequest
  if (!indyProofRequest) {
    throw new Error('indyProofRequest missing')
  }
  const retrievedCredentials = await holderAgent.proofs.getRequestedCredentialsForProofRequest(indyProofRequest)
  const requestedCredentials = holderAgent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)
  await holderAgent.proofs.acceptRequest(holderRecord.id, requestedCredentials)

  verifierRecord = await verifierRecordPromise

  // assert presentation is valid
  expect(verifierRecord.isVerified).toBe(true)

  const holderRecordPromise = waitForProofRecord(holderAgent, {
    threadId: holderRecord.threadId,
    state: ProofState.Done,
  })

  verifierRecord = await verifierAgent.proofs.acceptPresentation(verifierRecord.id)
  holderRecord = await holderRecordPromise

  return {
    verifierProof: verifierRecord,
    holderProof: holderRecord,
  }
}

/**
 * Returns mock of function with correct type annotations according to original function `fn`.
 * It can be used also for class methods.
 *
 * @param fn function you want to mock
 * @returns mock function with type annotations
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mockFunction<T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> {
  return fn as jest.MockedFunction<T>
}

export async function setupCredentialTests(
  faberName: string,
  aliceName: string,
  autoAcceptCredentials?: AutoAcceptCredential
) {
  const faberMessages = new Subject<SubjectMessage>()
  const aliceMessages = new Subject<SubjectMessage>()
  const subjectMap = {
    'rxjs:faber': faberMessages,
    'rxjs:alice': aliceMessages,
  }
  const faberConfig = getBaseConfig(faberName, {
    genesisPath,
    endpoint: 'rxjs:faber',
    autoAcceptCredentials,
  })

  const aliceConfig = getBaseConfig(aliceName, {
    genesisPath,
    endpoint: 'rxjs:alice',
    autoAcceptCredentials,
  })
  const faberAgent = new Agent(faberConfig.config, faberConfig.agentDependencies)
  faberAgent.setInboundTransporter(new SubjectInboundTransporter(faberMessages))
  faberAgent.setOutboundTransporter(new SubjectOutboundTransporter(aliceMessages, subjectMap))
  await faberAgent.initialize()

  const aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
  aliceAgent.setInboundTransporter(new SubjectInboundTransporter(aliceMessages))
  aliceAgent.setOutboundTransporter(new SubjectOutboundTransporter(faberMessages, subjectMap))
  await aliceAgent.initialize()

  const {
    schema: { id: schemaId },
    definition: { id: credDefId },
  } = await prepareForIssuance(faberAgent, ['name', 'age', 'profile_picture', 'x-ray'])

  const [faberConnection, aliceConnection] = await makeConnection(faberAgent, aliceAgent)

  return { faberAgent, aliceAgent, credDefId, schemaId, faberConnection, aliceConnection }
}
