import type { AgentMessage } from '../../agent/AgentMessage'
import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { Logger } from '../../logger'
import type { ConnectionRecord } from './repository'
import type { Routing } from './services/ConnectionService'

import { convertPublicKeyToX25519 } from '@stablelib/ed25519'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { EventEmitter } from '../../agent/EventEmitter'
import { InjectionSymbols } from '../../constants'
import { KeyType } from '../../crypto'
import { JwsService } from '../../crypto/JwsService'
import { Attachment, AttachmentData } from '../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../error'
import { JsonEncoder } from '../../utils/JsonEncoder'
import { JsonTransformer } from '../../utils/JsonTransformer'
import { uuid } from '../../utils/uuid'
import { Wallet } from '../../wallet/Wallet'
import { DidCommService, DidDocumentBuilder, Key } from '../dids'
import { DidDocumentRole } from '../dids/domain/DidDocumentRole'
import { getEd25519VerificationMethod } from '../dids/domain/key-type/ed25519'
import { getX25519VerificationMethod } from '../dids/domain/key-type/x25519'
import { DidKey } from '../dids/methods/key/DidKey'
import { DidPeer, PeerDidNumAlgo } from '../dids/methods/peer/DidPeer'
import { DidRecord, DidRepository } from '../dids/repository'
import { ProblemReportError } from '../problem-reports'

import { DidExchangeCompleteMessage } from './messages/DidExchangeCompleteMessage'
import { DidExchangeRequestMessage } from './messages/DidExchangeRequestMessage'
import { DidExchangeResponseMessage } from './messages/DidExchangeResponseMessage'
import { DidExchangeState, DidExchangeRole } from './models'
import { authenticationTypes, DidDoc, Ed25119Sig2018, EmbeddedAuthentication } from './models/did'
import { ConnectionService } from './services'

type Flavor<T, FlavorType> = T & { _type?: FlavorType }

type Did = Flavor<string, 'Did'>

interface DidExchangeRequestParams {
  label?: string
  goal?: string
  goalCode?: string
  routing: Routing
  autoAcceptConnection?: boolean
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
      nextState: DidExchangeState.RequestReceived,
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
      throw new AriesFrameworkError(
        `Record with role ${record.role} is in invalid state ${record.state} to create ${messageType}. Expected state for role ${rule.role} is ${rule.state}.`
      )
    }
  }

  public static assertProcessMessageState(messageType: string, record: ConnectionRecord) {
    const rule = this.processMessageStateRules.find((r) => r.message === messageType)
    if (!rule) {
      throw new AriesFrameworkError(`Could not find create message rule for ${messageType}`)
    }
    if (rule.state !== record.state || rule.role !== record.role) {
      throw new AriesFrameworkError(
        `Record with role ${record.role} is in invalid state ${record.state} to process ${messageType}. Expected state for role ${rule.role} is ${rule.state}.`
      )
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
  private didRepository: DidRepository

  public constructor(
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    config: AgentConfig,
    connectionService: ConnectionService,
    didRepository: DidRepository,
    jwsService: JwsService,
    eventEmitter: EventEmitter
  ) {
    this.wallet = wallet
    this.config = config
    this.connectionService = connectionService
    this.didRepository = didRepository
    this.jwsService = jwsService
    this.eventEmitter = eventEmitter
    this.logger = config.logger
  }

  public async createRequest(
    connectionRecord: ConnectionRecord,
    params: DidExchangeRequestParams
  ): Promise<DidExchangeRequestMessage> {
    this.logger.debug(`Create message ${DidExchangeRequestMessage.type} start`, connectionRecord)

    if (!connectionRecord.invitation) {
      throw new AriesFrameworkError('Connection invitation is missing.')
    }

    DidExchangeStateMachine.assertCreateMessageState(DidExchangeRequestMessage.type, connectionRecord)

    const { goal, goalCode, routing, autoAcceptConnection } = params
    const label = params.label ?? this.config.label
    const { did, verkey } = routing
    const didDoc = this.createDidDoc(did, verkey, routing)
    await this.createPeerDidDoc(did, verkey, routing)
    const parentThreadId = connectionRecord.invitation?.id

    const message = new DidExchangeRequestMessage({ label, parentThreadId, did, goal, goalCode })

    // Create sign attachment containing didDoc
    const didDocAttach = await this.createSignedAttachment(didDoc, verkey)
    message.didDoc = didDocAttach

    connectionRecord.did = did
    connectionRecord.didDoc = didDoc
    connectionRecord.verkey = verkey
    connectionRecord.threadId = message.id

    if (autoAcceptConnection !== undefined || autoAcceptConnection !== null) {
      connectionRecord.autoAcceptConnection = autoAcceptConnection
    }

    await this.updateState(DidExchangeRequestMessage.type, connectionRecord)
    this.logger.debug(`Create message ${DidExchangeRequestMessage.type} end`, {
      connectionRecord,
      message,
    })
    return message
  }

  public async processRequest(
    messageContext: InboundMessageContext<DidExchangeRequestMessage>,
    routing?: Routing
  ): Promise<ConnectionRecord> {
    this.logger.debug(`Process message ${DidExchangeRequestMessage.type} start`, messageContext)

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

    // Create new connection if using a multi use invitation
    if (connectionRecord.multiUseInvitation) {
      if (!routing) {
        throw new AriesFrameworkError(
          'Cannot process request for multi-use invitation without routing object. Make sure to call processRequest with the routing parameter provided.'
        )
      }

      connectionRecord = await this.connectionService.createConnection({
        role: connectionRecord.role,
        state: connectionRecord.state,
        multiUseInvitation: false,
        routing,
        autoAcceptConnection: connectionRecord.autoAcceptConnection,
        invitation: connectionRecord.invitation,
        tags: connectionRecord.getTags(),
        protocol: 'did-exchange',
      })
    }

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
    this.logger.debug(`Process message ${DidExchangeRequestMessage.type} end`, connectionRecord)
    return connectionRecord
  }

  public async createResponse(connectionRecord: ConnectionRecord): Promise<DidExchangeResponseMessage> {
    this.logger.debug(`Create message ${DidExchangeResponseMessage.type} start`, connectionRecord)
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
    this.logger.debug(`Create message ${DidExchangeResponseMessage.type} end`, { connectionRecord, message })
    return message
  }

  public async processResponse(
    messageContext: InboundMessageContext<DidExchangeResponseMessage>
  ): Promise<ConnectionRecord> {
    this.logger.debug(`Process message ${DidExchangeResponseMessage.type} start`, messageContext)
    const { connection: connectionRecord, message } = messageContext

    if (!connectionRecord) {
      throw new AriesFrameworkError('No connection record in message context.')
    }

    DidExchangeStateMachine.assertProcessMessageState(DidExchangeResponseMessage.type, connectionRecord)

    // verify signerVerkey === invitationKey
    if (message.didDoc) {
      // Verify signature on DidDoc attachment and assign DidDoc to connection record
      await this.verifyAttachmentSignature(message.didDoc, connectionRecord.invitation?.recipientKeys)
      const didDoc = JsonTransformer.fromJSON(message.didDoc.getDataAsJson(), DidDoc)
      connectionRecord.theirDidDoc = didDoc
    }

    connectionRecord.theirDid = message.did

    await this.updateState(DidExchangeResponseMessage.type, connectionRecord)
    this.logger.debug(`Process message ${DidExchangeResponseMessage.type} end`, connectionRecord)
    return connectionRecord
  }

  public async createComplete(connectionRecord: ConnectionRecord): Promise<DidExchangeCompleteMessage> {
    this.logger.debug(`Create message ${DidExchangeCompleteMessage.type} start`, connectionRecord)
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
    this.logger.debug(`Create message ${DidExchangeCompleteMessage.type} end`, { connectionRecord, message })
    return message
  }

  public async processComplete(
    messageContext: InboundMessageContext<DidExchangeCompleteMessage>
  ): Promise<ConnectionRecord> {
    this.logger.debug(`Process message ${DidExchangeCompleteMessage.type} start`, messageContext)
    const { connection: connectionRecord, message } = messageContext

    if (!connectionRecord) {
      throw new AriesFrameworkError('No connection record in message context.')
    }

    DidExchangeStateMachine.assertProcessMessageState(DidExchangeCompleteMessage.type, connectionRecord)

    if (connectionRecord.invitation?.id !== message.thread?.parentThreadId) {
      throw new ProblemReportError('Missing reference to invitation.', { problemCode: 'request_not_accepted' })
    }

    await this.updateState(DidExchangeCompleteMessage.type, connectionRecord)
    this.logger.debug(`Process message ${DidExchangeCompleteMessage.type} end`, { connectionRecord })
    return connectionRecord
  }

  private async updateState(messageType: string, connectionRecord: ConnectionRecord) {
    const nextState = DidExchangeStateMachine.nextState(messageType, connectionRecord)
    return this.connectionService.updateState(connectionRecord, nextState)
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
    const auth = new EmbeddedAuthentication(publicKey)

    const didDoc = new DidDoc({
      id: did,
      authentication: [auth],
      service: services,
      publicKey: [publicKey],
    })

    return didDoc
  }

  private async createPeerDidDoc(did: Did, verkey: string, routing: Routing) {
    const publicKeyBase58 = verkey

    const ed25519Key = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)
    const x25519Key = Key.fromPublicKey(convertPublicKeyToX25519(ed25519Key.publicKey), KeyType.X25519)

    const ed25519VerificationMethod = getEd25519VerificationMethod({
      id: ed25519Key.publicKeyBase58.substring(0, 8),
      key: ed25519Key,
      // For peer dids generated with method 1, the controller MUST be #id as we don't know the did yet
      controller: '#id',
    })
    const x25519VerificationMethod = getX25519VerificationMethod({
      id: x25519Key.publicKeyBase58.substring(0, 8),
      key: x25519Key,
      // For peer dids generated with method 1, the controller MUST be #id as we don't know the did yet
      controller: '#id',
    })

    let mediatorRoutingKey
    if (routing.routingKeys.length > 0) {
      const [mediatorPublicKeyBase58] = routing.routingKeys
      const mediatorEd25519Key = Key.fromPublicKeyBase58(mediatorPublicKeyBase58, KeyType.Ed25519)
      const mediatorEd25519DidKey = new DidKey(mediatorEd25519Key)
      const mediatorX25519Key = Key.fromPublicKey(
        convertPublicKeyToX25519(mediatorEd25519Key.publicKey),
        KeyType.X25519
      )
      // Use ed25519 did:key, which also includes the x25519 key used for didcomm
      mediatorRoutingKey = `${mediatorEd25519DidKey.did}#${mediatorX25519Key.fingerprint}`
    }

    // TODO Iterate over all endpoints
    const [serviceEndpoint] = routing.endpoints
    const service = new DidCommService({
      id: '#service-0',
      // Fixme: can we use relative reference (#id) instead of absolute reference here (did:example:123#id)?
      // We don't know the did yet
      recipientKeys: [ed25519VerificationMethod.id],
      serviceEndpoint,
      accept: ['didcomm/aip2;env=rfc19'],
      // It is important that we encode the routing keys as key references.
      // So instead of using plain verkeys, we should encode them as did:key dids
      routingKeys: mediatorRoutingKey ? [mediatorRoutingKey] : [],
    })

    const didDocument = new DidDocumentBuilder('')
      .addAuthentication(ed25519VerificationMethod)
      .addKeyAgreement(x25519VerificationMethod)
      .addService(service)
      .build()

    const peerDid = DidPeer.fromDidDocument(didDocument, PeerDidNumAlgo.GenesisDoc)

    const didDocumentRecord = new DidRecord({
      id: uuid(),
      role: DidDocumentRole.Created,
      // It is important to take the did document from the PeerDid class
      // as it will have the id property
      didDocument: peerDid.didDocument,
    })

    await this.didRepository.save(didDocumentRecord)
  }

  private async createSignedAttachment(didDoc: DidDoc, verkey: string) {
    const didDocAttach = new Attachment({
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(didDoc),
      }),
    })

    const kid = Key.fromPublicKeyBase58(verkey, KeyType.Ed25519)
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

  private async verifyAttachmentSignature(didDocAttachment: Attachment, invitationKeys: string[] = []) {
    const jws = didDocAttachment.data.jws

    if (!jws) {
      throw new ProblemReportError('DidDoc signature is missing.', { problemCode: 'request_not_accepted' })
    }

    const json = didDocAttachment.getDataAsJson()
    const payload = JsonEncoder.toBuffer(json)
    // console.log('========== before fromJSON ==========', JSON.stringify(json, null, 2))
    const didDoc = JsonTransformer.fromJSON(json, DidDoc)
    // console.log('========== before verifyJws ==========', didDoc)
    const { isValid, signerVerkeys } = await this.jwsService.verifyJws({ jws, payload })

    const didDocKeys = didDoc.publicKey.map((pk) => pk.value).concat(invitationKeys)

    // console.log('========== after verifyJws ==========', { isValid, signerVerkeys, didDoc_publicKey: didDoc.publicKey })
    // console.log(
    //   '========== didDocKeys ==========',
    //   didDocKeys,
    //   signerVerkeys.length > 1,
    //   !signerVerkeys.every((verkey) => didDocKeys.includes(verkey))
    // )
    if (!isValid || signerVerkeys.length > 1 || !signerVerkeys.every((verkey) => didDocKeys.includes(verkey))) {
      throw new ProblemReportError('DidDoc signature is invalid.', { problemCode: 'request_not_accepted' })
    }
  }
}
