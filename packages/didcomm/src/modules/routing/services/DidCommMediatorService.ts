import type { AgentContext, Query, QueryOptions } from '@credo-ts/core'
import {
  CredoError,
  DidDocumentBuilder,
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
  Kms,
  type Logger,
  NewDidCommV2Service,
  NewDidCommV2ServiceEndpoint,
  RecordDuplicateError,
  RecordNotFoundError,
  TypedArrayEncoder,
  verkeyToDidKey,
} from '@credo-ts/core'
import { DidCommMessageSender } from '../../../DidCommMessageSender'
import { DidCommModuleConfig } from '../../../DidCommModuleConfig'
import { DidCommTransportService } from '../../../DidCommTransportService'
import { MessageSendingError } from '../../../errors'
import type { DidCommInboundMessageContext } from '../../../models'
import type { DidCommConnectionRecord } from '../../connections/repository'
import { DidCommConnectionMetadataKeys } from '../../connections/repository/DidCommConnectionMetadataTypes'
import { DidCommConnectionService } from '../../connections/services'
import { DidCommMessagePickupApi, DidCommMessagePickupSessionService } from '../../message-pickup'
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

// A CredoError, so storage services rethrow it from updateByIdWithLock without wrapping it
class V2RoutingKeyAlreadyStoredError extends CredoError {
  public constructor() {
    super('Mediator routing record already has an X25519 routing key')
  }
}

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
      const routingKeys = mediatorRoutingRecord.routingKeysWithKeyId
      this.logger.debug(`Returning mediator routing keys ${routingKeys.map((key) => key.fingerprint)}`)
      return routingKeys
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

    // DIDComm v2 forwards encrypt to a keyAgreement key. The KMS does not derive an X25519 key from the
    // Ed25519 routing key, so the routing record holds a separate X25519 key for v2.
    const x25519RoutingKey = routingKeys.find((routingKey): routingKey is Kms.PublicJwk<Kms.X25519PublicJwk> =>
      routingKey.is(Kms.X25519PublicJwk)
    )
    if (!x25519RoutingKey) {
      throw new CredoError('Cannot grant mediation v2: the mediator routing record has no X25519 routing key.')
    }
    const verificationMethod = getX25519KeyAgreementKey2019({
      id: 'did:peer:2-placeholder#key-1',
      publicJwk: x25519RoutingKey,
      controller: 'did:peer:2-placeholder',
    })

    const didDocumentBuilder = new DidDocumentBuilder('did:peer:2-placeholder')

    // Also include the Ed25519 authentication key so that v1 agents (which use Ed25519
    // routing keys for Forward message encryption) can find it when resolving the routing DID.
    // Without this, the routing DID only contains an X25519 keyAgreement key, which causes
    // v1 Forward packing to produce a kid the mediator can't look up.
    const ed25519RoutingKey = routingKeys.find((routingKey): routingKey is Kms.PublicJwk<Kms.Ed25519PublicJwk> =>
      routingKey.is(Kms.Ed25519PublicJwk)
    )
    if (ed25519RoutingKey) {
      didDocumentBuilder.addAuthentication(
        getEd25519VerificationKey2018({
          id: 'did:peer:2-placeholder#key-2',
          publicJwk: ed25519RoutingKey,
          controller: 'did:peer:2-placeholder',
        })
      )
    }
    didDocumentBuilder.addKeyAgreement(verificationMethod)
    didDocumentBuilder.addService(
      new NewDidCommV2Service({ id: '#dm-0', serviceEndpoint: new NewDidCommV2ServiceEndpoint({ uri: wsEndpoint }) })
    )

    const didDocument = didDocumentBuilder.build()
    const did = didDocumentToNumAlgo2Did(didDocument)
    this.logger.debug('Created mediator routing DID from routing record', { did })

    // NOTE: We intentionally do NOT import this routing DID into the DID store.
    // For v1 Forward decryption, the mediator routing record (Path 2 in
    // extractOurRecipientKeyWithKeyId) correctly resolves the Ed25519 key and
    // its KMS key ID from DidCommMediatorRoutingRecord. Importing would require
    // complex VM-to-KMS key mapping that is fragile across did:peer:2 round-trips.

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
          try {
            await messagePickupApi.deliverMessagesFromQueue({
              pickupSessionId: session.id,
              recipientDid,
            })
          } catch (error) {
            const sessionService = agentContext.dependencyManager.resolve(DidCommMessagePickupSessionService)
            const endSession =
              error instanceof MessageSendingError &&
              sessionService.getLiveSession(agentContext, session.id) !== undefined
            this.logger.warn(
              `Live mode delivery failed for connection '${mediationRecord.connectionId}'${endSession ? ', ending its live mode session' : ''}`,
              { error: error.message }
            )
            if (endSession) {
              sessionService.removeLiveSession(agentContext, { connectionId: mediationRecord.connectionId })
              // a Credo recipient only restarts pickup when its socket closes
              try {
                await agentContext.dependencyManager
                  .resolve(DidCommTransportService)
                  .findSessionById(session.transportSessionId)
                  ?.close()
              } catch (closeError) {
                this.logger.warn(
                  `Unable to close the transport session of connection '${mediationRecord.connectionId}'`,
                  { error: closeError.message }
                )
              }
            }
          }
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

    // DIDComm v1 forwards encrypt to the Ed25519 routing key, the X25519 key only serves DIDComm v2
    const routingKeys = (await this.getRoutingKeys(agentContext))
      .filter((routingKey) => routingKey.is(Kms.Ed25519PublicJwk))
      .map((routingKey) =>
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
    // match, alternative DID forms, and sender key → DidRecord → connection. Only the authenticated
    // senderDid is used, message.from is whatever the sender wrote.
    const from = messageContext.senderDid
    const senderKey = messageContext.senderKeyAgreementKey ?? messageContext.senderKey
    if (!connection && (from || senderKey)) {
      connection =
        (await this.connectionService.findByTheirDidOrSender(messageContext.agentContext, {
          theirDid: from,
          senderKey,
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
      protocolVersion: 'v2',
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
    if (mediationRecord.protocolVersion !== 'v2') {
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
    if (mediationRecord.protocolVersion !== 'v2') {
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
        // DIDComm v2 forwards encrypt to an X25519 key, which the KMS does not derive from the Ed25519 key
        ...(didcommConfig.isSupported('v2') ? [await this.createV2RoutingKey(agentContext)] : []),
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
        for (const { keyId } of routingRecord.routingKeysWithKeyId) {
          try {
            await kms.deleteKey({ keyId })
          } catch (error) {
            this.logger.warn(`Unable to delete unused mediator routing key '${keyId}'`, { error })
          }
        }

        return this.mediatorRoutingRepository.getById(
          agentContext,
          this.mediatorRoutingRepository.MEDIATOR_ROUTING_RECORD_ID
        )
      }
      throw error
    }

    return routingRecord
  }

  /**
   * Add an X25519 routing key for DIDComm v2 to a routing record that has none, such as a record
   * created before the mediator supported DIDComm v2. Does nothing when DIDComm v2 is not supported.
   */
  public async addV2RoutingKeyIfMissing(
    agentContext: AgentContext,
    routingRecord: DidCommMediatorRoutingRecord
  ): Promise<DidCommMediatorRoutingRecord> {
    const didcommConfig = agentContext.resolve(DidCommModuleConfig)
    if (!didcommConfig.isSupported('v2')) return routingRecord
    if (this.getV2RoutingKeys(routingRecord).length > 0) return routingRecord

    this.logger.debug('Mediator routing record has no X25519 routing key, adding one for DIDComm v2')
    // Created outside the lock, as Askar on SQLite cannot store the key while the lock transaction is open
    const v2RoutingKey = await this.createV2RoutingKey(agentContext)
    try {
      await this.mediatorRoutingRepository.updateByIdWithLock(agentContext, routingRecord.id, async (record) => {
        // Throwing skips the write, so a storage without a lock never writes an old copy of the record back
        if (this.getV2RoutingKeys(record).length > 0) throw new V2RoutingKeyAlreadyStoredError()
        record.routingKeys = [...record.routingKeys, v2RoutingKey]
        return record
      })
    } catch (error) {
      if (!(error instanceof V2RoutingKeyAlreadyStoredError)) {
        await this.deleteUnusedRoutingKey(agentContext, v2RoutingKey.kmsKeyId)
        throw error
      }
    }

    // Without a lock another instance can still overwrite the record after this write
    const storedRecord = await this.mediatorRoutingRepository.getById(agentContext, routingRecord.id)
    const storedV2RoutingKeys = this.getV2RoutingKeys(storedRecord)
    if (!storedV2RoutingKeys.some((routingKey) => routingKey.keyId === v2RoutingKey.kmsKeyId)) {
      await this.deleteUnusedRoutingKey(agentContext, v2RoutingKey.kmsKeyId)
    }
    if (storedV2RoutingKeys.length > 1) {
      this.logger.warn('Mediator routing record has more than one X25519 routing key, DIDComm v2 uses the first one')
    }

    return storedRecord
  }

  private getV2RoutingKeys(routingRecord: DidCommMediatorRoutingRecord): Kms.PublicJwk[] {
    return routingRecord.routingKeysWithKeyId.filter((routingKey) => routingKey.is(Kms.X25519PublicJwk))
  }

  private async deleteUnusedRoutingKey(agentContext: AgentContext, keyId: string): Promise<void> {
    try {
      await agentContext.resolve(Kms.KeyManagementApi).deleteKey({ keyId })
    } catch (error) {
      this.logger.warn(`Unable to delete unused mediator routing key '${keyId}'`, { error })
    }
  }

  private async createV2RoutingKey(
    agentContext: AgentContext
  ): Promise<{ routingKeyFingerprint: string; kmsKeyId: string }> {
    const kms = agentContext.resolve(Kms.KeyManagementApi)
    const routingKey = await kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })
    return {
      routingKeyFingerprint: Kms.PublicJwk.fromPublicJwk(routingKey.publicJwk).fingerprint,
      kmsKeyId: routingKey.keyId,
    }
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
