import type { ConnectionRecord } from './repository'
import type { Routing } from './services/ConnectionService'
import type { AgentContext } from '../../agent'
import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { ParsedMessageType } from '../../utils/messageType'
import type { ResolvedDidCommService } from '../didcomm'
import type { PeerDidCreateOptions } from '../dids'
import type { OutOfBandRecord } from '../oob/repository'

import { InjectionSymbols } from '../../constants'
import { Key, KeyType } from '../../crypto'
import { JwsService } from '../../crypto/JwsService'
import { Attachment, AttachmentData } from '../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../error'
import { Logger } from '../../logger'
import { inject, injectable } from '../../plugins'
import { JsonEncoder } from '../../utils/JsonEncoder'
import { JsonTransformer } from '../../utils/JsonTransformer'
import {
  DidDocument,
  DidRegistrarService,
  DidDocumentRole,
  createPeerDidDocumentFromServices,
  DidKey,
  getNumAlgoFromPeerDid,
  PeerDidNumAlgo,
} from '../dids'
import { getKeyFromVerificationMethod } from '../dids/domain/key-type'
import { tryParseDid } from '../dids/domain/parse'
import { didKeyToInstanceOfKey } from '../dids/helpers'
import { DidRecord, DidRepository } from '../dids/repository'
import { OutOfBandRole } from '../oob/domain/OutOfBandRole'
import { OutOfBandState } from '../oob/domain/OutOfBandState'

import { DidExchangeStateMachine } from './DidExchangeStateMachine'
import { DidExchangeProblemReportError, DidExchangeProblemReportReason } from './errors'
import { DidExchangeCompleteMessage } from './messages/DidExchangeCompleteMessage'
import { DidExchangeRequestMessage } from './messages/DidExchangeRequestMessage'
import { DidExchangeResponseMessage } from './messages/DidExchangeResponseMessage'
import { DidExchangeRole, DidExchangeState, HandshakeProtocol } from './models'
import { ConnectionService } from './services'

interface DidExchangeRequestParams {
  label?: string
  alias?: string
  goal?: string
  goalCode?: string
  routing: Routing
  autoAcceptConnection?: boolean
}

@injectable()
export class DidExchangeProtocol {
  private connectionService: ConnectionService
  private didRegistrarService: DidRegistrarService
  private jwsService: JwsService
  private didRepository: DidRepository
  private logger: Logger

  public constructor(
    connectionService: ConnectionService,
    didRegistrarService: DidRegistrarService,
    didRepository: DidRepository,
    jwsService: JwsService,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.connectionService = connectionService
    this.didRegistrarService = didRegistrarService
    this.didRepository = didRepository
    this.jwsService = jwsService
    this.logger = logger
  }

  public async createRequest(
    agentContext: AgentContext,
    outOfBandRecord: OutOfBandRecord,
    params: DidExchangeRequestParams
  ): Promise<{ message: DidExchangeRequestMessage; connectionRecord: ConnectionRecord }> {
    this.logger.debug(`Create message ${DidExchangeRequestMessage.type.messageTypeUri} start`, {
      outOfBandRecord,
      params,
    })

    const { outOfBandInvitation } = outOfBandRecord
    const { alias, goal, goalCode, routing, autoAcceptConnection } = params

    // TODO: We should store only one did that we'll use to send the request message with success.
    // We take just the first one for now.
    const [invitationDid] = outOfBandInvitation.invitationDids

    const connectionRecord = await this.connectionService.createConnection(agentContext, {
      protocol: HandshakeProtocol.DidExchange,
      role: DidExchangeRole.Requester,
      alias,
      state: DidExchangeState.InvitationReceived,
      theirLabel: outOfBandInvitation.label,
      mediatorId: routing.mediatorId ?? outOfBandRecord.mediatorId,
      autoAcceptConnection: outOfBandRecord.autoAcceptConnection,
      outOfBandId: outOfBandRecord.id,
      invitationDid,
    })

    DidExchangeStateMachine.assertCreateMessageState(DidExchangeRequestMessage.type, connectionRecord)

    // Create message
    const label = params.label ?? agentContext.config.label
    const didDocument = await this.createPeerDidDoc(agentContext, this.routingToServices(routing))
    const parentThreadId = outOfBandRecord.outOfBandInvitation.id

    const message = new DidExchangeRequestMessage({ label, parentThreadId, did: didDocument.id, goal, goalCode })

    // Create sign attachment containing didDoc
    if (getNumAlgoFromPeerDid(didDocument.id) === PeerDidNumAlgo.GenesisDoc) {
      const didDocAttach = await this.createSignedAttachment(agentContext, didDocument, [
        routing.recipientKey.publicKeyBase58,
      ])
      message.didDoc = didDocAttach
    }

    connectionRecord.did = didDocument.id
    connectionRecord.threadId = message.id

    if (autoAcceptConnection !== undefined || autoAcceptConnection !== null) {
      connectionRecord.autoAcceptConnection = autoAcceptConnection
    }

    await this.updateState(agentContext, DidExchangeRequestMessage.type, connectionRecord)
    this.logger.debug(`Create message ${DidExchangeRequestMessage.type.messageTypeUri} end`, {
      connectionRecord,
      message,
    })
    return { message, connectionRecord }
  }

  public async processRequest(
    messageContext: InboundMessageContext<DidExchangeRequestMessage>,
    outOfBandRecord: OutOfBandRecord
  ): Promise<ConnectionRecord> {
    this.logger.debug(`Process message ${DidExchangeRequestMessage.type.messageTypeUri} start`, {
      message: messageContext.message,
    })

    outOfBandRecord.assertRole(OutOfBandRole.Sender)
    outOfBandRecord.assertState(OutOfBandState.AwaitResponse)

    // TODO check there is no connection record for particular oob record

    const { message } = messageContext

    // Check corresponding invitation ID is the request's ~thread.pthid or pthid is a public did
    // TODO Maybe we can do it in handler, but that actually does not make sense because we try to find oob by parent thread ID there.
    const parentThreadId = message.thread?.parentThreadId
    if (
      !parentThreadId ||
      (!tryParseDid(parentThreadId) && parentThreadId !== outOfBandRecord.getTags().invitationId)
    ) {
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
    const numAlgo = getNumAlgoFromPeerDid(message.did)
    if (numAlgo !== PeerDidNumAlgo.GenesisDoc) {
      throw new DidExchangeProblemReportError(
        `Unsupported numalgo ${numAlgo}. Supported numalgos are [${PeerDidNumAlgo.GenesisDoc}]`,
        {
          problemCode: DidExchangeProblemReportReason.RequestNotAccepted,
        }
      )
    }

    // TODO: Move this into the didcomm module, and add a method called store received did document.
    // This can be called from both the did exchange and the connection protocol.
    const didDocument = await this.extractDidDocument(messageContext.agentContext, message)
    const didRecord = new DidRecord({
      did: message.did,
      role: DidDocumentRole.Received,
      // It is important to take the did document from the PeerDid class
      // as it will have the id property
      didDocument,
      tags: {
        // We need to save the recipientKeys, so we can find the associated did
        // of a key when we receive a message from another connection.
        recipientKeyFingerprints: didDocument.recipientKeys.map((key) => key.fingerprint),
      },
    })

    this.logger.debug('Saving DID record', {
      id: didRecord.id,
      did: didRecord.did,
      role: didRecord.role,
      tags: didRecord.getTags(),
      didDocument: 'omitted...',
    })

    await this.didRepository.save(messageContext.agentContext, didRecord)

    const connectionRecord = await this.connectionService.createConnection(messageContext.agentContext, {
      protocol: HandshakeProtocol.DidExchange,
      role: DidExchangeRole.Responder,
      state: DidExchangeState.RequestReceived,
      alias: outOfBandRecord.alias,
      theirDid: message.did,
      theirLabel: message.label,
      threadId: message.threadId,
      mediatorId: outOfBandRecord.mediatorId,
      autoAcceptConnection: outOfBandRecord.autoAcceptConnection,
      outOfBandId: outOfBandRecord.id,
    })

    await this.updateState(messageContext.agentContext, DidExchangeRequestMessage.type, connectionRecord)
    this.logger.debug(`Process message ${DidExchangeRequestMessage.type.messageTypeUri} end`, connectionRecord)
    return connectionRecord
  }

  public async createResponse(
    agentContext: AgentContext,
    connectionRecord: ConnectionRecord,
    outOfBandRecord: OutOfBandRecord,
    routing?: Routing
  ): Promise<DidExchangeResponseMessage> {
    this.logger.debug(`Create message ${DidExchangeResponseMessage.type.messageTypeUri} start`, connectionRecord)
    DidExchangeStateMachine.assertCreateMessageState(DidExchangeResponseMessage.type, connectionRecord)

    const { threadId } = connectionRecord

    if (!threadId) {
      throw new AriesFrameworkError('Missing threadId on connection record.')
    }

    let services: ResolvedDidCommService[] = []
    if (routing) {
      services = this.routingToServices(routing)
    } else if (outOfBandRecord) {
      const inlineServices = outOfBandRecord.outOfBandInvitation.getInlineServices()
      services = inlineServices.map((service) => ({
        id: service.id,
        serviceEndpoint: service.serviceEndpoint,
        recipientKeys: service.recipientKeys.map(didKeyToInstanceOfKey),
        routingKeys: service.routingKeys?.map(didKeyToInstanceOfKey) ?? [],
      }))
    }

    const didDocument = await this.createPeerDidDoc(agentContext, services)
    const message = new DidExchangeResponseMessage({ did: didDocument.id, threadId })

    if (getNumAlgoFromPeerDid(didDocument.id) === PeerDidNumAlgo.GenesisDoc) {
      const didDocAttach = await this.createSignedAttachment(
        agentContext,
        didDocument,
        Array.from(
          new Set(
            services
              .map((s) => s.recipientKeys)
              .reduce((acc, curr) => acc.concat(curr), [])
              .map((key) => key.publicKeyBase58)
          )
        )
      )
      message.didDoc = didDocAttach
    }

    connectionRecord.did = didDocument.id

    await this.updateState(agentContext, DidExchangeResponseMessage.type, connectionRecord)
    this.logger.debug(`Create message ${DidExchangeResponseMessage.type.messageTypeUri} end`, {
      connectionRecord,
      message,
    })
    return message
  }

  public async processResponse(
    messageContext: InboundMessageContext<DidExchangeResponseMessage>,
    outOfBandRecord: OutOfBandRecord
  ): Promise<ConnectionRecord> {
    this.logger.debug(`Process message ${DidExchangeResponseMessage.type.messageTypeUri} start`, {
      message: messageContext.message,
    })

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
    const numAlgo = getNumAlgoFromPeerDid(message.did)
    if (numAlgo !== PeerDidNumAlgo.GenesisDoc) {
      throw new DidExchangeProblemReportError(
        `Unsupported numalgo ${numAlgo}. Supported numalgos are [${PeerDidNumAlgo.GenesisDoc}]`,
        {
          problemCode: DidExchangeProblemReportReason.ResponseNotAccepted,
        }
      )
    }

    const didDocument = await this.extractDidDocument(
      messageContext.agentContext,
      message,
      outOfBandRecord
        .getTags()
        .recipientKeyFingerprints.map((fingerprint) => Key.fromFingerprint(fingerprint).publicKeyBase58)
    )
    const didRecord = new DidRecord({
      did: message.did,
      role: DidDocumentRole.Received,
      didDocument,
      tags: {
        // We need to save the recipientKeys, so we can find the associated did
        // of a key when we receive a message from another connection.
        recipientKeyFingerprints: didDocument.recipientKeys.map((key) => key.fingerprint),
      },
    })

    this.logger.debug('Saving DID record', {
      id: didRecord.id,
      did: didRecord.did,
      role: didRecord.role,
      tags: didRecord.getTags(),
      didDocument: 'omitted...',
    })

    await this.didRepository.save(messageContext.agentContext, didRecord)

    connectionRecord.theirDid = message.did

    await this.updateState(messageContext.agentContext, DidExchangeResponseMessage.type, connectionRecord)
    this.logger.debug(`Process message ${DidExchangeResponseMessage.type.messageTypeUri} end`, connectionRecord)
    return connectionRecord
  }

  public async createComplete(
    agentContext: AgentContext,
    connectionRecord: ConnectionRecord,
    outOfBandRecord: OutOfBandRecord
  ): Promise<DidExchangeCompleteMessage> {
    this.logger.debug(`Create message ${DidExchangeCompleteMessage.type.messageTypeUri} start`, connectionRecord)
    DidExchangeStateMachine.assertCreateMessageState(DidExchangeCompleteMessage.type, connectionRecord)

    const threadId = connectionRecord.threadId
    const parentThreadId = outOfBandRecord.outOfBandInvitation.id

    if (!threadId) {
      throw new AriesFrameworkError(`Connection record ${connectionRecord.id} does not have 'threadId' attribute.`)
    }

    if (!parentThreadId) {
      throw new AriesFrameworkError(
        `Connection record ${connectionRecord.id} does not have 'parentThreadId' attribute.`
      )
    }

    const message = new DidExchangeCompleteMessage({ threadId, parentThreadId })

    await this.updateState(agentContext, DidExchangeCompleteMessage.type, connectionRecord)
    this.logger.debug(`Create message ${DidExchangeCompleteMessage.type.messageTypeUri} end`, {
      connectionRecord,
      message,
    })
    return message
  }

  public async processComplete(
    messageContext: InboundMessageContext<DidExchangeCompleteMessage>,
    outOfBandRecord: OutOfBandRecord
  ): Promise<ConnectionRecord> {
    this.logger.debug(`Process message ${DidExchangeCompleteMessage.type.messageTypeUri} start`, {
      message: messageContext.message,
    })

    const { connection: connectionRecord, message } = messageContext

    if (!connectionRecord) {
      throw new AriesFrameworkError('No connection record in message context.')
    }

    DidExchangeStateMachine.assertProcessMessageState(DidExchangeCompleteMessage.type, connectionRecord)

    if (message.threadId !== connectionRecord.threadId) {
      throw new DidExchangeProblemReportError('Invalid or missing thread ID.', {
        problemCode: DidExchangeProblemReportReason.CompleteRejected,
      })
    }
    const pthid = message.thread?.parentThreadId
    if (!pthid || pthid !== outOfBandRecord.outOfBandInvitation.id) {
      throw new DidExchangeProblemReportError('Invalid or missing parent thread ID referencing to the invitation.', {
        problemCode: DidExchangeProblemReportReason.CompleteRejected,
      })
    }

    await this.updateState(messageContext.agentContext, DidExchangeCompleteMessage.type, connectionRecord)
    this.logger.debug(`Process message ${DidExchangeCompleteMessage.type.messageTypeUri} end`, { connectionRecord })
    return connectionRecord
  }

  private async updateState(
    agentContext: AgentContext,
    messageType: ParsedMessageType,
    connectionRecord: ConnectionRecord
  ) {
    this.logger.debug(`Updating state`, { connectionRecord })
    const nextState = DidExchangeStateMachine.nextState(messageType, connectionRecord)
    return this.connectionService.updateState(agentContext, connectionRecord, nextState)
  }

  private async createPeerDidDoc(agentContext: AgentContext, services: ResolvedDidCommService[]) {
    // Create did document without the id property
    const didDocument = createPeerDidDocumentFromServices(services)

    // Register did:peer document. This will generate the id property and save it to a did record
    const result = await this.didRegistrarService.create<PeerDidCreateOptions>(agentContext, {
      method: 'peer',
      didDocument,
      options: {
        numAlgo: PeerDidNumAlgo.GenesisDoc,
      },
    })

    if (result.didState?.state !== 'finished') {
      throw new AriesFrameworkError(`Did document creation failed: ${JSON.stringify(result.didState)}`)
    }

    this.logger.debug(`Did document with did ${result.didState.did} created.`, {
      did: result.didState.did,
      didDocument: result.didState.didDocument,
    })

    return result.didState.didDocument
  }

  private async createSignedAttachment(agentContext: AgentContext, didDoc: DidDocument, verkeys: string[]) {
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

        const jws = await this.jwsService.createJws(agentContext, {
          payload,
          key,
          header: {
            kid,
          },
          protectedHeaderOptions: {
            alg: 'EdDSA',
            jwk: key.toJwk(),
          },
        })
        didDocAttach.addJws(jws)
      })
    )

    return didDocAttach
  }

  /**
   * Extracts DID document as is from request or response message attachment and verifies its signature.
   *
   * @param message DID request or DID response message
   * @param invitationKeys array containing keys from connection invitation that could be used for signing of DID document
   * @returns verified DID document content from message attachment
   */
  private async extractDidDocument(
    agentContext: AgentContext,
    message: DidExchangeRequestMessage | DidExchangeResponseMessage,
    invitationKeysBase58: string[] = []
  ): Promise<DidDocument> {
    if (!message.didDoc) {
      const problemCode =
        message instanceof DidExchangeRequestMessage
          ? DidExchangeProblemReportReason.RequestNotAccepted
          : DidExchangeProblemReportReason.ResponseNotAccepted
      throw new DidExchangeProblemReportError('DID Document attachment is missing.', { problemCode })
    }
    const didDocumentAttachment = message.didDoc
    const jws = didDocumentAttachment.data.jws

    if (!jws) {
      const problemCode =
        message instanceof DidExchangeRequestMessage
          ? DidExchangeProblemReportReason.RequestNotAccepted
          : DidExchangeProblemReportReason.ResponseNotAccepted
      throw new DidExchangeProblemReportError('DID Document signature is missing.', { problemCode })
    }

    const json = didDocumentAttachment.getDataAsJson() as Record<string, unknown>
    this.logger.trace('DidDocument JSON', json)

    const payload = JsonEncoder.toBuffer(json)
    const { isValid, signerKeys } = await this.jwsService.verifyJws(agentContext, { jws, payload })

    const didDocument = JsonTransformer.fromJSON(json, DidDocument)
    const didDocumentKeysBase58 = didDocument.authentication
      ?.map((authentication) => {
        const verificationMethod =
          typeof authentication === 'string'
            ? didDocument.dereferenceVerificationMethod(authentication)
            : authentication
        const key = getKeyFromVerificationMethod(verificationMethod)
        return key.publicKeyBase58
      })
      .concat(invitationKeysBase58)

    this.logger.trace('JWS verification result', { isValid, signerKeys, didDocumentKeysBase58 })

    if (!isValid || !signerKeys.every((key) => didDocumentKeysBase58?.includes(key.publicKeyBase58))) {
      const problemCode =
        message instanceof DidExchangeRequestMessage
          ? DidExchangeProblemReportReason.RequestNotAccepted
          : DidExchangeProblemReportReason.ResponseNotAccepted
      throw new DidExchangeProblemReportError('DID Document signature is invalid.', { problemCode })
    }

    return didDocument
  }

  private routingToServices(routing: Routing): ResolvedDidCommService[] {
    return routing.endpoints.map((endpoint, index) => ({
      id: `#inline-${index}`,
      serviceEndpoint: endpoint,
      recipientKeys: [routing.recipientKey],
      routingKeys: routing.routingKeys,
    }))
  }
}
