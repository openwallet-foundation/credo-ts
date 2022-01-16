import type { AgentMessage } from '../../agent/AgentMessage'
import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { Logger } from '../../logger'
import type { ConnectionRecord } from './repository'
import type { Routing } from './services/ConnectionService'

import { EventEmitter } from 'stream'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { InjectionSymbols } from '../../constants'
import { JwsService } from '../../crypto/JwsService'
import { Attachment, AttachmentData } from '../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../error'
import { JsonEncoder } from '../../utils/JsonEncoder'
import { JsonTransformer } from '../../utils/JsonTransformer'
import { Wallet } from '../../wallet/Wallet'
import { DidKey, KeyType } from '../dids/domain/DidKey'
import { ProblemReportError } from '../problem-reports'

import { DidExchangeCompleteMessage } from './messages/DidExchangeCompleteMessage'
import { DidExchangeRequestMessage } from './messages/DidExchangeRequestMessage'
import { DidExchangeResponseMessage } from './messages/DidExchangeResponseMessage'
import { DidExchangeState, DidExchangeRole } from './models'
import { authenticationTypes, DidCommService, DidDoc, Ed25119Sig2018, ReferencedAuthentication } from './models/did'
import { ConnectionRepository } from './repository'
import { ConnectionService } from './services'

type Flavor<T, FlavorType> = T & { _type?: FlavorType }

type Did = Flavor<string, 'Did'>

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
  private static createMessageStateRules = [
    {
      message: DidExchangeRequestMessage.type,
      state: DidExchangeState.InvitationReceived,
      role: DidExchangeRole.Requester,
      nextState: DidExchangeState.RequestSent,
    },
    {
      message: DidExchangeResponseMessage.type,
      state: DidExchangeState.RequestReceived,
      role: DidExchangeRole.Responder,
      nextState: DidExchangeState.ResponseSent,
    },
    {
      message: DidExchangeCompleteMessage.type,
      state: DidExchangeState.ResponseReceived,
      role: DidExchangeRole.Requester,
      nextState: DidExchangeState.Completed,
    },
  ]

  private static processMessageStateRules = [
    {
      message: DidExchangeRequestMessage.type,
      state: DidExchangeState.InvitationSent,
      role: DidExchangeRole.Responder,
      nextState: DidExchangeState.RequestSent,
    },
    {
      message: DidExchangeResponseMessage.type,
      state: DidExchangeState.RequestSent,
      role: DidExchangeRole.Requester,
      nextState: DidExchangeState.ResponseReceived,
    },
    {
      message: DidExchangeCompleteMessage.type,
      state: DidExchangeState.ResponseSent,
      role: DidExchangeRole.Responder,
      nextState: DidExchangeState.Completed,
    },
  ]

  public static assertCreateMessageState(messageType: string, record: ConnectionRecord) {
    const rule = this.createMessageStateRules.find((r) => r.message === messageType)
    if (!rule) {
      throw new AriesFrameworkError(`Could not find create message rule for ${messageType}`)
    }
    if (rule.state !== record.state || rule.role !== record.role) {
      throw new AriesFrameworkError(`Record is in invalid state.`)
    }
  }

  public static assertProcessMessageState(messageType: string, record: ConnectionRecord) {
    const rule = this.processMessageStateRules.find((r) => r.message === messageType)
    if (!rule) {
      throw new AriesFrameworkError(`Could not find create message rule for ${messageType}`)
    }
    if (rule.state !== record.state || rule.role !== record.role) {
      throw new AriesFrameworkError(`Record is in invalid state.`)
    }
  }

  public static nextState(messageType: string, record: ConnectionRecord) {
    const rule = this.createMessageStateRules
      .concat(this.processMessageStateRules)
      .find((r) => r.message === messageType && r.role === record.role)
    if (!rule) {
      throw new AriesFrameworkError(`Could not find create message rule for ${messageType}`)
    }
    return rule.nextState
  }
}

@scoped(Lifecycle.ContainerScoped)
export class DidExchangeProtocol {
  private wallet: Wallet
  private config: AgentConfig
  private connectionService: ConnectionService
  private jwsService: JwsService
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    config: AgentConfig,
    connectionService: ConnectionService,
    jwsService: JwsService,
    eventEmitter: EventEmitter
  ) {
    this.wallet = wallet
    this.config = config
    this.connectionService = connectionService
    this.jwsService = jwsService
    this.eventEmitter = eventEmitter
    this.logger = config.logger
  }

  public async createRequest(
    connectionRecord: ConnectionRecord,
    params: DidExchangeRequestParams
  ): Promise<DidExchangeRequestMessage> {
    if (!connectionRecord.invitation) {
      throw new AriesFrameworkError('Connection invitation is missing.')
    }

    DidExchangeStateMachine.assertCreateMessageState(DidExchangeRequestMessage.type, connectionRecord)

    const { label, goal, goalCode, routing } = params
    const { did, verkey } = await this.createDid()
    const didDoc = this.createDidDoc(did, verkey, routing)
    const parentThreadId = connectionRecord.invitation?.id

    const message = new DidExchangeRequestMessage({ label, parentThreadId, did, goal, goalCode })

    // Create sign attachment containing didDoc
    const didDocAttach = await this.createSignedAttachment(didDoc, verkey)
    message.didDoc = didDocAttach

    await this.updateState(DidExchangeRequestMessage.type, connectionRecord)
    return message
  }

  public async processRequest(
    messageContext: InboundMessageContext<DidExchangeRequestMessage>,
    routing?: Routing
  ): Promise<ConnectionRecord> {
    // eslint-disable-next-line prefer-const
    let { connection: connectionRecord, message } = messageContext

    if (!connectionRecord) {
      throw new AriesFrameworkError('No connection record in message context.')
    }

    DidExchangeStateMachine.assertProcessMessageState(DidExchangeRequestMessage.type, connectionRecord)

    // check corresponding invitation ID is the request's ~thread.pthid

    if (connectionRecord.invitation?.id !== message.thread?.parentThreadId) {
      throw new ProblemReportError('Missing reference to invitation.', { problemCode: 'request_not_accepted' })
    }

    // If the responder wishes to continue the exchange, they will persist the received information in their wallet.

    if (message.didDoc) {
      // Verify signature on DidDoc attachment and assign DidDoc to connection record
      await this.verifyAttachmentSignature(message.didDoc)
      const didDoc = JsonTransformer.fromJSON(message.didDoc.getDataAsJson(), DidDoc)
      connectionRecord.theirDidDoc = didDoc
    }

    connectionRecord.theirDid = message.did
    connectionRecord.theirLabel = message.label
    connectionRecord.threadId = message.id

    await this.updateState(DidExchangeRequestMessage.type, connectionRecord)
    return connectionRecord
  }

  public async createResponse(connectionRecord: ConnectionRecord): Promise<DidExchangeResponseMessage> {
    DidExchangeStateMachine.assertCreateMessageState(DidExchangeResponseMessage.type, connectionRecord)

    // They will then either update the provisional service information to rotate the key, or provision a new DID entirely.
    // The choice here will depend on the nature of the DID used in the invitation.

    // if reuse did from invitation then do ...
    // otherwise create new did and didDoc
    const { did, didDoc, threadId } = connectionRecord

    if (!threadId) {
      throw new AriesFrameworkError('Missing threadId on connection record.')
    }

    // The responder will then craft an exchange response using the newly updated or provisioned information.
    const message = new DidExchangeResponseMessage({ did, threadId })

    // Sign message attachment
    // Use invitationKey by default, fall back to verkey (?)
    const [verkey] = connectionRecord.invitation?.recipientKeys || []

    if (!verkey) {
      throw new AriesFrameworkError('Connection invitation does not contain recipient key.')
    }

    const didDocAttach = await this.createSignedAttachment(didDoc, verkey)
    message.didDoc = didDocAttach

    await this.updateState(DidExchangeResponseMessage.type, connectionRecord)
    return message
  }

  public async processResponse(
    messageContext: InboundMessageContext<DidExchangeResponseMessage>
  ): Promise<ConnectionRecord> {
    const { connection: connectionRecord, message } = messageContext

    if (!connectionRecord) {
      throw new AriesFrameworkError('No connection record in message context.')
    }

    DidExchangeStateMachine.assertProcessMessageState(DidExchangeResponseMessage.type, connectionRecord)

    // verify signerVerkey === invitationKey
    if (message.didDoc) {
      // Verify signature on DidDoc attachment and assign DidDoc to connection record
      await this.verifyAttachmentSignature(message.didDoc)
      const didDoc = JsonTransformer.fromJSON(message.didDoc.getDataAsJson(), DidDoc)
      connectionRecord.theirDidDoc = didDoc
    }

    connectionRecord.theirDid = message.did

    await this.updateState(DidExchangeResponseMessage.type, connectionRecord)
    return connectionRecord
  }

  public async createComplete(connectionRecord: ConnectionRecord): Promise<DidExchangeCompleteMessage> {
    DidExchangeStateMachine.assertCreateMessageState(DidExchangeCompleteMessage.type, connectionRecord)

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

    await this.updateState(DidExchangeCompleteMessage.type, connectionRecord)
    return message
  }

  public async processComplete(
    messageContext: InboundMessageContext<DidExchangeCompleteMessage>
  ): Promise<ConnectionRecord> {
    const { connection: connectionRecord, message } = messageContext

    if (!connectionRecord) {
      throw new AriesFrameworkError('No connection record in message context.')
    }

    DidExchangeStateMachine.assertProcessMessageState(DidExchangeResponseMessage.type, connectionRecord)

    if (connectionRecord.invitation?.id !== message.thread?.parentThreadId) {
      throw new ProblemReportError('Missing reference to invitation.', { problemCode: 'request_not_accepted' })
    }

    await this.updateState(DidExchangeCompleteMessage.type, connectionRecord)
    return connectionRecord
  }

  private async updateState(messageType: string, connectionRecord: ConnectionRecord) {
    const nextState = DidExchangeStateMachine.nextState(messageType, connectionRecord)
    return this.connectionService.updateState(connectionRecord, nextState)
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

  private async createSignedAttachment(didDoc: DidDoc, verkey: string) {
    const didDocAttach = new Attachment({
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(didDoc),
      }),
    })

    const kid = DidKey.fromPublicKeyBase58(verkey, KeyType.ED25519)
    const payload = JsonEncoder.toBuffer(didDoc)

    const jws = await this.jwsService.createJws({
      payload,
      verkey,
      header: {
        kid,
      },
    })

    didDocAttach.addJws(jws)
    return didDocAttach
  }

  private async verifyAttachmentSignature(didDocAttachment: Attachment) {
    const jws = didDocAttachment?.data.jws

    if (!jws) {
      throw new ProblemReportError('DidDoc signature is missing.', { problemCode: 'request_not_accepted' })
    }

    const payload = JsonEncoder.toBuffer(didDocAttachment?.getDataAsJson())
    const didDoc = JsonTransformer.fromJSON(didDocAttachment.getDataAsJson(), DidDoc)
    const { isValid, signerVerkeys } = await this.jwsService.verifyJws({ jws, payload })

    if (
      !isValid ||
      !(signerVerkeys.length > 1) ||
      !signerVerkeys.every((verkey) => didDoc.publicKey.map((pk) => pk.value).includes(verkey))
    ) {
      throw new ProblemReportError('DidDoc signature is invalid.', { problemCode: 'request_not_accepted' })
    }
  }
}
