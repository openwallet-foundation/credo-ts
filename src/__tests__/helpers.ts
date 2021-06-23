import cors from 'cors'
import express, { Express } from 'express'
import { Server } from 'http'
import type { CredDef, Did, Schema } from 'indy-sdk'
import indy from 'indy-sdk'
import fetch from 'node-fetch'
import path from 'path'
import { Subject } from 'rxjs'
import { Agent, InboundTransporter, OutboundTransporter } from '..'
import { BasicMessage, BasicMessageEventTypes, BasicMessageReceivedEvent } from '../modules/basic-messages'
import {
  ConnectionInvitationMessage,
  ConnectionRecord,
  ConnectionRole,
  ConnectionState,
  ConnectionStorageProps,
  DidCommService,
  DidDoc,
} from '../modules/connections'
import {
  CredentialEventTypes,
  CredentialOfferTemplate,
  CredentialRecord,
  CredentialState,
  CredentialStateChangedEvent,
} from '../modules/credentials'
import { CredentialDefinitionTemplate, SchemaTemplate } from '../modules/ledger'
import { ProofEventTypes, ProofRecord, ProofState, ProofStateChangedEvent } from '../modules/proofs'
import { MediationRecord, MediationState, MediationStateChangedEvent, RoutingEventTypes } from '../modules/routing'
import { NodeFileSystem } from '../storage/fs/NodeFileSystem'
import { InMemoryMessageRepository } from '../storage/InMemoryMessageRepository'
import { MessageRepository } from '../storage/MessageRepository'
import { InitConfig, OutboundPackage, WireMessage } from '../types'
import testLogger from './logger'

export const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../network/genesis/local-genesis.txn')

export const publicDidSeed = process.env.TEST_AGENT_PUBLIC_DID_SEED ?? '000000000000000000000000Trustee9'

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

  return {
    agentAConnection,
    agentBConnection,
  }
}

export async function makeTransport(
  agent: Agent,
  inboundTransporter: InboundTransporter,
  outboundTransporter: OutboundTransporter
) {
  agent.setInboundTransporter(inboundTransporter)
  agent.setOutboundTransporter(outboundTransporter)
  await agent.init()
}

export function makeInBoundTransporter() {
  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use(
    express.text({
      type: ['application/ssi-agent-wire', 'text/plain'],
    })
  )
  app.set('json spaces', 2)
  return new mockInBoundTransporter(app)
}

export class mockInBoundTransporter implements InboundTransporter {
  private app: Express
  public server?: Server
  public constructor(app: Express) {
    this.app = app
  }
  public async start(agent: Agent) {
    this.app.post('/msg', async (req, res) => {
      const packedMessage = JSON.parse(req.body)
      try {
        const outboundMessage = await agent.receiveMessage(packedMessage)
        if (outboundMessage) {
          res.status(200).json(outboundMessage.payload).end()
        } else {
          res.status(200).end()
        }
      } catch (e) {
        res.status(200).end()
      }
    })
    this.server = this.app.listen(agent.getPort())
  }
  public async stop(): Promise<void> {
    this.server?.close()
  }
}

export class mockOutBoundTransporter implements OutboundTransporter {
  private agent: Agent

  public constructor(agent: Agent) {
    this.agent = agent
  }

  public async start(): Promise<void> {
    // No custom start logic required
  }
  public async stop(): Promise<void> {
    // No custom stop logic required
  }
  public supportedSchemes = ['http', 'dicomm', 'https']
  public async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload, endpoint, responseRequested } = outboundPackage
    if (!endpoint || endpoint == 'didcomm:transport/queue') {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`)
    }
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ssi-agent-wire',
        },
        body: JSON.stringify(payload),
      })
      const data = await response.text()
      if (data) {
        testLogger.debug(`Response received:\n ${response}`)
        const wireMessage = JSON.parse(data)
        this.agent.receiveMessage(wireMessage)
      } else {
        testLogger.debug(`No response received.`)
      }
    } catch (e) {
      testLogger.debug('error sending message', e)
      throw e
    }
  }
}

export class MockMediatorOutboundTransporter implements OutboundTransporter {
  private agent: Agent
  private messageRepository: MessageRepository

  public constructor(agent: Agent) {
    this.agent = agent
    this.messageRepository = new InMemoryMessageRepository()
  }

  public async start(): Promise<void> {
    // No custom start logic required
  }
  public async stop(): Promise<void> {
    // No custom stop logic required
  }
  public supportedSchemes = ['http', 'dicomm', 'https']
  public async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload, endpoint, responseRequested } = outboundPackage
    if (!endpoint) {
      throw new Error('Missing endpoint')
    }
    if (endpoint == 'didcomm:transport/queue' && this.messageRepository) {
      testLogger.debug('Storing message for queue: ', { connection, payload })
      this.agent.mediator.queueMessage(connection.theirKey!, payload)
      return
    }
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ssi-agent-wire',
        },
        body: JSON.stringify(payload),
      })
      const data = await response.text()
      if (data) {
        testLogger.debug(`Response received:\n ${response}`)
        const wireMessage = JSON.parse(data)
        this.agent.receiveMessage(wireMessage)
      } else {
        testLogger.debug(`No response received.`)
      }
    } catch (e) {
      testLogger.debug('error sending message', e)
      throw e
    }
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
