import type { AgentMessage } from '../../agent/AgentMessage'
import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { Logger } from '../../logger'
import type { ConnectionRecord } from './repository'
import type { Routing } from './services/ConnectionService'

import { EventEmitter } from 'stream'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { InjectionSymbols } from '../../constants'
import { AriesFrameworkError } from '../../error'
import { Wallet } from '../../wallet/Wallet'
import { ProblemReportError } from '../problem-reports'

import { DidExchangeCompleteMessage } from './messages/DidExchangeCompleteMessage'
import { DidExchangeRequestMessage } from './messages/DidExchangeRequestMessage'
import { DidExchangeResponseMessage } from './messages/DidExchangeResponseMessage'
import { authenticationTypes, DidCommService, DidDoc, Ed25119Sig2018, ReferencedAuthentication } from './models/did'
import { ConnectionRepository } from './repository'

type Flavor<T, FlavorType> = T & { _type?: FlavorType }

type Did = Flavor<string, 'Did'>

/**
 * Connection states as defined in RFC 0160.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0023-did-exchange/README.md#state-machine-tables
 */
const enum DidExchangeState {
  Start = 'start',
  InvitationSent = 'invitation-sent',
  InvitationReceived = 'invitation-received',
  RequestSent = 'request-sent',
  RequestReceived = 'request-received',
  ResponseSent = 'response-sent',
  ResponseReceived = 'response-received',
  Abandoned = 'abandoned',
  Completed = 'completed',
}

const enum DidExchangeRole {
  Requester = 'Requester',
  Responder = 'Responder',
}

interface DidExchangeRequestParams {
  label: string
  goal?: string
  goalCode?: string
  routing: Routing
}

interface DidExchangeProtocolMessageWithRecord<MessageType extends AgentMessage> {
  message: MessageType
  connectionRecord: ConnectionRecord
}

// create
// validate connection record role, state and protocol (connection vs. did-exchange)
// create message
// update state

// process
// validate connection record role, state and protocol (connection vs. did-exchange)
// process message
// update connection record (emit update event)

// get and find methods should be part of service for now and in the future

class DidExchangeStateMachine {
  private outboundStateRules = [
    {
      outbound: DidExchangeRequestMessage.type,
      state: DidExchangeState.InvitationSent,
      role: DidExchangeRole.Requester,
    },
  ]

  private inboundStateRules = [
    {
      inbound: DidExchangeRequestMessage.type,
      state: DidExchangeState.InvitationSent,
      role: DidExchangeRole.Requester,
    },
  ]
  // public assertState(connectionRecord, inboundMessageType) {}
  // public assertTransition(connectionRecord, outboundMessageType) {}
  // public updateState(connectionRecord, message) {}
}

@scoped(Lifecycle.ContainerScoped)
export class DidExchangeProtocol {
  private wallet: Wallet
  private config: AgentConfig
  private connectionRepository: ConnectionRepository
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    config: AgentConfig,
    connectionRepository: ConnectionRepository,
    eventEmitter: EventEmitter
  ) {
    this.wallet = wallet
    this.config = config
    this.connectionRepository = connectionRepository
    this.eventEmitter = eventEmitter
    this.logger = config.logger
  }

  public async createRequest(
    connectionRecord: ConnectionRecord,
    params: DidExchangeRequestParams
  ): Promise<DidExchangeRequestMessage> {
    // this.assertState()
    // this.assertRole()

    if (!connectionRecord.invitation) {
      throw new AriesFrameworkError('Connection invitation is missing.')
    }

    const { label, goal, goalCode, routing } = params
    const { did, verkey } = await this.createDid()
    const didDoc = this.createDidDoc(did, verkey, routing)
    const parentThreadId = connectionRecord.invitation?.id

    const message = new DidExchangeRequestMessage({ label, parentThreadId, did, didDoc, goal, goalCode })

    // this.assertTransition()
    // this.updateState()
    return message
  }

  public async processRequest(
    messageContext: InboundMessageContext<DidExchangeRequestMessage>,
    routing?: Routing
  ): Promise<ConnectionRecord> {
    // this.assertState()
    // this.assertRole()

    const { connection: connectionRecord, message } = messageContext

    if (!connectionRecord) {
      throw new AriesFrameworkError('No connection record in message context.')
    }

    // check corresponding invitation ID is the request's ~thread.pthid

    if (connectionRecord.invitation?.id !== message.thread?.parentThreadId) {
      throw new ProblemReportError('Missing reference to invitation.', { problemCode: 'request_not_accepted' })
    }

    // If the responder wishes to continue the exchange, they will persist the received information in their wallet.

    connectionRecord.theirDid = message.did
    connectionRecord.theirDidDoc = message.didDoc?.data.getDataAsJson()
    connectionRecord.theirLabel = message.label
    connectionRecord.threadId = message.id

    // this.assertTransition()
    // this.updateState()

    return connectionRecord
  }

  public async createResponse(connectionRecord: ConnectionRecord): Promise<DidExchangeResponseMessage> {
    // this.assertState()
    // this.assertRole()

    // They will then either update the provisional service information to rotate the key, or provision a new DID entirely.
    // The choice here will depend on the nature of the DID used in the invitation.

    // if reuse did from invitation then do ...
    // otherwise create new did and didDoc
    const { did, didDoc, threadId } = connectionRecord

    if (!threadId) {
      throw new AriesFrameworkError('Missing threadId on connection record.')
    }

    // The responder will then craft an exchange response using the newly updated or provisioned information.
    const message = new DidExchangeResponseMessage({ did, didDoc, threadId })

    // Sign message attachment
    // Use invitationKey by default, fall back to verkey (?)

    // this.assertTransition()
    // this.updateState()

    return message
  }

  public async processResponse(
    messageContext: InboundMessageContext<DidExchangeResponseMessage>
  ): Promise<ConnectionRecord> {
    const { connection: connectionRecord, message } = messageContext

    // this.assertState()
    // this.assertRole()

    if (!connectionRecord) {
      throw new AriesFrameworkError('No connection record in message context.')
    }

    connectionRecord.theirDid = message.did
    connectionRecord.theirDidDoc = message.didDoc?.data.getDataAsJson()

    // verify signerVerkey === invitationKey

    // this.assertTransition()
    // this.updateState()

    return connectionRecord
  }

  public async createComplete(connectionRecord: ConnectionRecord): Promise<DidExchangeCompleteMessage> {
    // this.assertState(connectionRecord, DidExchangeCompleteMessage)
    // this.assertRole()

    const threadId = connectionRecord.threadId
    const parentThreadId = connectionRecord.invitation?.id

    if (!threadId) {
      throw new AriesFrameworkError(`Connection record ${connectionRecord.id} does not have 'threadId' attribute.`)
    }

    if (!parentThreadId) {
      throw new AriesFrameworkError(
        `Connection record ${connectionRecord.id} does not have 'parentThreadId' attribute.`
      )
    }

    const message = new DidExchangeCompleteMessage({ threadId, parentThreadId })

    // this.assertTransition()
    // this.updateState()

    return message
  }

  public async processComplete(
    messageContext: InboundMessageContext<DidExchangeResponseMessage>
  ): Promise<ConnectionRecord> {
    const { connection: connectionRecord, message } = messageContext
    // this.assertState(connectionRecord, DidExchangeCompleteMessage)
    // this.assertRole()

    if (!connectionRecord) {
      throw new AriesFrameworkError('No connection record in message context.')
    }

    // this.assertTransition()
    // this.updateState()
    return connectionRecord
  }

  private async createDid(): Promise<{ did: string; verkey: string }> {
    const { did, verkey } = await this.wallet.createDid()
    return { did, verkey }
  }

  private createDidDoc(did: Did, verkey: string, routing: Routing) {
    const publicKey = new Ed25119Sig2018({
      id: `${did}#1`,
      controller: did,
      publicKeyBase58: verkey,
    })

    const { endpoints, routingKeys } = routing
    // IndyAgentService is old service type
    const services = endpoints.map(
      (endpoint, index) =>
        new DidCommService({
          id: `${did}#IndyAgentService`,
          serviceEndpoint: endpoint,
          recipientKeys: [verkey],
          routingKeys: routingKeys,
          // Order of endpoint determines priority
          priority: index,
        })
    )

    // TODO: abstract the second parameter for ReferencedAuthentication away. This can be
    // inferred from the publicKey class instance
    const auth = new ReferencedAuthentication(publicKey, authenticationTypes[publicKey.type])

    const didDoc = new DidDoc({
      id: did,
      authentication: [auth],
      service: services,
      publicKey: [publicKey],
    })

    return didDoc
  }
}
