import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { Logger } from '../../logger'
import type { OutOfBandRecord } from '../oob/repository'
import type { ConnectionRecord } from './repository'
import type { Routing } from './services/ConnectionService'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { KeyType } from '../../crypto'
import { JwsService } from '../../crypto/JwsService'
import { Attachment, AttachmentData } from '../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../error'
import { JsonEncoder } from '../../utils/JsonEncoder'
import { JsonTransformer } from '../../utils/JsonTransformer'
import { DidCommService, DidDocument, Key } from '../dids'
import { DidDocumentRole } from '../dids/domain/DidDocumentRole'
import { createDidDocumentFromServices } from '../dids/domain/createPeerDidFromServices'
import { getKeyDidMappingByVerificationMethod } from '../dids/domain/key-type'
import { DidKey } from '../dids/methods/key/DidKey'
import { DidPeer, PeerDidNumAlgo } from '../dids/methods/peer/DidPeer'
import { DidRecord, DidRepository } from '../dids/repository'

import { DidExchangeStateMachine } from './DidExchangeStateMachine'
import { DidExchangeProblemReportError, DidExchangeProblemReportReason } from './errors'
import { DidExchangeCompleteMessage } from './messages/DidExchangeCompleteMessage'
import { DidExchangeRequestMessage } from './messages/DidExchangeRequestMessage'
import { DidExchangeResponseMessage } from './messages/DidExchangeResponseMessage'
import { HandshakeProtocol, DidExchangeRole, DidExchangeState } from './models'
import { ConnectionService } from './services'

interface DidExchangeRequestParams {
  label?: string
  alias?: string
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
  private didRepository: DidRepository
  private logger: Logger

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
    outOfBandRecord: OutOfBandRecord,
    params: DidExchangeRequestParams
  ): Promise<{ message: DidExchangeRequestMessage; connectionRecord: ConnectionRecord }> {
    this.logger.debug(`Create message ${DidExchangeRequestMessage.type} start`, { outOfBandRecord, params })

    const { outOfBandMessage } = outOfBandRecord
    const { alias, goal, goalCode, routing, autoAcceptConnection } = params

    const { did, mediatorId } = routing

    // TODO: We should store only one did that we'll use to send the request message with success.
    // We take just the first one for now.
    const [invitationDid] = outOfBandMessage.invitationDids

    const connectionRecord = await this.connectionService.createConnection({
      protocol: HandshakeProtocol.DidExchange,
      role: DidExchangeRole.Requester,
      alias,
      state: DidExchangeState.InvitationReceived,
      theirLabel: outOfBandMessage.label,
      multiUseInvitation: false,
      did,
      mediatorId,
      autoAcceptConnection: outOfBandRecord.autoAcceptConnection,
      outOfBandId: outOfBandRecord.id,
      invitationDid,
    })

    DidExchangeStateMachine.assertCreateMessageState(DidExchangeRequestMessage.type, connectionRecord)

    // Create message
    const label = params.label ?? this.config.label
    const { verkey } = routing
    const { peerDid, didDocument } = await this.createPeerDidDoc(this.routingToServices(routing))
    const parentThreadId = outOfBandMessage.id

    const message = new DidExchangeRequestMessage({ label, parentThreadId, did: peerDid.did, goal, goalCode })

    // Create sign attachment containing didDoc
    if (peerDid.numAlgo === PeerDidNumAlgo.GenesisDoc) {
      const didDocAttach = await this.createSignedAttachment(didDocument, [verkey])
      message.didDoc = didDocAttach
    }

    connectionRecord.did = peerDid.did
    connectionRecord.threadId = message.id

    if (autoAcceptConnection !== undefined || autoAcceptConnection !== null) {
      connectionRecord.autoAcceptConnection = autoAcceptConnection
    }

    await this.updateState(DidExchangeRequestMessage.type, connectionRecord)
    this.logger.debug(`Create message ${DidExchangeRequestMessage.type} end`, {
      connectionRecord,
      message,
    })
    return { message, connectionRecord }
  }

  public async processRequest(
    messageContext: InboundMessageContext<DidExchangeRequestMessage>,
    outOfBandRecord: OutOfBandRecord,
    routing?: Routing
  ): Promise<ConnectionRecord> {
    this.logger.debug(`Process message ${DidExchangeRequestMessage.type} start`, messageContext)

    // TODO check oob role is sender
    // TODO check oob state is await-respons
    // TODO check there is no connection record for particular oob record

    const { did, mediatorId } = routing ? routing : outOfBandRecord
    if (!did) {
      throw new AriesFrameworkError('Out-of-band record does not have did attribute.')
    }

    const { message } = messageContext

    // Check corresponding invitation ID is the request's ~thread.pthid
    // TODO Maybe we can do it in handler, but that actually does not make sense because we try to find oob by parent thread ID there.
    if (!message.thread?.parentThreadId || message.thread?.parentThreadId !== outOfBandRecord.getTags().messageId) {
      throw new DidExchangeProblemReportError('Missing reference to invitation.', {
        problemCode: DidExchangeProblemReportReason.RequestNotAccepted,
      })
    }

    // If the responder wishes to continue the exchange, they will persist the received information in their wallet.

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

    const didDocument = await this.extractDidDocument(message)
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

    this.logger.debug('Saving DID record', {
      id: didRecord.id,
      role: didRecord.role,
      tags: didRecord.getTags(),
      didDocument: 'omitted...',
    })

    await this.didRepository.save(didRecord)

    const connectionRecord = await this.connectionService.createConnection({
      protocol: HandshakeProtocol.DidExchange,
      role: DidExchangeRole.Responder,
      state: DidExchangeState.RequestReceived,
      multiUseInvitation: false,
      did,
      mediatorId,
      autoAcceptConnection: outOfBandRecord.autoAcceptConnection,
      outOfBandId: outOfBandRecord.id,
    })
    connectionRecord.theirDid = message.did
    connectionRecord.theirLabel = message.label
    connectionRecord.threadId = message.threadId || message.id

    await this.updateState(DidExchangeRequestMessage.type, connectionRecord)
    this.logger.debug(`Process message ${DidExchangeRequestMessage.type} end`, connectionRecord)
    return connectionRecord
  }

  public async createResponse(
    connectionRecord: ConnectionRecord,
    outOfBandRecord: OutOfBandRecord,
    routing?: Routing
  ): Promise<DidExchangeResponseMessage> {
    this.logger.debug(`Create message ${DidExchangeResponseMessage.type} start`, connectionRecord)
    DidExchangeStateMachine.assertCreateMessageState(DidExchangeResponseMessage.type, connectionRecord)

    const { did } = routing ? routing : outOfBandRecord
    if (!did) {
      throw new AriesFrameworkError('Out-of-band record does not have did attribute.')
    }

    const { threadId } = connectionRecord

    if (!threadId) {
      throw new AriesFrameworkError('Missing threadId on connection record.')
    }

    const services = routing
      ? this.routingToServices(routing)
      : (outOfBandRecord?.outOfBandMessage.services as DidCommService[])

    const { peerDid, didDocument } = await this.createPeerDidDoc(services)
    const message = new DidExchangeResponseMessage({ did: peerDid.did, threadId })

    if (peerDid.numAlgo === PeerDidNumAlgo.GenesisDoc) {
      const didDocAttach = await this.createSignedAttachment(
        didDocument,
        Array.from(new Set(services.map((s) => s.recipientKeys).reduce((acc, curr) => acc.concat(curr), [])))
      )
      message.didDoc = didDocAttach
    }

    connectionRecord.did = peerDid.did

    await this.updateState(DidExchangeResponseMessage.type, connectionRecord)
    this.logger.debug(`Create message ${DidExchangeResponseMessage.type} end`, { connectionRecord, message })
    return message
  }

  public async processResponse(
    messageContext: InboundMessageContext<DidExchangeResponseMessage>,
    outOfBandRecord: OutOfBandRecord
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

    const didDocument = await this.extractDidDocument(message, outOfBandRecord.getRecipientKeys())
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

    this.logger.debug('Saving DID record', {
      id: didRecord.id,
      role: didRecord.role,
      tags: didRecord.getTags(),
      didDocument: 'omitted...',
    })

    await this.didRepository.save(didRecord)

    connectionRecord.theirDid = message.did

    await this.updateState(DidExchangeResponseMessage.type, connectionRecord)
    this.logger.debug(`Process message ${DidExchangeResponseMessage.type} end`, connectionRecord)
    return connectionRecord
  }

  public async createComplete(
    connectionRecord: ConnectionRecord,
    outOfBandRecord: OutOfBandRecord
  ): Promise<DidExchangeCompleteMessage> {
    this.logger.debug(`Create message ${DidExchangeCompleteMessage.type} start`, connectionRecord)
    DidExchangeStateMachine.assertCreateMessageState(DidExchangeCompleteMessage.type, connectionRecord)

    const threadId = connectionRecord.threadId
    const parentThreadId = outOfBandRecord.outOfBandMessage.id

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
    messageContext: InboundMessageContext<DidExchangeCompleteMessage>,
    outOfBandRecord: OutOfBandRecord
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

    if (!message.thread?.parentThreadId || message.thread?.parentThreadId !== outOfBandRecord.getTags().messageId) {
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

  private async createPeerDidDoc(services: DidCommService[]) {
    const didDocument = createDidDocumentFromServices(services)
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

    this.logger.debug('Saving DID record', {
      id: didRecord.id,
      role: didRecord.role,
      tags: didRecord.getTags(),
      didDocument: 'omitted...',
    })

    await this.didRepository.save(didRecord)
    this.logger.debug('Did record created.', didRecord)
    return { peerDid, didDocument }
  }

  private async createSignedAttachment(didDoc: DidDocument, verkeys: string[]) {
    const didDocAttach = new Attachment({
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(didDoc),
      }),
    })

    await Promise.all(
      verkeys.map(async (verkey) => {
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
      })
    )

    return didDocAttach
  }

  /**
   * Extracts DID document as is from reqeust or response message attachment and verifies its signature.
   *
   * @param message DID request or DID response message
   * @param invitationKeys array containing keys from connection invitation that could be used for signing of DID document
   * @returns verified DID document content from message attachment
   */
  private async extractDidDocument(
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

  private routingToServices(routing: Routing) {
    return routing.endpoints.map((endpoint, index) => {
      return new DidCommService({
        id: `#inline-${index}`,
        priority: 0,
        serviceEndpoint: endpoint,
        recipientKeys: [routing.verkey],
        routingKeys: routing.routingKeys,
      })
    })
  }
}
