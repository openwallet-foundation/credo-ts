import type { Schema, CredDef, Did } from 'indy-sdk'
import indy from 'indy-sdk'
import path from 'path'
import { Subject } from 'rxjs'
import { Agent, InboundTransporter, OutboundTransporter } from '..'
import { InitConfig, OutboundPackage, WireMessage } from '../types'
import {
  ConnectionInvitationMessage,
  ConnectionRecord,
  ConnectionRole,
  ConnectionState,
  ConnectionStorageProps,
  DidCommService,
  DidDoc,
} from '../modules/connections'
import { ProofEventTypes, ProofRecord, ProofState, ProofStateChangedEvent } from '../modules/proofs'
import { SchemaTemplate, CredentialDefinitionTemplate } from '../modules/ledger'
import {
  CredentialRecord,
  CredentialOfferTemplate,
  CredentialStateChangedEvent,
  CredentialState,
  CredentialEventTypes,
} from '../modules/credentials'
import { BasicMessage, BasicMessageEventTypes, BasicMessageReceivedEvent } from '../modules/basic-messages'
import testLogger from './logger'
import { NodeFileSystem } from '../storage/fs/NodeFileSystem'
import { RoutingEventTypes, MediationStateChangedEvent, MediationState, MediationRecord } from '../modules/routing'

export const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../network/genesis/local-genesis.txn')

export const publicDidSeed = process.env.TEST_AGENT_PUBLIC_DID_SEED ?? '000000000000000000000000Trustee9'

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

export function getBaseConfig(name: string, extraConfig: Partial<InitConfig> = {}) {
  const config: InitConfig = {
    label: `Agent: ${name}`,
    // host: 'http://localhost',
    // port: '3001',
    walletConfig: { id: `Wallet: ${name}` },
    walletCredentials: { key: `Key: ${name}` },
    publicDidSeed,
    autoAcceptConnections: true,
    poolName: `pool-${name.toLowerCase()}`,
    logger: testLogger,
    indy,
    fileSystem: new NodeFileSystem(),
    ...extraConfig,
  }

  return config
}

export async function waitForProofRecord(
  agent: Agent,
  {
    threadId,
    state,
    previousState,
  }: {
    threadId?: string
    state?: ProofState
    previousState?: ProofState | null
  }
): Promise<ProofRecord> {
  return new Promise((resolve) => {
    const listener = (event: ProofStateChangedEvent) => {
      const previousStateMatches = previousState === undefined || event.payload.previousState === previousState
      const threadIdMatches = threadId === undefined || event.payload.proofRecord.tags.threadId === threadId
      const stateMatches = state === undefined || event.payload.proofRecord.state === state

      if (previousStateMatches && threadIdMatches && stateMatches) {
        agent.events.off<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged, listener)

        resolve(event.payload.proofRecord)
      }
    }

    agent.events.on<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged, listener)
  })
}

export async function waitForCredentialRecord(
  agent: Agent,
  {
    threadId,
    state,
    previousState,
  }: {
    threadId?: string
    state?: CredentialState
    previousState?: CredentialState | null
  }
): Promise<CredentialRecord> {
  return new Promise((resolve) => {
    const listener = (event: CredentialStateChangedEvent) => {
      const previousStateMatches = previousState === undefined || event.payload.previousState === previousState
      const threadIdMatches = threadId === undefined || event.payload.credentialRecord.tags.threadId === threadId
      const stateMatches = state === undefined || event.payload.credentialRecord.state === state

      if (previousStateMatches && threadIdMatches && stateMatches) {
        agent.events.off<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, listener)

        resolve(event.payload.credentialRecord)
      }
    }

    agent.events.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, listener)
  })
}

export async function waitForMediationRecord(
  agent: Agent,
  {
    id,
    state,
    previousState,
  }: {
    id?: string
    state?: MediationState
    previousState?: MediationState | null
  }
): Promise<MediationRecord> {
  return new Promise((resolve) => {
    const listener = (event: MediationStateChangedEvent) => {
      const previousStateMatches = previousState === undefined || event.payload.previousState === previousState
      const mediationIdMatches = id === undefined || event.payload.mediationRecord.id === id
      const stateMatches = state === undefined || event.payload.mediationRecord.state === state

      if (previousStateMatches && mediationIdMatches && stateMatches) {
        agent.events.off<MediationStateChangedEvent>(RoutingEventTypes.MediationStateChanged, listener)

        resolve(event.payload.mediationRecord)
      }
    }

    agent.events.on<MediationStateChangedEvent>(RoutingEventTypes.MediationStateChanged, listener)
  })
}

export async function waitForBasicMessage(
  agent: Agent,
  { verkey, content }: { verkey?: string; content?: string }
): Promise<BasicMessage> {
  return new Promise((resolve) => {
    const listener = (event: BasicMessageReceivedEvent) => {
      const verkeyMatches = verkey === undefined || event.payload.verkey === verkey
      const contentMatches = content === undefined || event.payload.message.content === content

      if (verkeyMatches && contentMatches) {
        agent.events.off<BasicMessageReceivedEvent>(BasicMessageEventTypes.BasicMessageReceived, listener)

        resolve(event.payload.message)
      }
    }

    agent.events.on<BasicMessageReceivedEvent>(BasicMessageEventTypes.BasicMessageReceived, listener)
  })
}

export class SubjectInboundTransporter implements InboundTransporter {
  private subject: Subject<WireMessage>
  private theirSubject: Subject<WireMessage>

  public constructor(subject: Subject<WireMessage>, theirSubject: Subject<WireMessage>) {
    this.subject = subject
    this.theirSubject = theirSubject
  }

  public async start(agent: Agent) {
    this.subscribe(agent)
  }

  private subscribe(agent: Agent) {
    this.subject.subscribe({
      next: async (message: WireMessage) => {
        const outboundMessage = await agent.receiveMessage(message)
        if (outboundMessage) {
          this.theirSubject.next(outboundMessage.payload)
        }
      },
    })
  }
}

export class SubjectOutboundTransporter implements OutboundTransporter {
  private subject: Subject<WireMessage>

  public supportedSchemes = []

  public constructor(subject: Subject<WireMessage>) {
    this.subject = subject
  }

  public async start(): Promise<void> {
    // Nothing required to start
  }

  public async stop(): Promise<void> {
    // Nothing required to stop
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    testLogger.test(`Sending outbound message to connection ${outboundPackage.connection.id}`)
    const { payload } = outboundPackage
    this.subject.next(payload)
  }
}

export function getMockConnection({
  state = ConnectionState.Invited,
  role = ConnectionRole.Invitee,
  id = 'test',
  did = 'test-did',
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
}: Partial<ConnectionStorageProps> = {}) {
  return new ConnectionRecord({
    did,
    didDoc,
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

export async function makeConnection(agentA: Agent, agentB: Agent) {
  // eslint-disable-next-line prefer-const
  let { invitation, connectionRecord: agentAConnection } = await agentA.connections.createConnection()
  let agentBConnection = await agentB.connections.receiveInvitation(invitation)

  agentAConnection = await agentA.connections.returnWhenIsConnected(agentAConnection.id)
  agentBConnection = await agentB.connections.returnWhenIsConnected(agentBConnection.id)

  return {
    agentAConnection,
    agentBConnection,
  }
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

export async function ensurePublicDidIsOnLedger(agent: Agent, publicDid: Did) {
  try {
    testLogger.test(`Ensure test DID ${publicDid} is written to ledger`)
    await agent.ledger.getPublicDid(publicDid)
  } catch (error) {
    // Unfortunately, this won't prevent from the test suite running because of Jest runner runs all tests
    // regardless of thrown errors. We're more explicit about the problem with this error handling.
    throw new Error(`Test DID ${publicDid} is not written on ledger or ledger is not available.`)
  }
}

export async function issueCredential({
  issuerAgent,
  issuerConnectionId,
  holderAgent,
  credentialTemplate,
}: {
  issuerAgent: Agent
  issuerConnectionId: string
  holderAgent: Agent
  credentialTemplate: CredentialOfferTemplate
}) {
  let issuerCredentialRecord = await issuerAgent.credentials.offerCredential(issuerConnectionId, credentialTemplate)

  let holderCredentialRecord = await waitForCredentialRecord(holderAgent, {
    threadId: issuerCredentialRecord.tags.threadId,
    state: CredentialState.OfferReceived,
  })

  holderCredentialRecord = await holderAgent.credentials.acceptOffer(holderCredentialRecord.id)

  issuerCredentialRecord = await waitForCredentialRecord(issuerAgent, {
    threadId: holderCredentialRecord.tags.threadId,
    state: CredentialState.RequestReceived,
  })

  issuerCredentialRecord = await issuerAgent.credentials.acceptRequest(issuerCredentialRecord.id)

  holderCredentialRecord = await waitForCredentialRecord(holderAgent, {
    threadId: issuerCredentialRecord.tags.threadId,
    state: CredentialState.CredentialReceived,
  })

  holderCredentialRecord = await holderAgent.credentials.acceptCredential(holderCredentialRecord.id)

  issuerCredentialRecord = await waitForCredentialRecord(issuerAgent, {
    threadId: issuerCredentialRecord.tags.threadId,
    state: CredentialState.Done,
  })

  return {
    issuerCredential: issuerCredentialRecord,
    holderCredential: holderCredentialRecord,
  }
}

export function mockFunction<T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> {
  return fn as jest.MockedFunction<T>
}
