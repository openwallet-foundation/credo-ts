import type { AgentContext, Query, QueryOptions } from '@credo-ts/core'
import {
  CredoError,
  DidDocumentBuilder,
  DidDocumentService,
  DidKey,
  didDocumentToNumAlgo2Did,
  didKeyToVerkey,
  EventEmitter,
  getDidPeer4ShortFormForEquivalence,
  getEd25519VerificationKey2018,
  getX25519KeyAgreementKey2019,
  InjectionSymbols,
  inject,
  injectable,
  isDidKey,
  JsonTransformer,
  Kms,
  type Logger,
  RecordDuplicateError,
  RecordNotFoundError,
  TypedArrayEncoder,
  verkeyToDidKey,
} from '@credo-ts/core'
import { convertPublicKeyToX25519 } from '@stablelib/ed25519'
import { DidCommMessageSender } from '../../../DidCommMessageSender'
import { DidCommModuleConfig } from '../../../DidCommModuleConfig'
import type { DidCommInboundMessageContext } from '../../../models'
import type { DidCommConnectionRecord } from '../../connections/repository'
import { DidCommConnectionMetadataKeys } from '../../connections/repository/DidCommConnectionMetadataTypes'
import { DidCommConnectionService } from '../../connections/services'
import { DidCommMessagePickupApi } from '../../message-pickup'
import { DidCommMessagePickupSessionRole } from '../../message-pickup/DidCommMessagePickupSession'
import { DidCommMediatorModuleConfig } from '../DidCommMediatorModuleConfig'
import { DidCommMessageForwardingStrategy } from '../DidCommMessageForwardingStrategy'
import type { DidCommMediationStateChangedEvent } from '../DidCommRoutingEvents'
import { DidCommRoutingEventTypes } from '../DidCommRoutingEvents'
import { DidCommMediationRole } from '../models/DidCommMediationRole'
import { DidCommMediationState } from '../models/DidCommMediationState'
import type { DidCommForwardMessage, DidCommMediationRequestMessage } from '../protocol/v1/messages'
import {
  DidCommKeylistUpdateAction,
  DidCommKeylistUpdated,
  DidCommKeylistUpdateMessage,
  DidCommKeylistUpdateResponseMessage,
  DidCommKeylistUpdateResult,
  DidCommMediationGrantMessage,
} from '../protocol/v1/messages'
import {
  DidCommForwardV2Message,
  DidCommKeylistQueryV2Message,
  DidCommKeylistUpdateResponseV2Message,
  DidCommKeylistUpdateV2Message,
  DidCommKeylistV2Message,
  DidCommMediateGrantV2Message,
  DidCommMediateRequestV2Message,
  KeylistUpdateActionV2,
  KeylistUpdateResultV2,
} from '../protocol/v2/messages'
import { DidCommMediatorRoutingRecord } from '../repository'
import { DidCommMediationRecord } from '../repository/DidCommMediationRecord'
import { DidCommMediationRepository } from '../repository/DidCommMediationRepository'
import { DidCommMediatorRoutingRepository } from '../repository/DidCommMediatorRoutingRepository'

@injectable()
export class DidCommMediatorService {
  private logger: Logger
  private mediationRepository: DidCommMediationRepository
  private mediatorRoutingRepository: DidCommMediatorRoutingRepository
  private eventEmitter: EventEmitter
  private connectionService: DidCommConnectionService

  public constructor(
    mediationRepository: DidCommMediationRepository,
    mediatorRoutingRepository: DidCommMediatorRoutingRepository,
    eventEmitter: EventEmitter,
    @inject(InjectionSymbols.Logger) logger: Logger,
    connectionService: DidCommConnectionService
  ) {
    this.mediationRepository = mediationRepository
    this.mediatorRoutingRepository = mediatorRoutingRepository
    this.eventEmitter = eventEmitter
    this.logger = logger
    this.connectionService = connectionService
  }

  private async getRoutingKeys(agentContext: AgentContext) {
    const mediatorRoutingRecord = await this.findMediatorRoutingRecord(agentContext)

    if (mediatorRoutingRecord) {
      // Return the routing keys
      this.logger.debug(`Returning mediator routing keys ${mediatorRoutingRecord.routingKeys}`)
      return mediatorRoutingRecord.routingKeysWithKeyId
    }

    throw new CredoError('Mediator has not been initialized yet.')
  }

  /**
   * Returns the mediator routing DID to use for mediation v2 grants.
   * If mediatorRoutingDid is configured, use it. Otherwise create from routing record keys
   * so Forward messages can be decrypted by the mediator.
   */
  private async getEffectiveMediatorRoutingDid(agentContext: AgentContext): Promise<string> {
    const mediatorConfig = agentContext.dependencyManager.resolve(DidCommMediatorModuleConfig)
    if (mediatorConfig.mediatorRoutingDid) {
      return mediatorConfig.mediatorRoutingDid
    }

    const routingKeys = await this.getRoutingKeys(agentContext)
    if (routingKeys.length === 0) {
      throw new CredoError(
        'Cannot grant mediation v2: mediatorRoutingDid is not configured and routing record has no keys.'
      )
    }

    const didcommConfig = agentContext.dependencyManager.resolve(DidCommModuleConfig)
    const wsEndpoint =
      didcommConfig.endpoints.find((e) => e.startsWith('ws://') || e.startsWith('wss://')) ?? didcommConfig.endpoints[0]

    const routingKey = routingKeys[0]
    if (!routingKey.is(Kms.Ed25519PublicJwk)) {
      throw new CredoError('Mediator routing key must be Ed25519 for did:peer:2 creation.')
    }

    // DIDComm v2 Forward messages encrypt to a keyAgreement (X25519) key, not an authentication
    // (Ed25519) key. Convert the routing key so the mediator can decrypt inbound forwards.
    const x25519PublicKey = convertPublicKeyToX25519(routingKey.publicKey.publicKey)
    const x25519Jwk = Kms.PublicJwk.fromPublicKey({ kty: 'OKP', crv: 'X25519', publicKey: x25519PublicKey })
    const verificationMethod = getX25519KeyAgreementKey2019({
      id: 'did:peer:2-placeholder#key-1',
      publicJwk: x25519Jwk,
      controller: 'did:peer:2-placeholder',
    })

    // Also include the Ed25519 authentication key so that v1 agents (which use Ed25519
    // routing keys for Forward message encryption) can find it when resolving the routing DID.
    // Without this, the routing DID only contains an X25519 keyAgreement key, which causes
    // v1 Forward packing to produce a kid the mediator can't look up.
    const ed25519VerificationMethod = getEd25519VerificationKey2018({
      id: 'did:peer:2-placeholder#key-2',
      publicJwk: routingKey,
      controller: 'did:peer:2-placeholder',
    })

    const didDocumentBuilder = new DidDocumentBuilder('did:peer:2-placeholder')
    didDocumentBuilder.addAuthentication(ed25519VerificationMethod)
    didDocumentBuilder.addKeyAgreement(verificationMethod)
    // Use DIDCommMessaging + string endpoint so abbreviate produces t:'dm', s:endpoint for parser compatibility
    const service = JsonTransformer.fromJSON(
      { id: '#dm-0', type: 'DIDCommMessaging', serviceEndpoint: wsEndpoint },
      DidDocumentService
    )
    didDocumentBuilder.addService(service)

    const didDocument = didDocumentBuilder.build()
    const did = didDocumentToNumAlgo2Did(didDocument)
    this.logger.debug('Created mediator routing DID from routing record', { did })

    // NOTE: We intentionally do NOT import this routing DID into the DID store.
    // For v1 Forward decryption, the mediator routing record (Path 2 in
    // extractOurRecipientKeyWithKeyId) correctly resolves the Ed25519 key and
    // its KMS key ID from DidCommMediatorRoutingRecord. Importing would require
    // complex VM-to-KMS key mapping that is fragile across did:peer:2 round-trips.
    // For v2 Forward decryption (future), a separate DID import with proper
    // X25519 key mapping can be added when needed.

    return did
  }

  public async processForwardMessage(
    messageContext: DidCommInboundMessageContext<DidCommForwardMessage | DidCommForwardV2Message>
  ): Promise<void> {
    const { message, agentContext } = messageContext

    const messagePickupApi = agentContext.resolve(DidCommMessagePickupApi)

    let recipientDid: string
    let encryptedMessage: import('../../../types').DidCommEncryptedMessage
    let mediationRecord: DidCommMediationRecord | null

    if (message instanceof DidCommForwardV2Message) {
      if (!message.next) {
        throw new CredoError('Invalid v2 Forward: Missing required attribute "next"')
      }
      const attachment = message.getMessage()
      if (!attachment) {
        throw new CredoError('Invalid v2 Forward: Missing or empty attachment')
      }
      encryptedMessage = attachment
      // v2 `next` is always a DID; canonicalize did:peer:4 long→short so it matches keylist entries
      recipientDid = getDidPeer4ShortFormForEquivalence(message.next) ?? message.next
      mediationRecord = await this.mediationRepository.findSingleByRecipientDid(agentContext, recipientDid)
    } else {
      if (!message.to) {
        throw new CredoError('Invalid v1 Forward: Missing required attribute "to"')
      }
      encryptedMessage = message.message
      const rawDid = message.to.startsWith('did:') ? message.to : verkeyToDidKey(message.to)
      recipientDid = getDidPeer4ShortFormForEquivalence(rawDid) ?? rawDid
      mediationRecord =
        (await this.mediationRepository.findSingleByRecipientKey(agentContext, message.to)) ??
        (await this.mediationRepository.findSingleByRecipientDid(agentContext, recipientDid))
    }

    if (!mediationRecord) {
      throw new RecordNotFoundError(`MediationRecord: no record found for forward message recipient`, {
        recordType: DidCommMediationRecord.type,
      })
    }

    mediationRecord.assertReady()
    mediationRecord.assertRole(DidCommMediationRole.Mediator)

    const connection = await this.connectionService.getById(agentContext, mediationRecord.connectionId)
    connection.assertReady()

    const messageForwardingStrategy =
      agentContext.dependencyManager.resolve(DidCommMediatorModuleConfig).messageForwardingStrategy

    switch (messageForwardingStrategy) {
      case DidCommMessageForwardingStrategy.QueueOnly:
        await messagePickupApi.queueMessage({
          connectionId: mediationRecord.connectionId,
          recipientDids: [recipientDid],
          message: encryptedMessage,
        })
        break
      case DidCommMessageForwardingStrategy.QueueAndLiveModeDelivery: {
        await messagePickupApi.queueMessage({
          connectionId: mediationRecord.connectionId,
          recipientDids: [recipientDid],
          message: encryptedMessage,
        })
        const session = await messagePickupApi.getLiveModeSession({
          connectionId: mediationRecord.connectionId,
          role: DidCommMessagePickupSessionRole.MessageHolder,
        })
        if (session) {
          await messagePickupApi.deliverMessagesFromQueue({
            pickupSessionId: session.id,
            recipientDid,
          })
        }
        break
      }
      case DidCommMessageForwardingStrategy.DirectDelivery: {
        const messageSender = agentContext.dependencyManager.resolve(DidCommMessageSender)
        await messageSender.sendPackage(agentContext, {
          connection,
          recipientKey: recipientDid,
          encryptedMessage,
        })
      }
    }
  }

  public async processKeylistUpdateRequest(messageContext: DidCommInboundMessageContext<DidCommKeylistUpdateMessage>) {
    // Assert Ready connection
    const connection = messageContext.assertReadyConnection()

    const { message } = messageContext
    const keylist: DidCommKeylistUpdated[] = []

    const mediationRecord = await this.mediationRepository.getByConnectionId(messageContext.agentContext, connection.id)

    mediationRecord.assertReady()
    mediationRecord.assertRole(DidCommMediationRole.Mediator)

    // Update connection metadata to use their key format in further protocol messages
    const connectionUsesDidKey = message.updates.some((update) => isDidKey(update.recipientKey))
    await this.updateUseDidKeysFlag(
      messageContext.agentContext,
      connection,
      DidCommKeylistUpdateMessage.type.protocolUri,
      connectionUsesDidKey
    )

    for (const update of message.updates) {
      const updated = new DidCommKeylistUpdated({
        action: update.action,
        recipientKey: update.recipientKey,
        result: DidCommKeylistUpdateResult.NoChange,
      })

      // According to RFC 0211 key should be a did key, but base58 encoded verkey was used before
      // RFC was accepted. This converts the key to a public key base58 if it is a did key.
      const publicKeyBase58 = didKeyToVerkey(update.recipientKey)

      if (update.action === DidCommKeylistUpdateAction.add) {
        mediationRecord.addRecipientKey(publicKeyBase58)
        updated.result = DidCommKeylistUpdateResult.Success

        keylist.push(updated)
      } else if (update.action === DidCommKeylistUpdateAction.remove) {
        const success = mediationRecord.removeRecipientKey(publicKeyBase58)
        updated.result = success ? DidCommKeylistUpdateResult.Success : DidCommKeylistUpdateResult.NoChange
        keylist.push(updated)
      }
    }

    await this.mediationRepository.update(messageContext.agentContext, mediationRecord)

    return new DidCommKeylistUpdateResponseMessage({ keylist, threadId: message.threadId })
  }

  public async createGrantMediationMessage(agentContext: AgentContext, mediationRecord: DidCommMediationRecord) {
    // Assert
    mediationRecord.assertState(DidCommMediationState.Requested)
    mediationRecord.assertRole(DidCommMediationRole.Mediator)

    await this.updateState(agentContext, mediationRecord, DidCommMediationState.Granted)

    // Use our useDidKey configuration, as this is the first interaction for this protocol
    const didcommConfig = agentContext.dependencyManager.resolve(DidCommModuleConfig)
    const useDidKey = didcommConfig.useDidKeyInProtocols

    const routingKeys = (await this.getRoutingKeys(agentContext)).map((routingKey) =>
      useDidKey ? new DidKey(routingKey).did : TypedArrayEncoder.toBase58(routingKey.publicKey.publicKey)
    )

    const message = new DidCommMediationGrantMessage({
      endpoint: didcommConfig.endpoints[0],
      routingKeys,
      threadId: mediationRecord.threadId,
    })

    return { mediationRecord, message }
  }

  public async processMediationRequest(messageContext: DidCommInboundMessageContext<DidCommMediationRequestMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const mediationRecord = new DidCommMediationRecord({
      connectionId: connection.id,
      role: DidCommMediationRole.Mediator,
      state: DidCommMediationState.Requested,
      threadId: messageContext.message.threadId,
    })

    await this.mediationRepository.save(messageContext.agentContext, mediationRecord)
    this.emitStateChangedEvent(messageContext.agentContext, mediationRecord, null)

    return mediationRecord
  }

  public async processMediationRequestV2(
    messageContext: DidCommInboundMessageContext<DidCommMediateRequestV2Message>
  ): Promise<{ mediationRecord: DidCommMediationRecord; connection: DidCommConnectionRecord }> {
    let connection = messageContext.connection

    // Fallback: resolve by sender DID/sender key when connection wasn't attached (e.g. mediate-request
    // arrives before ack is processed, or findConnection failed). findByTheirDidOrSender tries exact
    // match, alternative DID forms, and sender key → DidRecord → connection. Use senderDid from
    // context (plaintext before transform) since message.from may be lost in JsonTransformer.
    const from = messageContext.senderDid ?? messageContext.message.from
    if (!connection && (from || messageContext.senderKey)) {
      connection =
        (await this.connectionService.findByTheirDidOrSender(messageContext.agentContext, {
          theirDid: from,
          senderKey: messageContext.senderKey,
        })) ?? undefined
    }

    if (!connection) {
      throw new CredoError(`No connection associated with incoming message ${messageContext.message.type}`)
    }

    connection.assertReady()

    const mediationRecord = new DidCommMediationRecord({
      connectionId: connection.id,
      role: DidCommMediationRole.Mediator,
      state: DidCommMediationState.Requested,
      threadId: messageContext.message.threadId,
      mediationProtocolVersion: 'v2',
    })

    await this.mediationRepository.save(messageContext.agentContext, mediationRecord)
    this.emitStateChangedEvent(messageContext.agentContext, mediationRecord, null)

    return { mediationRecord, connection }
  }

  public async createGrantMediationMessageV2(
    agentContext: AgentContext,
    mediationRecord: DidCommMediationRecord
  ): Promise<{ mediationRecord: DidCommMediationRecord; message: DidCommMediateGrantV2Message }> {
    mediationRecord.assertState(DidCommMediationState.Requested)
    mediationRecord.assertRole(DidCommMediationRole.Mediator)

    const routingDid = await this.getEffectiveMediatorRoutingDid(agentContext)

    await this.updateState(agentContext, mediationRecord, DidCommMediationState.Granted)
    mediationRecord.routingDid = routingDid
    await this.mediationRepository.update(agentContext, mediationRecord)

    const message = new DidCommMediateGrantV2Message({
      routingDid,
      threadId: mediationRecord.threadId,
    })

    return { mediationRecord, message }
  }

  public async processKeylistUpdateV2(
    messageContext: DidCommInboundMessageContext<DidCommKeylistUpdateV2Message>
  ): Promise<DidCommKeylistUpdateResponseV2Message> {
    const connection = messageContext.assertReadyConnection()
    const { message } = messageContext

    const mediationRecord = await this.mediationRepository.getByConnectionId(messageContext.agentContext, connection.id)
    mediationRecord.assertReady()
    mediationRecord.assertRole(DidCommMediationRole.Mediator)
    if (mediationRecord.mediationProtocolVersion !== 'v2') {
      throw new CredoError('Keylist update v2 requires mediation protocol version 2.0')
    }

    const updated: Array<{
      recipientDid: string
      action: KeylistUpdateActionV2
      result: KeylistUpdateResultV2
    }> = []

    for (const update of message.updates) {
      let result = KeylistUpdateResultV2.NoChange
      const canonicalRecipientDid = getDidPeer4ShortFormForEquivalence(update.recipientDid) ?? update.recipientDid
      if (update.action === KeylistUpdateActionV2.add) {
        mediationRecord.addRecipientDid(canonicalRecipientDid)
        result = KeylistUpdateResultV2.Success
      } else if (update.action === KeylistUpdateActionV2.remove) {
        const success = mediationRecord.removeRecipientDid(canonicalRecipientDid)
        result = success ? KeylistUpdateResultV2.Success : KeylistUpdateResultV2.NoChange
      }
      updated.push({ recipientDid: update.recipientDid, action: update.action, result })
    }

    await this.mediationRepository.update(messageContext.agentContext, mediationRecord)

    return new DidCommKeylistUpdateResponseV2Message({
      updated: updated.map((u) => ({
        recipientDid: u.recipientDid,
        action: u.action,
        result: u.result,
      })),
      threadId: message.threadId,
    })
  }

  public async processKeylistQueryV2(
    messageContext: DidCommInboundMessageContext<DidCommKeylistQueryV2Message>
  ): Promise<DidCommKeylistV2Message> {
    const connection = messageContext.assertReadyConnection()
    const { message } = messageContext

    const mediationRecord = await this.mediationRepository.getByConnectionId(messageContext.agentContext, connection.id)
    mediationRecord.assertReady()
    mediationRecord.assertRole(DidCommMediationRole.Mediator)
    if (mediationRecord.mediationProtocolVersion !== 'v2') {
      throw new CredoError('Keylist query v2 requires mediation protocol version 2.0')
    }

    const recipientDids = mediationRecord.recipientDids ?? []
    const paginate = message.paginate
    let keys = recipientDids.map((did) => ({ recipientDid: did }))
    let pagination: { count: number; offset: number; remaining: number } | undefined

    if (paginate) {
      const offset = paginate.offset
      const limit = paginate.limit
      keys = keys.slice(offset, offset + limit)
      pagination = {
        count: keys.length,
        offset,
        remaining: Math.max(0, recipientDids.length - offset - limit),
      }
    }

    return new DidCommKeylistV2Message({
      keys,
      pagination,
      threadId: message.threadId,
    })
  }

  public async findById(agentContext: AgentContext, mediatorRecordId: string): Promise<DidCommMediationRecord | null> {
    return this.mediationRepository.findById(agentContext, mediatorRecordId)
  }

  public async getById(agentContext: AgentContext, mediatorRecordId: string): Promise<DidCommMediationRecord> {
    return this.mediationRepository.getById(agentContext, mediatorRecordId)
  }

  public async getAll(agentContext: AgentContext): Promise<DidCommMediationRecord[]> {
    return await this.mediationRepository.getAll(agentContext)
  }

  public async findMediatorRoutingRecord(agentContext: AgentContext): Promise<DidCommMediatorRoutingRecord | null> {
    const routingRecord = await this.mediatorRoutingRepository.findById(
      agentContext,
      this.mediatorRoutingRepository.MEDIATOR_ROUTING_RECORD_ID
    )

    return routingRecord
  }

  public async createMediatorRoutingRecord(agentContext: AgentContext): Promise<DidCommMediatorRoutingRecord | null> {
    const kms = agentContext.resolve(Kms.KeyManagementApi)
    const didcommConfig = agentContext.resolve(DidCommModuleConfig)

    const routingKey = await kms.createKey({
      type: {
        kty: 'OKP',
        crv: 'Ed25519',
      },
    })
    const publicJwk = Kms.PublicJwk.fromPublicJwk(routingKey.publicJwk)

    const routingRecord = new DidCommMediatorRoutingRecord({
      id: this.mediatorRoutingRepository.MEDIATOR_ROUTING_RECORD_ID,
      routingKeys: [
        {
          routingKeyFingerprint: publicJwk.fingerprint,
          kmsKeyId: routingKey.keyId,
        },
      ],
    })

    try {
      await this.mediatorRoutingRepository.save(agentContext, routingRecord)
      this.eventEmitter.emit(agentContext, {
        type: DidCommRoutingEventTypes.RoutingCreatedEvent,
        payload: {
          routing: {
            endpoints: didcommConfig.endpoints,
            routingKeys: [],
            recipientKey: routingKey,
          },
        },
      })
    } catch (error) {
      // This addresses some race conditions issues where we first check if the record exists
      // then we create one if it doesn't, but another process has created one in the meantime
      // Although not the most elegant solution, it addresses the issues
      if (error instanceof RecordDuplicateError) {
        // the record already exists, which is our intended end state
        // we can ignore this error and fetch the existing record
        return this.mediatorRoutingRepository.getById(
          agentContext,
          this.mediatorRoutingRepository.MEDIATOR_ROUTING_RECORD_ID
        )
      }
      throw error
    }

    return routingRecord
  }

  public async findAllByQuery(
    agentContext: AgentContext,
    query: Query<DidCommMediationRecord>,
    queryOptions?: QueryOptions
  ): Promise<DidCommMediationRecord[]> {
    return await this.mediationRepository.findByQuery(agentContext, query, queryOptions)
  }

  private async updateState(
    agentContext: AgentContext,
    mediationRecord: DidCommMediationRecord,
    newState: DidCommMediationState
  ) {
    const previousState = mediationRecord.state

    mediationRecord.state = newState

    await this.mediationRepository.update(agentContext, mediationRecord)

    this.emitStateChangedEvent(agentContext, mediationRecord, previousState)
  }

  private emitStateChangedEvent(
    agentContext: AgentContext,
    mediationRecord: DidCommMediationRecord,
    previousState: DidCommMediationState | null
  ) {
    this.eventEmitter.emit<DidCommMediationStateChangedEvent>(agentContext, {
      type: DidCommRoutingEventTypes.MediationStateChanged,
      payload: {
        mediationRecord: mediationRecord.clone(),
        previousState,
      },
    })
  }

  private async updateUseDidKeysFlag(
    agentContext: AgentContext,
    connection: DidCommConnectionRecord,
    protocolUri: string,
    connectionUsesDidKey: boolean
  ) {
    const useDidKeysForProtocol = connection.metadata.get(DidCommConnectionMetadataKeys.UseDidKeysForProtocol) ?? {}
    useDidKeysForProtocol[protocolUri] = connectionUsesDidKey
    connection.metadata.set(DidCommConnectionMetadataKeys.UseDidKeysForProtocol, useDidKeysForProtocol)
    await this.connectionService.update(agentContext, connection)
  }
}
