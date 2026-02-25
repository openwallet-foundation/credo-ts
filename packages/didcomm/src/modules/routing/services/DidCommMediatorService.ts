import type { AgentContext, Query, QueryOptions } from '@credo-ts/core'
import {
  CredoError,
  DidKey,
  didKeyToVerkey,
  EventEmitter,
  InjectionSymbols,
  inject,
  injectable,
  isDidKey,
  Kms,
  type Logger,
  RecordDuplicateError,
  TypedArrayEncoder,
  verkeyToDidKey,
} from '@credo-ts/core'
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
import type { DidCommForwardMessage, DidCommMediationRequestMessage } from '../messages'
import {
  DidCommKeylistUpdateAction,
  DidCommKeylistUpdated,
  DidCommKeylistUpdateMessage,
  DidCommKeylistUpdateResponseMessage,
  DidCommKeylistUpdateResult,
  DidCommMediationGrantMessage,
} from '../messages'
import { DidCommMediationRole } from '../models/DidCommMediationRole'
import { DidCommMediationState } from '../models/DidCommMediationState'
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

  public async processForwardMessage(
    messageContext: DidCommInboundMessageContext<DidCommForwardMessage>
  ): Promise<void> {
    const { message, agentContext } = messageContext

    const messagePickupApi = agentContext.resolve(DidCommMessagePickupApi)

    // TODO: update to class-validator validation
    if (!message.to) {
      throw new CredoError('Invalid Message: Missing required attribute "to"')
    }

    const mediationRecord = await this.mediationRepository.getSingleByRecipientKey(agentContext, message.to)

    // Assert mediation record is ready to be used
    mediationRecord.assertReady()
    mediationRecord.assertRole(DidCommMediationRole.Mediator)

    const connection = await this.connectionService.getById(agentContext, mediationRecord.connectionId)
    connection.assertReady()

    const messageForwardingStrategy =
      agentContext.dependencyManager.resolve(DidCommMediatorModuleConfig).messageForwardingStrategy
    const messageSender = agentContext.dependencyManager.resolve(DidCommMessageSender)

    switch (messageForwardingStrategy) {
      case DidCommMessageForwardingStrategy.QueueOnly:
        await messagePickupApi.queueMessage({
          connectionId: mediationRecord.connectionId,
          recipientDids: [verkeyToDidKey(message.to)],
          message: message.message,
        })
        break
      case DidCommMessageForwardingStrategy.QueueAndLiveModeDelivery: {
        await messagePickupApi.queueMessage({
          connectionId: mediationRecord.connectionId,
          recipientDids: [verkeyToDidKey(message.to)],
          message: message.message,
        })
        const session = await messagePickupApi.getLiveModeSession({
          connectionId: mediationRecord.connectionId,
          role: DidCommMessagePickupSessionRole.MessageHolder,
        })
        if (session) {
          await messagePickupApi.deliverMessagesFromQueue({
            pickupSessionId: session.id,
            recipientDid: verkeyToDidKey(message.to),
          })
        }
        break
      }
      case DidCommMessageForwardingStrategy.DirectDelivery:
        // The message inside the forward message is packed so we just send the packed
        // message to the connection associated with it
        await messageSender.sendPackage(agentContext, {
          connection,
          recipientKey: verkeyToDidKey(message.to),
          encryptedMessage: message.message,
        })
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
