import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { Logger } from '../../logger'
import type { ConnectionRecord } from './repository'
import type { Routing } from './services/ConnectionService'

import { convertPublicKeyToX25519 } from '@stablelib/ed25519'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { KeyType } from '../../crypto'
import { JwsService } from '../../crypto/JwsService'
import { Attachment, AttachmentData } from '../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../error'
import { JsonEncoder } from '../../utils/JsonEncoder'
import { JsonTransformer } from '../../utils/JsonTransformer'
import { uuid } from '../../utils/uuid'
import { DidCommService, DidDocument, DidDocumentBuilder, Key } from '../dids'
import { DidDocumentRole } from '../dids/domain/DidDocumentRole'
import { getKeyDidMappingByVerificationMethod } from '../dids/domain/key-type'
import { getEd25519VerificationMethod } from '../dids/domain/key-type/ed25519'
import { getX25519VerificationMethod } from '../dids/domain/key-type/x25519'
import { DidKey } from '../dids/methods/key/DidKey'
import { DidPeer, PeerDidNumAlgo } from '../dids/methods/peer/DidPeer'
import { DidRecord, DidRepository } from '../dids/repository'

import { DidExchangeStateMachine } from './DidExchangeStateMachine'
import { DidExchangeProblemReportError, DidExchangeProblemReportReason } from './errors'
import { DidExchangeCompleteMessage } from './messages/DidExchangeCompleteMessage'
import { DidExchangeRequestMessage } from './messages/DidExchangeRequestMessage'
import { DidExchangeResponseMessage } from './messages/DidExchangeResponseMessage'
import { HandshakeProtocol } from './models'
import { ConnectionService } from './services'

interface DidExchangeRequestParams {
  label?: string
  goal?: string
  goalCode?: string
  routing: Routing
  autoAcceptConnection?: boolean
}

@scoped(Lifecycle.ContainerScoped)
export class DidExchangeProtocol {
  private config: AgentConfig
  private connectionService: ConnectionService
  private jwsService: JwsService
  private logger: Logger
  private didRepository: DidRepository

  public constructor(
    config: AgentConfig,
    connectionService: ConnectionService,
    didRepository: DidRepository,
    jwsService: JwsService
  ) {
    this.config = config
    this.connectionService = connectionService
    this.didRepository = didRepository
    this.jwsService = jwsService
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
    const { verkey } = routing
    const peerDid = await this.createPeerDidDoc(routing)
    const parentThreadId = connectionRecord.invitation?.id

    const message = new DidExchangeRequestMessage({ label, parentThreadId, did: peerDid.did, goal, goalCode })

    // Create sign attachment containing didDoc
    if (peerDid.numAlgo === PeerDidNumAlgo.GenesisDoc) {
      const didDocAttach = await this.createSignedAttachment(peerDid.didDocument, verkey)
      message.didDoc = didDocAttach
    }

    connectionRecord.did = peerDid.did
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
      throw new DidExchangeProblemReportError('Missing reference to invitation.', {
        problemCode: DidExchangeProblemReportReason.RequestNotAccepted,
      })
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
        protocol: connectionRecord.protocol,
      })
    }

    if (!message.did.startsWith('did:peer:')) {
      throw new DidExchangeProblemReportError(
        `Message contains unsupported did ${message.did}. Supported dids are [did:peer]`,
        {
          problemCode: DidExchangeProblemReportReason.RequestNotAccepted,
        }
      )
    }
    const peerDid = DidPeer.fromDid(message.did)
    if (peerDid.numAlgo !== PeerDidNumAlgo.GenesisDoc) {
      throw new DidExchangeProblemReportError(
        `Unsupported numalgo ${peerDid.numAlgo}. Supported numalgos are [${PeerDidNumAlgo.GenesisDoc}]`,
        {
          problemCode: DidExchangeProblemReportReason.RequestNotAccepted,
        }
      )
    }

    const didDocument = await this.resolveDidDocument(message)
    const didRecord = new DidRecord({
      id: message.did,
      role: DidDocumentRole.Received,
      // It is important to take the did document from the PeerDid class
      // as it will have the id property
      didDocument,
      tags: {
        // We need to save the recipientKeys, so we can find the associated did
        // of a key when we receive a message from another connection.
        recipientKeys: didDocument.recipientKeys,
      },
    })
    await this.didRepository.save(didRecord)

    connectionRecord.theirDid = message.did
    connectionRecord.theirLabel = message.label
    connectionRecord.threadId = message.threadId || message.id
    connectionRecord.protocol = HandshakeProtocol.DidExchange

    await this.updateState(DidExchangeRequestMessage.type, connectionRecord)
    this.logger.debug(`Process message ${DidExchangeRequestMessage.type} end`, connectionRecord)
    return connectionRecord
  }

  public async createResponse(
    connectionRecord: ConnectionRecord,
    routing?: Routing
  ): Promise<DidExchangeResponseMessage> {
    this.logger.debug(`Create message ${DidExchangeResponseMessage.type} start`, connectionRecord)
    DidExchangeStateMachine.assertCreateMessageState(DidExchangeResponseMessage.type, connectionRecord)

    const { did, threadId } = connectionRecord

    if (!threadId) {
      throw new AriesFrameworkError('Missing threadId on connection record.')
    }

    let peerDidRouting
    if (routing) {
      peerDidRouting = routing
    } else {
      const { serviceEndpoint, recipientKeys, routingKeys } = connectionRecord.invitation || {}
      if (serviceEndpoint && recipientKeys && routingKeys) {
        peerDidRouting = {
          endpoints: [serviceEndpoint],
          did,
          verkey: recipientKeys[0],
          routingKeys: routingKeys,
        }
      } else {
        throw new AriesFrameworkError(
          'Connection record does not have an invitation with serviceEndpoint, recipientKeys or routingKeys.'
        )
      }
    }

    const peerDid = await this.createPeerDidDoc(peerDidRouting)
    const message = new DidExchangeResponseMessage({ did: peerDid.did, threadId })

    if (peerDid.numAlgo === PeerDidNumAlgo.GenesisDoc) {
      const didDocAttach = await this.createSignedAttachment(peerDid.didDocument, peerDidRouting.verkey)
      message.didDoc = didDocAttach
    }

    connectionRecord.did = peerDid.did

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

    if (!message.thread?.threadId || message.thread?.threadId !== connectionRecord.threadId) {
      throw new DidExchangeProblemReportError('Invalid or missing thread ID.', {
        problemCode: DidExchangeProblemReportReason.ResponseNotAccepted,
      })
    }

    if (!message.did.startsWith('did:peer:')) {
      throw new DidExchangeProblemReportError(
        `Message contains unsupported did ${message.did}. Supported dids are [did:peer]`,
        {
          problemCode: DidExchangeProblemReportReason.ResponseNotAccepted,
        }
      )
    }
    const peerDid = DidPeer.fromDid(message.did)
    if (peerDid.numAlgo !== PeerDidNumAlgo.GenesisDoc) {
      throw new DidExchangeProblemReportError(
        `Unsupported numalgo ${peerDid.numAlgo}. Supported numalgos are [${PeerDidNumAlgo.GenesisDoc}]`,
        {
          problemCode: DidExchangeProblemReportReason.ResponseNotAccepted,
        }
      )
    }

    const didDocument = await this.resolveDidDocument(message, connectionRecord.invitation?.recipientKeys)
    const didRecord = new DidRecord({
      id: message.did,
      role: DidDocumentRole.Received,
      didDocument,
      tags: {
        // We need to save the recipientKeys, so we can find the associated did
        // of a key when we receive a message from another connection.
        recipientKeys: didDocument.recipientKeys,
      },
    })
    await this.didRepository.save(didRecord)

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

    if (!message.thread?.threadId || message.thread?.threadId !== connectionRecord.threadId) {
      throw new DidExchangeProblemReportError('Invalid or missing thread ID.', {
        problemCode: DidExchangeProblemReportReason.CompleteRejected,
      })
    }

    if (!message.thread?.parentThreadId || message.thread?.parentThreadId !== connectionRecord.invitation?.id) {
      throw new DidExchangeProblemReportError('Invalid or missing parent thread ID referencing to the invitation.', {
        problemCode: DidExchangeProblemReportReason.CompleteRejected,
      })
    }

    await this.updateState(DidExchangeCompleteMessage.type, connectionRecord)
    this.logger.debug(`Process message ${DidExchangeCompleteMessage.type} end`, { connectionRecord })
    return connectionRecord
  }

  private async updateState(messageType: string, connectionRecord: ConnectionRecord) {
    this.logger.debug(`Updating state`, { connectionRecord })
    const nextState = DidExchangeStateMachine.nextState(messageType, connectionRecord)
    return this.connectionService.updateState(connectionRecord, nextState)
  }

  private async createPeerDidDoc(routing: Routing) {
    const publicKeyBase58 = routing.verkey

    const ed25519Key = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)
    const x25519Key = Key.fromPublicKey(convertPublicKeyToX25519(ed25519Key.publicKey), KeyType.X25519)

    // For peer dids generated with method 1, the controller MUST be #id as we don't know the did yet
    const ed25519VerificationMethod = getEd25519VerificationMethod({
      id: uuid(),
      key: ed25519Key,
      controller: '#id',
    })
    const x25519VerificationMethod = getX25519VerificationMethod({
      id: uuid(),
      key: x25519Key,
      controller: '#id',
    })

    const didDocumentBuilder = new DidDocumentBuilder('')
      .addAuthentication(ed25519VerificationMethod)
      .addKeyAgreement(x25519VerificationMethod)

    const routingKeys = routing.routingKeys.map((routingKey) => {
      const mediatorEd25519Key = Key.fromPublicKeyBase58(routingKey, KeyType.Ed25519)
      const mediatorEd25519DidKey = new DidKey(mediatorEd25519Key)
      const mediatorX25519Key = Key.fromPublicKey(
        convertPublicKeyToX25519(mediatorEd25519Key.publicKey),
        KeyType.X25519
      )
      // Use ed25519 did:key, which also includes the x25519 key used for didcomm
      const mediatorRoutingKey = `${mediatorEd25519DidKey.did}#${mediatorX25519Key.fingerprint}`
      return mediatorRoutingKey
    })

    routing.endpoints.forEach((endpoint) => {
      const service = new DidCommService({
        id: '#service-0',
        // Fixme: can we use relative reference (#id) instead of absolute reference here (did:example:123#id)?
        // We don't know the did yet
        // TODO we should perhaps use keyAgreement instead of authentication key in here, then it must be changed also in connection record verkey
        recipientKeys: [ed25519Key.publicKeyBase58],
        serviceEndpoint: endpoint,
        accept: ['didcomm/aip2;env=rfc19'],
        // It is important that we encode the routing keys as key references.
        // So instead of using plain verkeys, we should encode them as did:key dids
        routingKeys,
      })
      didDocumentBuilder.addService(service)
    })

    const didDocument = didDocumentBuilder.build()

    const peerDid = DidPeer.fromDidDocument(didDocument, PeerDidNumAlgo.GenesisDoc)

    const didRecord = new DidRecord({
      id: peerDid.did,
      role: DidDocumentRole.Created,
      // It is important to take the did document from the PeerDid class
      // as it will have the id property
      didDocument: peerDid.numAlgo === PeerDidNumAlgo.GenesisDoc ? peerDid.didDocument : undefined,
      tags: {
        // We need to save the recipientKeys, so we can find the associated did
        // of a key when we receive a message from another connection.
        recipientKeys: peerDid.didDocument.recipientKeys,
      },
    })

    await this.didRepository.save(didRecord)
    this.logger.debug('Did record created.', didRecord)
    return peerDid
  }

  private async createSignedAttachment(didDoc: DidDocument, verkey: string) {
    const didDocAttach = new Attachment({
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(didDoc),
      }),
    })

    const key = Key.fromPublicKeyBase58(verkey, KeyType.Ed25519)
    const kid = new DidKey(key).did
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

  /**
   * Resolves DID document from reqeust or response message attachment and verifies its signature.
   *
   * @param message DID request or DID response message
   * @param invitationKeys array containing keys from connection invitation that could be used for signing of DID document
   * @returns resovled and verified DID document from message attachment
   */
  private async resolveDidDocument(
    message: DidExchangeRequestMessage | DidExchangeResponseMessage,
    invitationKeys: string[] = []
  ): Promise<DidDocument> {
    if (!message.didDoc) {
      const problemCode =
        message.type === DidExchangeRequestMessage.type
          ? DidExchangeProblemReportReason.RequestNotAccepted
          : DidExchangeProblemReportReason.ResponseNotAccepted
      throw new DidExchangeProblemReportError('DID Document attachment is missing.', { problemCode })
    }
    const didDocumentAttachment = message.didDoc
    const jws = didDocumentAttachment.data.jws

    if (!jws) {
      const problemCode =
        message.type === DidExchangeRequestMessage.type
          ? DidExchangeProblemReportReason.RequestNotAccepted
          : DidExchangeProblemReportReason.ResponseNotAccepted
      throw new DidExchangeProblemReportError('DID Document signature is missing.', { problemCode })
    }

    const json = didDocumentAttachment.getDataAsJson() as Record<string, unknown>
    this.logger.trace('DidDocument JSON', json)

    const payload = JsonEncoder.toBuffer(json)
    const { isValid, signerVerkeys } = await this.jwsService.verifyJws({ jws, payload })

    const didDocument = JsonTransformer.fromJSON(json, DidDocument)
    const didDocumentKeys = didDocument.authentication
      .map((authentication) => {
        const verificationMethod =
          typeof authentication === 'string' ? didDocument.dereferenceKey(authentication) : authentication
        const { getKeyFromVerificationMethod } = getKeyDidMappingByVerificationMethod(verificationMethod)
        const key = getKeyFromVerificationMethod(verificationMethod)
        return key.publicKeyBase58
      })
      .concat(invitationKeys)

    this.logger.trace('JWS verification result', { isValid, signerVerkeys, didDocumentKeys })

    if (!isValid || !signerVerkeys.every((verkey) => didDocumentKeys.includes(verkey))) {
      const problemCode =
        message.type === DidExchangeRequestMessage.type
          ? DidExchangeProblemReportReason.RequestNotAccepted
          : DidExchangeProblemReportReason.ResponseNotAccepted
      throw new DidExchangeProblemReportError('DID Document signature is invalid.', { problemCode })
    }

    return didDocument
  }
}
