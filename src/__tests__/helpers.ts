/* eslint-disable no-console */
import type { SchemaId, Schema, CredDefId, CredDef, Did } from 'indy-sdk'
import path from 'path'
import { Subject } from 'rxjs'
import { Agent, InboundTransporter, OutboundTransporter } from '..'
import { OutboundPackage, WireMessage } from '../types'
import { ConnectionRecord } from '../modules/connections'
import { ProofRecord, ProofState, ProofEventType, ProofStateChangedEvent } from '../modules/proofs'
import { SchemaTemplate, CredDefTemplate } from '../modules/ledger'
import {
  CredentialRecord,
  CredentialOfferTemplate,
  CredentialEventType,
  CredentialStateChangedEvent,
  CredentialState,
} from '../modules/credentials'
import { BasicMessage, BasicMessageEventType, BasicMessageReceivedEvent } from '../modules/basic-messages'
import testLogger from './logger'

export const genesisPath = process.env.GENESIS_TXN_PATH
  ? path.resolve(process.env.GENESIS_TXN_PATH)
  : path.join(__dirname, '../../../network/genesis/local-genesis.txn')

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

// Custom matchers which can be used to extend Jest matchers via extend, e. g. `expect.extend({ toBeConnectedWith })`.

export function toBeConnectedWith(received: ConnectionRecord, connection: ConnectionRecord) {
  const pass = received.theirDid === connection.did && received.theirKey === connection.verkey
  if (pass) {
    return {
      message: () =>
        `expected connection ${received.did}, ${received.verkey} not to be connected to with ${connection.did}, ${connection.verkey}`,
      pass: true,
    }
  } else {
    return {
      message: () =>
        `expected connection ${received.did}, ${received.verkey} to be connected to with ${connection.did}, ${connection.verkey}`,
      pass: false,
    }
  }
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
      const previousStateMatches = previousState === undefined || event.previousState === previousState
      const threadIdMatches = threadId === undefined || event.proofRecord.tags.threadId === threadId
      const stateMatches = state === undefined || event.proofRecord.state === state

      if (previousStateMatches && threadIdMatches && stateMatches) {
        agent.proofs.events.removeListener(ProofEventType.StateChanged, listener)

        resolve(event.proofRecord)
      }
    }

    agent.proofs.events.addListener(ProofEventType.StateChanged, listener)
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
      const previousStateMatches = previousState === undefined || event.previousState === previousState
      const threadIdMatches = threadId === undefined || event.credentialRecord.tags.threadId === threadId
      const stateMatches = state === undefined || event.credentialRecord.state === state

      if (previousStateMatches && threadIdMatches && stateMatches) {
        agent.credentials.events.removeListener(CredentialEventType.StateChanged, listener)

        resolve(event.credentialRecord)
      }
    }

    agent.credentials.events.addListener(CredentialEventType.StateChanged, listener)
  })
}

export async function waitForBasicMessage(
  agent: Agent,
  { verkey, content }: { verkey?: string; content?: string }
): Promise<BasicMessage> {
  return new Promise((resolve) => {
    const listener = (event: BasicMessageReceivedEvent) => {
      const verkeyMatches = verkey === undefined || event.verkey === verkey
      const contentMatches = content === undefined || event.message.content === content

      if (verkeyMatches && contentMatches) {
        agent.basicMessages.events.removeListener(BasicMessageEventType.MessageReceived, listener)

        resolve(event.message)
      }
    }

    agent.basicMessages.events.addListener(BasicMessageEventType.MessageReceived, listener)
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

  public constructor(subject: Subject<WireMessage>) {
    this.subject = subject
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    testLogger.test(`Sending outbound message to connection ${outboundPackage.connection.id}`)
    const { payload } = outboundPackage
    this.subject.next(payload)
  }
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

export async function registerSchema(agent: Agent, schemaTemplate: SchemaTemplate): Promise<[SchemaId, Schema]> {
  const [schemaId, ledgerSchema] = await agent.ledger.registerSchema(schemaTemplate)
  testLogger.test(`created schema with id ${schemaId}`, ledgerSchema)
  return [schemaId, ledgerSchema]
}

export async function registerDefinition(
  agent: Agent,
  definitionTemplate: CredDefTemplate
): Promise<[CredDefId, CredDef]> {
  const [credDefId, ledgerCredDef] = await agent.ledger.registerCredentialDefinition(definitionTemplate)
  testLogger.test(`created credential definition with id ${credDefId}`, ledgerCredDef)
  return [credDefId, ledgerCredDef]
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
