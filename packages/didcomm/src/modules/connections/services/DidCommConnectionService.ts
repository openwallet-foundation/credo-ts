import type { AgentContext, DidDocumentKey, Query, QueryOptions } from '@credo-ts/core'
import {
  CredoError,
  DidDocumentRole,
  DidRecord,
  DidRecordMetadataKeys,
  DidRepository,
  DidsApi,
  didDocumentJsonToNumAlgo1Did,
  EventEmitter,
  filterContextCorrelationId,
  IndyAgentService,
  InjectionSymbols,
  inject,
  injectable,
  JsonTransformer,
  Kms,
  type Logger,
  parseDid,
  TypedArrayEncoder,
  utils,
} from '@credo-ts/core'
import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, map, timeout } from 'rxjs/operators'
import type { DidCommMessage } from '../../../DidCommMessage'
import { signData, unpackAndVerifySignatureDecorator } from '../../../decorators/signature/SignatureDecoratorUtils'
import type { DidCommAckMessage } from '../../../messages'
import type { DidCommInboundMessageContext, DidCommRouting } from '../../../models'
import { DidCommOutOfBandService } from '../../oob/DidCommOutOfBandService'
import { DidCommOutOfBandRole } from '../../oob/domain/DidCommOutOfBandRole'
import { DidCommOutOfBandState } from '../../oob/domain/DidCommOutOfBandState'
import { DidCommInvitationType } from '../../oob/messages'
import type { DidCommOutOfBandRecord } from '../../oob/repository'
import { DidCommOutOfBandRepository } from '../../oob/repository'
import { DidCommOutOfBandRecordMetadataKeys } from '../../oob/repository/outOfBandRecordMetadataTypes'
import type { DidCommConnectionStateChangedEvent } from '../DidCommConnectionEvents'
import { DidCommConnectionEventTypes } from '../DidCommConnectionEvents'
import { ConnectionProblemReportError, ConnectionProblemReportReason } from '../errors'
import type { DidCommConnectionProblemReportMessage } from '../messages'
import { DidCommConnectionRequestMessage, DidCommConnectionResponseMessage, DidCommTrustPingMessage } from '../messages'
import type { DidCommConnectionType } from '../models'
import {
  authenticationTypes,
  DidCommConnection,
  DidCommDidExchangeRole,
  DidCommDidExchangeState,
  DidCommHandshakeProtocol,
  DidDoc,
  Ed25119Sig2018,
  ReferencedAuthentication,
} from '../models'
import type { DidCommConnectionRecordProps } from '../repository'
import { DidCommConnectionRecord, DidCommConnectionRepository } from '../repository'

import {
  assertNoCreatedDidExistsForKeys,
  convertToNewDidDocument,
  getResolvedDidcommServiceWithSigningKeyId,
} from './helpers'

export interface ConnectionRequestParams {
  label: string
  imageUrl?: string
  alias?: string
  routing: DidCommRouting
  autoAcceptConnection?: boolean
}

@injectable()
export class DidCommConnectionService {
  private connectionRepository: DidCommConnectionRepository
  private didRepository: DidRepository
  private eventEmitter: EventEmitter
  private logger: Logger

  private hasLoggedWarning = false

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    connectionRepository: DidCommConnectionRepository,
    didRepository: DidRepository,
    eventEmitter: EventEmitter
  ) {
    this.connectionRepository = connectionRepository
    this.didRepository = didRepository
    this.eventEmitter = eventEmitter
    this.logger = logger
  }

  private ensureWarningLoggedOnce() {
    if (this.hasLoggedWarning) return

    this.logger.debug(
      'The v1 connection protocol is deprecated and will be removed in version 0.7 of Credo. You should upgrade to the did exchange protocol instead.'
    )
    this.hasLoggedWarning = true
  }

  /**
   * Create a connection request message for a given out-of-band.
   *
   * @param outOfBandRecord out-of-band record for which to create a connection request
   * @param config config for creation of connection request
   * @returns outbound message containing connection request
   */
  public async createRequest(
    agentContext: AgentContext,
    outOfBandRecord: DidCommOutOfBandRecord,
    config: ConnectionRequestParams
  ): Promise<ConnectionProtocolMsgReturnType<DidCommConnectionRequestMessage>> {
    this.ensureWarningLoggedOnce()
    this.logger.debug(`Create message ${DidCommConnectionRequestMessage.type.messageTypeUri} start`, outOfBandRecord)
    outOfBandRecord.assertRole(DidCommOutOfBandRole.Receiver)
    outOfBandRecord.assertState(DidCommOutOfBandState.PrepareResponse)

    // TODO check there is no connection record for particular oob record

    const { outOfBandInvitation } = outOfBandRecord

    const { mediatorId } = config.routing
    const { didDoc, keys } = this.createDidDoc(config.routing)

    // TODO: We should store only one did that we'll use to send the request message with success.
    // We take just the first one for now.
    const [invitationDid] = outOfBandInvitation.invitationDids

    const { did: peerDid } = await this.createDid(agentContext, {
      role: DidDocumentRole.Created,
      didDoc,
      keys,
    })

    const { label, imageUrl } = config

    const connectionRequest = new DidCommConnectionRequestMessage({
      label,
      did: didDoc.id,
      didDoc,
      imageUrl,
    })

    connectionRequest.setThread({
      threadId: connectionRequest.threadId,
      parentThreadId: outOfBandRecord.outOfBandInvitation.id,
    })

    const connectionRecord = await this.createConnection(agentContext, {
      protocol: DidCommHandshakeProtocol.Connections,
      role: DidCommDidExchangeRole.Requester,
      state: DidCommDidExchangeState.InvitationReceived,
      theirLabel: outOfBandInvitation.label,
      alias: config?.alias,
      did: peerDid,
      mediatorId,
      autoAcceptConnection: config?.autoAcceptConnection,
      outOfBandId: outOfBandRecord.id,
      invitationDid,
      imageUrl: outOfBandInvitation.imageUrl,
      threadId: connectionRequest.threadId,
    })

    await this.updateState(agentContext, connectionRecord, DidCommDidExchangeState.RequestSent)

    return {
      connectionRecord,
      message: connectionRequest,
    }
  }

  public async processRequest(
    messageContext: DidCommInboundMessageContext<DidCommConnectionRequestMessage>,
    outOfBandRecord: DidCommOutOfBandRecord
  ): Promise<DidCommConnectionRecord> {
    this.ensureWarningLoggedOnce()
    this.logger.debug(`Process message ${DidCommConnectionRequestMessage.type.messageTypeUri} start`, {
      message: messageContext.message,
    })
    outOfBandRecord.assertRole(DidCommOutOfBandRole.Sender)
    outOfBandRecord.assertState(DidCommOutOfBandState.AwaitResponse)

    // TODO check there is no connection record for particular oob record

    const { message } = messageContext
    if (!message.connection.didDoc) {
      throw new ConnectionProblemReportError('Public DIDs are not supported yet', {
        problemCode: ConnectionProblemReportReason.RequestNotAccepted,
      })
    }

    const { did: peerDid } = await this.createDid(messageContext.agentContext, {
      role: DidDocumentRole.Received,
      didDoc: message.connection.didDoc,
    })

    const connectionRecord = await this.createConnection(messageContext.agentContext, {
      protocol: DidCommHandshakeProtocol.Connections,
      role: DidCommDidExchangeRole.Responder,
      state: DidCommDidExchangeState.RequestReceived,
      alias: outOfBandRecord.alias,
      theirLabel: message.label,
      imageUrl: message.imageUrl,
      outOfBandId: outOfBandRecord.id,
      theirDid: peerDid,
      threadId: message.threadId,
      mediatorId: outOfBandRecord.mediatorId,
      autoAcceptConnection: outOfBandRecord.autoAcceptConnection,
    })

    await this.connectionRepository.update(messageContext.agentContext, connectionRecord)
    this.emitStateChangedEvent(messageContext.agentContext, connectionRecord, null)

    this.logger.debug(`Process message ${DidCommConnectionRequestMessage.type.messageTypeUri} end`, connectionRecord)
    return connectionRecord
  }

  /**
   * Create a connection response message for the connection with the specified connection id.
   *
   * @param connectionRecord the connection for which to create a connection response
   * @returns outbound message containing connection response
   */
  public async createResponse(
    agentContext: AgentContext,
    connectionRecord: DidCommConnectionRecord,
    outOfBandRecord: DidCommOutOfBandRecord,
    routing?: DidCommRouting
  ): Promise<ConnectionProtocolMsgReturnType<DidCommConnectionResponseMessage>> {
    this.ensureWarningLoggedOnce()
    this.logger.debug(`Create message ${DidCommConnectionResponseMessage.type.messageTypeUri} start`, connectionRecord)
    connectionRecord.assertState(DidCommDidExchangeState.RequestReceived)
    connectionRecord.assertRole(DidCommDidExchangeRole.Responder)

    let didDoc: DidDoc
    let keys: DidDocumentKey[]
    if (routing) {
      const result = this.createDidDoc(routing)
      didDoc = result.didDoc
      keys = result.keys
    } else if (outOfBandRecord.outOfBandInvitation.getInlineServices().length > 0) {
      const result = this.createDidDocFromOutOfBandDidCommServices(outOfBandRecord)
      didDoc = result.didDoc
      keys = result.keys
    } else {
      // We don't support using a did from the OOB invitation services currently, in this case we always pass routing to this method
      throw new CredoError(
        'No routing provided, and no inline services found in out of band invitation. When using did services in out of band invitation, make sure to provide routing information for rotation.'
      )
    }

    const { did: peerDid } = await this.createDid(agentContext, {
      role: DidDocumentRole.Created,
      didDoc,
      keys,
    })

    const connection = new DidCommConnection({
      did: didDoc.id,
      didDoc,
    })

    const connectionJson = JsonTransformer.toJSON(connection)

    if (!connectionRecord.threadId) {
      throw new CredoError(`Connection record with id ${connectionRecord.id} does not have a thread id`)
    }

    let signingKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
    const firstService = outOfBandRecord.outOfBandInvitation.getServices()[0]
    if (typeof firstService === 'string') {
      const dids = agentContext.resolve(DidsApi)
      const resolved = await dids.resolveCreatedDidDocumentWithKeys(parseDid(firstService).did)

      const recipientKeys = resolved.didDocument.getRecipientKeysWithVerificationMethod({ mapX25519ToEd25519: true })
      if (recipientKeys.length === 0) {
        throw new CredoError(`Unable to extract signing key for connection response from did '${firstService}'`)
      }

      signingKey = recipientKeys[0].publicJwk
      // TOOD: we probably need an util: addKeyIdToVerificationMethodKey
      signingKey.keyId =
        resolved.keys?.find(({ didDocumentRelativeKeyId }) =>
          recipientKeys[0].verificationMethod.id.endsWith(didDocumentRelativeKeyId)
        )?.kmsKeyId ?? signingKey.legacyKeyId
    } else {
      const service = getResolvedDidcommServiceWithSigningKeyId(
        firstService,
        outOfBandRecord.invitationInlineServiceKeys
      )
      signingKey = service.recipientKeys[0]
    }

    const connectionResponse = new DidCommConnectionResponseMessage({
      threadId: connectionRecord.threadId,
      connectionSig: await signData(agentContext, connectionJson, signingKey),
    })

    connectionRecord.did = peerDid
    await this.updateState(agentContext, connectionRecord, DidCommDidExchangeState.ResponseSent)

    this.logger.debug(`Create message ${DidCommConnectionResponseMessage.type.messageTypeUri} end`, {
      connectionRecord,
      message: connectionResponse,
    })
    return {
      connectionRecord,
      message: connectionResponse,
    }
  }

  /**
   * Process a received connection response message. This will not accept the connection request
   * or send a connection acknowledgement message. It will only update the existing connection record
   * with all the new information from the connection response message. Use {@link DidCommConnectionService.createTrustPing}
   * after calling this function to create a trust ping message.
   *
   * @param messageContext the message context containing a connection response message
   * @returns updated connection record
   */
  public async processResponse(
    messageContext: DidCommInboundMessageContext<DidCommConnectionResponseMessage>,
    outOfBandRecord: DidCommOutOfBandRecord
  ): Promise<DidCommConnectionRecord> {
    this.ensureWarningLoggedOnce()
    this.logger.debug(`Process message ${DidCommConnectionResponseMessage.type.messageTypeUri} start`, {
      message: messageContext.message,
    })
    const { connection: connectionRecord, message, recipientKey, senderKey } = messageContext

    if (!recipientKey || !senderKey) {
      throw new CredoError('Unable to process connection request without senderKey or recipientKey')
    }

    if (!connectionRecord) {
      throw new CredoError('No connection record in message context.')
    }

    connectionRecord.assertState(DidCommDidExchangeState.RequestSent)
    connectionRecord.assertRole(DidCommDidExchangeRole.Requester)

    let connectionJson = null
    try {
      connectionJson = await unpackAndVerifySignatureDecorator(messageContext.agentContext, message.connectionSig)
    } catch (error) {
      if (error instanceof CredoError) {
        throw new ConnectionProblemReportError(error.message, {
          problemCode: ConnectionProblemReportReason.ResponseProcessingError,
        })
      }
      throw error
    }

    const connection = JsonTransformer.fromJSON(connectionJson, DidCommConnection)

    // Per the Connection RFC we must check if the key used to sign the connection~sig is the same key
    // as the recipient key(s) in the connection invitation message
    const signerVerkey = message.connectionSig.signer

    const invitationKey = Kms.PublicJwk.fromFingerprint(outOfBandRecord.getTags().recipientKeyFingerprints[0])
    if (!invitationKey.is(Kms.Ed25519PublicJwk)) {
      throw new ConnectionProblemReportError(
        `Expected invitation key to be an Ed25519 key, found ${invitationKey.jwkTypeHumanDescription}`,
        { problemCode: ConnectionProblemReportReason.ResponseNotAccepted }
      )
    }

    const invitationKeyBase58 = TypedArrayEncoder.toBase58(invitationKey.publicKey.publicKey)

    if (signerVerkey !== invitationKeyBase58) {
      throw new ConnectionProblemReportError(
        `Connection object in connection response message is not signed with same key as recipient key in invitation expected='${invitationKey}' received='${signerVerkey}'`,
        { problemCode: ConnectionProblemReportReason.ResponseNotAccepted }
      )
    }

    if (!connection.didDoc) {
      throw new CredoError('DID Document is missing.')
    }

    const { did: peerDid } = await this.createDid(messageContext.agentContext, {
      role: DidDocumentRole.Received,
      didDoc: connection.didDoc,
    })

    connectionRecord.theirDid = peerDid
    connectionRecord.threadId = message.threadId

    await this.updateState(messageContext.agentContext, connectionRecord, DidCommDidExchangeState.ResponseReceived)
    return connectionRecord
  }

  /**
   * Create a trust ping message for the connection with the specified connection id.
   *
   * By default a trust ping message should elicit a response. If this is not desired the
   * `config.responseRequested` property can be set to `false`.
   *
   * @param connectionRecord the connection for which to create a trust ping message
   * @param config the config for the trust ping message
   * @returns outbound message containing trust ping message
   */
  public async createTrustPing(
    agentContext: AgentContext,
    connectionRecord: DidCommConnectionRecord,
    config: { responseRequested?: boolean; comment?: string } = {}
  ): Promise<ConnectionProtocolMsgReturnType<DidCommTrustPingMessage>> {
    connectionRecord.assertState([DidCommDidExchangeState.ResponseReceived, DidCommDidExchangeState.Completed])

    // TODO:
    //  - create ack message
    //  - maybe this shouldn't be in the connection service?
    const trustPing = new DidCommTrustPingMessage(config)

    // Only update connection record and emit an event if the state is not already 'Complete'
    if (connectionRecord.state !== DidCommDidExchangeState.Completed) {
      await this.updateState(agentContext, connectionRecord, DidCommDidExchangeState.Completed)
    }

    return {
      connectionRecord,
      message: trustPing,
    }
  }

  /**
   * Process a received ack message. This will update the state of the connection
   * to Completed if this is not already the case.
   *
   * @param messageContext the message context containing an ack message
   * @returns updated connection record
   */
  public async processAck(
    messageContext: DidCommInboundMessageContext<DidCommAckMessage>
  ): Promise<DidCommConnectionRecord> {
    const { connection, recipientKey } = messageContext

    if (!connection) {
      throw new CredoError(
        `Unable to process connection ack: connection for recipient key ${recipientKey?.fingerprint} not found`
      )
    }

    // TODO: This is better addressed in a middleware of some kind because
    // any message can transition the state to complete, not just an ack or trust ping
    if (
      connection.state === DidCommDidExchangeState.ResponseSent &&
      connection.role === DidCommDidExchangeRole.Responder
    ) {
      await this.updateState(messageContext.agentContext, connection, DidCommDidExchangeState.Completed)
    }

    return connection
  }

  /**
   * Process a received {@link DidCommProblemReportMessage}.
   *
   * @param messageContext The message context containing a connection problem report message
   * @returns connection record associated with the connection problem report message
   *
   */
  public async processProblemReport(
    messageContext: DidCommInboundMessageContext<DidCommConnectionProblemReportMessage>
  ): Promise<DidCommConnectionRecord> {
    this.ensureWarningLoggedOnce()
    const { message: connectionProblemReportMessage, recipientKey, senderKey } = messageContext

    this.logger.debug(`Processing connection problem report for verkey ${recipientKey?.fingerprint}`)

    if (!recipientKey) {
      throw new CredoError('Unable to process connection problem report without recipientKey')
    }

    const ourDidRecord = await this.didRepository.findCreatedDidByRecipientKey(
      messageContext.agentContext,
      recipientKey
    )
    if (!ourDidRecord) {
      throw new CredoError(
        `Unable to process connection problem report: created did record for recipient key ${recipientKey.fingerprint} not found`
      )
    }

    const connectionRecord = await this.findByOurDid(messageContext.agentContext, ourDidRecord.did)
    if (!connectionRecord) {
      throw new CredoError(
        `Unable to process connection problem report: connection for recipient key ${recipientKey.fingerprint} not found`
      )
    }

    const theirDidRecord =
      connectionRecord.theirDid &&
      (await this.didRepository.findReceivedDid(messageContext.agentContext, connectionRecord.theirDid))
    if (!theirDidRecord) {
      throw new CredoError(`Received did record for did ${connectionRecord.theirDid} not found.`)
    }

    if (senderKey) {
      if (!theirDidRecord?.getTags().recipientKeyFingerprints?.includes(senderKey.fingerprint)) {
        throw new CredoError("Sender key doesn't match key of connection record")
      }
    }

    connectionRecord.errorMessage = `${connectionProblemReportMessage.description.code} : ${connectionProblemReportMessage.description.en}`
    await this.update(messageContext.agentContext, connectionRecord)

    // Marking connection as abandoned in case of problem report from issuer agent
    // TODO: Can be conditionally abandoned - Like if another user is scanning already used connection invite where issuer will send invite-already-used problem code.
    await this.updateState(messageContext.agentContext, connectionRecord, DidCommDidExchangeState.Abandoned)

    return connectionRecord
  }

  /**
   * Assert that an inbound message either has a connection associated with it,
   * or has everything correctly set up for connection-less exchange (optionally with out of band)
   *
   * @param messageContext - the inbound message context
   */
  public async assertConnectionOrOutOfBandExchange(
    messageContext: DidCommInboundMessageContext,
    {
      lastSentMessage,
      lastReceivedMessage,
      expectedConnectionId,
    }: {
      lastSentMessage?: DidCommMessage | null
      lastReceivedMessage?: DidCommMessage | null
      expectedConnectionId?: string
    } = {}
  ) {
    const { connection, message } = messageContext

    if (expectedConnectionId && !connection) {
      throw new CredoError(
        `Expected incoming message to be from connection ${expectedConnectionId} but no connection found.`
      )
    }
    if (expectedConnectionId && connection?.id !== expectedConnectionId) {
      throw new CredoError(
        `Expected incoming message to be from connection ${expectedConnectionId} but connection is ${connection?.id}.`
      )
    }

    // Check if we have a ready connection. Verification is already done somewhere else. Return
    if (connection) {
      connection.assertReady()
      this.logger.debug(`Processing message with id ${message.id} and connection id ${connection.id}`, {
        type: message.type,
      })
    } else {
      this.logger.debug(`Processing connection-less message with id ${message.id}`, {
        type: message.type,
      })

      const recipientKey = messageContext.recipientKey
      const senderKey = messageContext.senderKey

      // set theirService to the value of lastReceivedMessage.service
      let theirService =
        messageContext.message?.service?.resolvedDidCommService ?? lastReceivedMessage?.service?.resolvedDidCommService
      let ourService = lastSentMessage?.service?.resolvedDidCommService

      // FIXME: we should remove support for the flow where no out of band record is used.
      // Users have had enough time to update to the OOB API which supports legacy connectionsless
      // invitations as well
      // 1. check if there's an oob record associated.
      const outOfBandRepository = messageContext.agentContext.dependencyManager.resolve(DidCommOutOfBandRepository)
      const outOfBandService = messageContext.agentContext.dependencyManager.resolve(DidCommOutOfBandService)
      const outOfBandRecord = await outOfBandRepository.findSingleByQuery(messageContext.agentContext, {
        invitationRequestsThreadIds: [message.threadId],
      })

      // If we have an out of band record, we can extract the service for our/the other party from the oob record
      if (outOfBandRecord?.role === DidCommOutOfBandRole.Sender) {
        ourService = await outOfBandService.getResolvedServiceForOutOfBandServices(
          messageContext.agentContext,
          outOfBandRecord.outOfBandInvitation.getServices(),
          outOfBandRecord.invitationInlineServiceKeys
        )
      } else if (outOfBandRecord?.role === DidCommOutOfBandRole.Receiver) {
        theirService = await outOfBandService.getResolvedServiceForOutOfBandServices(
          messageContext.agentContext,
          outOfBandRecord.outOfBandInvitation.getServices()
        )
      }

      // theirService can be null when we receive an oob invitation and process the message.
      // In this case there MUST be an oob record, otherwise there is no way for us to reply
      // to the message
      if (!theirService && !outOfBandRecord) {
        throw new CredoError(
          'No service for incoming connection-less message and no associated out of band record found.'
        )
      }

      // ourService can be null when we receive an oob invitation or legacy connectionless message and process the message.
      // In this case lastSentMessage and lastReceivedMessage MUST be null, because there shouldn't be any previous exchange
      if (!ourService && (lastReceivedMessage || lastSentMessage)) {
        throw new CredoError(
          'No keys on our side to use for encrypting messages, and previous messages found (in which case our keys MUST also be present).'
        )
      }

      // If the message is unpacked or AuthCrypt, there cannot be any previous exchange (this must be the first message).
      // All exchange after the first unpacked oob exchange MUST be encrypted.
      if ((!senderKey || !recipientKey) && (lastSentMessage || lastReceivedMessage)) {
        throw new CredoError(
          'Incoming message must have recipientKey and senderKey (so cannot be AuthCrypt or unpacked) if there are lastSentMessage or lastReceivedMessage.'
        )
      }

      // Check if recipientKey is in ourService
      if (recipientKey && ourService) {
        const recipientKeyFound = ourService.recipientKeys.some((key) => recipientKey.equals(key))
        if (!recipientKeyFound) {
          throw new CredoError(`Recipient key ${recipientKey.fingerprint} not found in our service`)
        }
      }

      // Check if senderKey is in theirService
      if (senderKey && theirService) {
        const senderKeyFound = theirService.recipientKeys.some((key) => senderKey.equals(key))
        if (!senderKeyFound) {
          throw new CredoError(`Sender key ${senderKey.fingerprint} not found in their service.`)
        }
      }
    }
  }

  /**
   * If knownConnectionId is passed, it will compare the incoming connection id with the knownConnectionId, and skip the other validation.
   *
   * If no known connection id is passed, it asserts that the incoming message is in response to an attached request message to an out of band invitation.
   * If is the case, and the state of the out of band record is still await response, the state will be updated to done
   *
   */
  public async matchIncomingMessageToRequestMessageInOutOfBandExchange(
    messageContext: DidCommInboundMessageContext,
    { expectedConnectionId }: { expectedConnectionId?: string }
  ) {
    if (expectedConnectionId && messageContext.connection?.id !== expectedConnectionId) {
      throw new CredoError(
        `Expecting incoming message to have connection ${expectedConnectionId}, but incoming connection is ${
          messageContext.connection?.id ?? 'undefined'
        }`
      )
    }

    const outOfBandRepository = messageContext.agentContext.dependencyManager.resolve(DidCommOutOfBandRepository)
    const outOfBandInvitationId = messageContext.message.thread?.parentThreadId

    // Find the out of band record that is associated with this request
    const outOfBandRecord = await outOfBandRepository.findSingleByQuery(messageContext.agentContext, {
      invitationId: outOfBandInvitationId,
      role: DidCommOutOfBandRole.Sender,
      invitationRequestsThreadIds: [messageContext.message.threadId],
    })

    // There is no out of band record
    if (!outOfBandRecord) {
      throw new CredoError(
        `No out of band record found for credential request message with thread ${messageContext.message.threadId}, out of band invitation id ${outOfBandInvitationId} and role ${DidCommOutOfBandRole.Sender}`
      )
    }

    const legacyInvitationMetadata = outOfBandRecord.metadata.get(DidCommOutOfBandRecordMetadataKeys.LegacyInvitation)

    // If the original invitation was a legacy connectionless invitation, it's okay if the message does not have a pthid.
    if (
      legacyInvitationMetadata?.legacyInvitationType !== DidCommInvitationType.Connectionless &&
      outOfBandRecord.outOfBandInvitation.id !== outOfBandInvitationId
    ) {
      throw new CredoError(
        'Response messages to out of band invitation requests MUST have a parent thread id that matches the out of band invitation id.'
      )
    }

    // This should not happen, as it is not allowed to create reusable out of band invitations with attached messages
    // But should that implementation change, we at least cover it here.
    if (outOfBandRecord.reusable) {
      throw new CredoError('Receiving messages in response to reusable out of band invitations is not supported.')
    }

    if (outOfBandRecord.state === DidCommOutOfBandState.Done) {
      if (!messageContext.connection) {
        throw new CredoError(
          "Can't find connection associated with incoming message, while out of band state is done. State must be await response if no connection has been created"
        )
      }
      if (messageContext.connection.outOfBandId !== outOfBandRecord.id) {
        throw new CredoError(
          'Connection associated with incoming message is not associated with the out of band invitation containing the attached message.'
        )
      }

      // We're good to go. Connection was created and points to the correct out of band record. And the message is in response to an attached request message from the oob invitation.
    } else if (outOfBandRecord.state === DidCommOutOfBandState.AwaitResponse) {
      // We're good to go. Waiting for a response. And the message is in response to an attached request message from the oob invitation.

      // Now that we have received the first response message to our out of band invitation, we mark the out of band record as done
      outOfBandRecord.state = DidCommOutOfBandState.Done
      await outOfBandRepository.update(messageContext.agentContext, outOfBandRecord)
    } else {
      throw new CredoError(`Out of band record is in incorrect state ${outOfBandRecord.state}`)
    }
  }

  public async updateState(
    agentContext: AgentContext,
    connectionRecord: DidCommConnectionRecord,
    newState: DidCommDidExchangeState
  ) {
    const previousState = connectionRecord.state
    connectionRecord.state = newState
    await this.connectionRepository.update(agentContext, connectionRecord)

    this.emitStateChangedEvent(agentContext, connectionRecord, previousState)
  }

  private emitStateChangedEvent(
    agentContext: AgentContext,
    connectionRecord: DidCommConnectionRecord,
    previousState: DidCommDidExchangeState | null
  ) {
    this.eventEmitter.emit<DidCommConnectionStateChangedEvent>(agentContext, {
      type: DidCommConnectionEventTypes.DidCommConnectionStateChanged,
      payload: {
        // Connection record in event should be static
        connectionRecord: connectionRecord.clone(),
        previousState,
      },
    })
  }

  public update(agentContext: AgentContext, connectionRecord: DidCommConnectionRecord) {
    return this.connectionRepository.update(agentContext, connectionRecord)
  }

  /**
   * Retrieve all connections records
   *
   * @returns List containing all connection records
   */
  public getAll(agentContext: AgentContext) {
    return this.connectionRepository.getAll(agentContext)
  }

  /**
   * Retrieve a connection record by id
   *
   * @param connectionId The connection record id
   * @throws {RecordNotFoundError} If no record is found
   * @return The connection record
   *
   */
  public getById(agentContext: AgentContext, connectionId: string): Promise<DidCommConnectionRecord> {
    return this.connectionRepository.getById(agentContext, connectionId)
  }

  /**
   * Find a connection record by id
   *
   * @param connectionId the connection record id
   * @returns The connection record or null if not found
   */
  public findById(agentContext: AgentContext, connectionId: string): Promise<DidCommConnectionRecord | null> {
    return this.connectionRepository.findById(agentContext, connectionId)
  }

  /**
   * Delete a connection record by id
   *
   * @param connectionId the connection record id
   */
  public async deleteById(agentContext: AgentContext, connectionId: string) {
    const connectionRecord = await this.getById(agentContext, connectionId)
    return this.connectionRepository.delete(agentContext, connectionRecord)
  }

  public async findByDids(agentContext: AgentContext, query: { ourDid: string; theirDid: string }) {
    return this.connectionRepository.findByDids(agentContext, query)
  }

  /**
   * Retrieve a connection record by thread id
   *
   * @param threadId The thread id
   * @throws {RecordNotFoundError} If no record is found
   * @throws {RecordDuplicateError} If multiple records are found
   * @returns The connection record
   */
  public async getByThreadId(agentContext: AgentContext, threadId: string): Promise<DidCommConnectionRecord> {
    return this.connectionRepository.getByThreadId(agentContext, threadId)
  }

  public async getByRoleAndThreadId(agentContext: AgentContext, role: DidCommDidExchangeRole, threadId: string) {
    return this.connectionRepository.getByRoleAndThreadId(agentContext, role, threadId)
  }

  public async findByTheirDid(agentContext: AgentContext, theirDid: string): Promise<DidCommConnectionRecord | null> {
    return this.connectionRepository.findSingleByQuery(agentContext, { theirDid })
  }

  public async findByOurDid(agentContext: AgentContext, ourDid: string): Promise<DidCommConnectionRecord | null> {
    return this.connectionRepository.findSingleByQuery(agentContext, { did: ourDid })
  }

  public async findAllByOutOfBandId(agentContext: AgentContext, outOfBandId: string) {
    return this.connectionRepository.findByQuery(agentContext, { outOfBandId })
  }

  public async findAllByConnectionTypes(
    agentContext: AgentContext,
    connectionTypes: Array<DidCommConnectionType | string>
  ) {
    return this.connectionRepository.findByQuery(agentContext, { connectionTypes })
  }

  public async findByInvitationDid(agentContext: AgentContext, invitationDid: string) {
    return this.connectionRepository.findByQuery(agentContext, { invitationDid })
  }

  public async findByKeys(
    agentContext: AgentContext,
    {
      senderKey,
      recipientKey,
    }: { senderKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>; recipientKey: Kms.PublicJwk<Kms.Ed25519PublicJwk> }
  ) {
    const theirDidRecord = await this.didRepository.findReceivedDidByRecipientKey(agentContext, senderKey)
    if (theirDidRecord) {
      const ourDidRecord = await this.didRepository.findCreatedDidByRecipientKey(agentContext, recipientKey)
      if (ourDidRecord) {
        const connectionRecord = await this.findByDids(agentContext, {
          ourDid: ourDidRecord.did,
          theirDid: theirDidRecord.did,
        })
        if (connectionRecord?.isReady) return connectionRecord
      }
    }

    this.logger.debug(
      `No connection record found for encrypted message with recipient key ${recipientKey.fingerprint} and sender key ${senderKey.fingerprint}`
    )

    return null
  }

  public async findAllByQuery(
    agentContext: AgentContext,
    query: Query<DidCommConnectionRecord>,
    queryOptions?: QueryOptions
  ): Promise<DidCommConnectionRecord[]> {
    return this.connectionRepository.findByQuery(agentContext, query, queryOptions)
  }

  public async createConnection(
    agentContext: AgentContext,
    options: DidCommConnectionRecordProps
  ): Promise<DidCommConnectionRecord> {
    const connectionRecord = new DidCommConnectionRecord(options)
    await this.connectionRepository.save(agentContext, connectionRecord)
    return connectionRecord
  }

  public async addConnectionType(agentContext: AgentContext, connectionRecord: DidCommConnectionRecord, type: string) {
    const connectionTypes = connectionRecord.connectionTypes || []
    connectionRecord.connectionTypes = [type, ...connectionTypes]
    await this.update(agentContext, connectionRecord)
  }

  public async removeConnectionType(
    agentContext: AgentContext,
    connectionRecord: DidCommConnectionRecord,
    type: string
  ) {
    connectionRecord.connectionTypes = connectionRecord.connectionTypes.filter((value) => value !== type)
    await this.update(agentContext, connectionRecord)
  }

  public async getConnectionTypes(connectionRecord: DidCommConnectionRecord) {
    return connectionRecord.connectionTypes || []
  }

  private async createDid(
    agentContext: AgentContext,
    { role, didDoc, keys }: { role: DidDocumentRole; didDoc: DidDoc; keys?: DidDocumentKey[] }
  ) {
    if (keys && role !== DidDocumentRole.Created) {
      throw new CredoError(`keys can only be provided for did documents when the role is '${DidDocumentRole.Created}'`)
    }

    // Convert the legacy did doc to a new did document
    const { didDocument, keys: updatedKeys } = convertToNewDidDocument(didDoc, keys)

    // Assert that the keys we are going to use for creating a did document haven't already been used in another did document
    if (role === DidDocumentRole.Created) {
      await assertNoCreatedDidExistsForKeys(agentContext, didDocument.recipientKeys)
    }

    const peerDid = didDocumentJsonToNumAlgo1Did(didDocument.toJSON())
    didDocument.id = peerDid
    const didRecord = new DidRecord({
      did: peerDid,
      role,
      didDocument,
      keys: updatedKeys,
    })

    // Store the unqualified did with the legacy did document in the metadata
    // Can be removed at a later stage if we know for sure we don't need it anymore
    didRecord.metadata.set(DidRecordMetadataKeys.LegacyDid, {
      unqualifiedDid: didDoc.id,
      didDocumentString: JsonTransformer.serialize(didDoc),
    })

    this.logger.debug('Saving DID record', {
      id: didRecord.id,
      did: didRecord.did,
      role: didRecord.role,
      tags: didRecord.getTags(),
      didDocument: 'omitted...',
    })

    await this.didRepository.save(agentContext, didRecord)
    this.logger.debug('Did record created.', didRecord)
    return { did: peerDid, didDocument }
  }

  private createDidDoc(routing: DidCommRouting) {
    const recipientKeyBase58 = TypedArrayEncoder.toBase58(routing.recipientKey.publicKey.publicKey)
    const indyDid = utils.indyDidFromPublicKeyBase58(recipientKeyBase58)

    const keys: DidDocumentKey[] = [
      {
        didDocumentRelativeKeyId: '#1',
        kmsKeyId: routing.recipientKey.keyId,
      },
    ]

    const publicKey = new Ed25119Sig2018({
      id: `${indyDid}#1`,
      controller: indyDid,
      publicKeyBase58: recipientKeyBase58,
    })

    const auth = new ReferencedAuthentication(publicKey, authenticationTypes.Ed25519VerificationKey2018)

    // IndyAgentService is old service type
    const services = routing.endpoints.map(
      (endpoint, index) =>
        new IndyAgentService({
          id: `${indyDid}#IndyAgentService-${index + 1}`,
          serviceEndpoint: endpoint,
          recipientKeys: [recipientKeyBase58],
          routingKeys: routing.routingKeys.map((key) => TypedArrayEncoder.toBase58(key.publicKey.publicKey)),
          // Order of endpoint determines priority
          priority: index,
        })
    )

    return {
      didDoc: new DidDoc({
        id: indyDid,
        authentication: [auth],
        service: services,
        publicKey: [publicKey],
      }),
      keys,
    }
  }

  private createDidDocFromOutOfBandDidCommServices(outOfBandRecord: DidCommOutOfBandRecord) {
    const services = outOfBandRecord.outOfBandInvitation
      .getInlineServices()
      .map((service) => getResolvedDidcommServiceWithSigningKeyId(service, outOfBandRecord.invitationInlineServiceKeys))

    const [recipientKey] = services[0].recipientKeys
    const recipientKeyBase58 = TypedArrayEncoder.toBase58(recipientKey.publicKey.publicKey)
    const did = utils.indyDidFromPublicKeyBase58(recipientKeyBase58)

    const publicKey = new Ed25119Sig2018({
      id: `${did}#1`,
      controller: did,
      publicKeyBase58: recipientKeyBase58,
    })

    const auth = new ReferencedAuthentication(publicKey, authenticationTypes.Ed25519VerificationKey2018)

    // IndyAgentService is old service type
    const service = services.map(
      (service, index) =>
        new IndyAgentService({
          id: `${did}#IndyAgentService-${index + 1}`,
          serviceEndpoint: service.serviceEndpoint,
          recipientKeys: [recipientKeyBase58],
          routingKeys: service.routingKeys?.map((publicJwk) =>
            TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey)
          ),
          priority: index,
        })
    )

    return {
      didDoc: new DidDoc({
        id: did,
        authentication: [auth],
        service,
        publicKey: [publicKey],
      }),
      keys: [{ didDocumentRelativeKeyId: '#1', kmsKeyId: recipientKey.keyId }] satisfies DidDocumentKey[],
    }
  }

  public async returnWhenIsConnected(
    agentContext: AgentContext,
    connectionId: string,
    timeoutMs = 20000
  ): Promise<DidCommConnectionRecord> {
    const isConnected = (connection: DidCommConnectionRecord) => {
      return connection.id === connectionId && connection.state === DidCommDidExchangeState.Completed
    }

    const observable = this.eventEmitter.observable<DidCommConnectionStateChangedEvent>(
      DidCommConnectionEventTypes.DidCommConnectionStateChanged
    )
    const subject = new ReplaySubject<DidCommConnectionRecord>(1)

    observable
      .pipe(
        filterContextCorrelationId(agentContext.contextCorrelationId),
        map((e) => e.payload.connectionRecord),
        first(isConnected), // Do not wait for longer than specified timeout
        timeout({
          first: timeoutMs,
          meta: 'DidCommConnectionService.returnWhenIsConnected',
        })
      )
      .subscribe(subject)

    const connection = await this.getById(agentContext, connectionId)
    if (isConnected(connection)) {
      subject.next(connection)
    }

    return firstValueFrom(subject)
  }
}

export interface ConnectionProtocolMsgReturnType<MessageType extends DidCommMessage> {
  message: MessageType
  connectionRecord: DidCommConnectionRecord
}
