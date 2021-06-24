import type { Agent } from '../agent/Agent'
import type { BasicMessage, BasicMessageReceivedEvent } from '../modules/basic-messages'
import type { ConnectionRecordProps } from '../modules/connections'
import type { CredentialRecord, CredentialOfferTemplate, CredentialStateChangedEvent } from '../modules/credentials'
import type { SchemaTemplate, CredentialDefinitionTemplate } from '../modules/ledger'
import type { ProofRecord, ProofState, ProofStateChangedEvent } from '../modules/proofs'
import type { InboundTransporter, OutboundTransporter } from '../transport'
import type { InitConfig, OutboundPackage, WireMessage } from '../types'
import type { Wallet } from '../wallet/Wallet'
import type { Schema, CredDef, Did } from 'indy-sdk'
import type { Subject } from 'rxjs'

import indy from 'indy-sdk'
import path from 'path'

import { InjectionSymbols } from '../constants'
import { BasicMessageEventTypes } from '../modules/basic-messages'
import {
  ConnectionInvitationMessage,
  ConnectionRecord,
  ConnectionRole,
  ConnectionState,
  DidCommService,
  DidDoc,
} from '../modules/connections'
import { CredentialState, CredentialEventTypes } from '../modules/credentials'
import { ProofEventTypes } from '../modules/proofs'
import { NodeFileSystem } from '../storage/fs/NodeFileSystem'

import testLogger from './logger'

export const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../network/genesis/local-genesis.txn')

export const publicDidSeed = process.env.TEST_AGENT_PUBLIC_DID_SEED ?? '000000000000000000000000Trustee9'

export function getBaseConfig(name: string, extraConfig: Partial<InitConfig> = {}) {
  const config: InitConfig = {
    label: `Agent: ${name}`,
    mediatorUrl: 'http://localhost:3001',
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

export async function closeAndDeleteWallet(agent: Agent) {
  const wallet = agent.injectionContainer.resolve<Wallet>(InjectionSymbols.Wallet)

  await wallet.deleteWallet()
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
      const threadIdMatches = threadId === undefined || event.payload.proofRecord.threadId === threadId
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
      const threadIdMatches = threadId === undefined || event.payload.credentialRecord.threadId === threadId
      const stateMatches = state === undefined || event.payload.credentialRecord.state === state

      if (previousStateMatches && threadIdMatches && stateMatches) {
        agent.events.off<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, listener)

        resolve(event.payload.credentialRecord)
      }
    }

    agent.events.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, listener)
  })
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
    threadId: issuerCredentialRecord.threadId,
    state: CredentialState.OfferReceived,
  })

  holderCredentialRecord = await holderAgent.credentials.acceptOffer(holderCredentialRecord.id)

  issuerCredentialRecord = await waitForCredentialRecord(issuerAgent, {
    threadId: holderCredentialRecord.threadId,
    state: CredentialState.RequestReceived,
  })

  issuerCredentialRecord = await issuerAgent.credentials.acceptRequest(issuerCredentialRecord.id)

  holderCredentialRecord = await waitForCredentialRecord(holderAgent, {
    threadId: issuerCredentialRecord.threadId,
    state: CredentialState.CredentialReceived,
  })

  holderCredentialRecord = await holderAgent.credentials.acceptCredential(holderCredentialRecord.id)

  issuerCredentialRecord = await waitForCredentialRecord(issuerAgent, {
    threadId: issuerCredentialRecord.threadId,
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
