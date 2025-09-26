import { AgentContext, Kms, Query, QueryOptions } from '@credo-ts/core'
import type { DidCommMessage } from '../../../DidCommMessage'
import type { DidCommInboundMessageContext, DidCommRouting } from '../../../models'
import type { DidCommConnectionRecord } from '../../connections/repository'
import type { DidCommKeylistUpdatedEvent, DidCommMediationStateChangedEvent } from '../DidCommRoutingEvents'
import type { DidCommMediationDenyMessage } from '../messages'
import type { GetRoutingOptions, RemoveRoutingOptions } from './DidCommRoutingService'

import {
  CredoError,
  DidKey,
  EventEmitter,
  TypedArrayEncoder,
  didKeyToVerkey,
  filterContextCorrelationId,
  injectable,
  isDidKey,
} from '@credo-ts/core'
import { ReplaySubject, firstValueFrom } from 'rxjs'
import { filter, first, timeout } from 'rxjs/operators'

import { DidCommMessageSender } from '../../../DidCommMessageSender'
import { DidCommModuleConfig } from '../../../DidCommModuleConfig'
import { DidCommOutboundMessageContext } from '../../../models'
import { DidCommConnectionType } from '../../connections/models/DidCommConnectionType'
import { DidCommConnectionMetadataKeys } from '../../connections/repository/DidCommConnectionMetadataTypes'
import { DidCommConnectionService } from '../../connections/services/DidCommConnectionService'
import { DidCommRoutingEventTypes } from '../DidCommRoutingEvents'
import {
  DidCommKeylistUpdateAction,
  DidCommKeylistUpdateResponseMessage,
  DidCommMediationGrantMessage,
  DidCommMediationRequestMessage,
} from '../messages'
import { DidCommKeylistUpdate, DidCommKeylistUpdateMessage } from '../messages/DidCommKeylistUpdateMessage'
import { DidCommMediationRole, DidCommMediationState } from '../models'
import { DidCommMediationRecord } from '../repository/DidCommMediationRecord'
import { DidCommMediationRepository } from '../repository/DidCommMediationRepository'

@injectable()
export class DidCommMediationRecipientService {
  private mediationRepository: DidCommMediationRepository
  private eventEmitter: EventEmitter
  private connectionService: DidCommConnectionService
  private messageSender: DidCommMessageSender

  public constructor(
    connectionService: DidCommConnectionService,
    messageSender: DidCommMessageSender,
    mediatorRepository: DidCommMediationRepository,
    eventEmitter: EventEmitter
  ) {
    this.mediationRepository = mediatorRepository
    this.eventEmitter = eventEmitter
    this.connectionService = connectionService
    this.messageSender = messageSender
  }

  public async createRequest(
    agentContext: AgentContext,
    connection: DidCommConnectionRecord
  ): Promise<MediationProtocolMsgReturnType<DidCommMediationRequestMessage>> {
    const message = new DidCommMediationRequestMessage({})

    const mediationRecord = new DidCommMediationRecord({
      threadId: message.threadId,
      state: DidCommMediationState.Requested,
      role: DidCommMediationRole.Recipient,
      connectionId: connection.id,
    })

    await this.connectionService.addConnectionType(agentContext, connection, DidCommConnectionType.Mediator)

    await this.mediationRepository.save(agentContext, mediationRecord)
    this.emitStateChangedEvent(agentContext, mediationRecord, null)

    return { mediationRecord, message }
  }

  public async processMediationGrant(messageContext: DidCommInboundMessageContext<DidCommMediationGrantMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    // Mediation record must already exists to be updated to granted status
    const mediationRecord = await this.mediationRepository.getByConnectionId(messageContext.agentContext, connection.id)

    // Assert
    mediationRecord.assertState(DidCommMediationState.Requested)
    mediationRecord.assertRole(DidCommMediationRole.Recipient)

    // Update record
    mediationRecord.endpoint = messageContext.message.endpoint

    // Update connection metadata to use their key format in further protocol messages
    const connectionUsesDidKey = messageContext.message.routingKeys.some(isDidKey)
    await this.updateUseDidKeysFlag(
      messageContext.agentContext,
      connection,
      DidCommMediationGrantMessage.type.protocolUri,
      connectionUsesDidKey
    )

    // According to RFC 0211 keys should be a did key, but base58 encoded verkey was used before
    // RFC was accepted. This converts the key to a public key base58 if it is a did key.
    mediationRecord.routingKeys = messageContext.message.routingKeys.map(didKeyToVerkey)
    return await this.updateState(messageContext.agentContext, mediationRecord, DidCommMediationState.Granted)
  }

  public async processKeylistUpdateResults(
    messageContext: DidCommInboundMessageContext<DidCommKeylistUpdateResponseMessage>
  ) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const mediationRecord = await this.mediationRepository.getByConnectionId(messageContext.agentContext, connection.id)

    // Assert
    mediationRecord.assertReady()
    mediationRecord.assertRole(DidCommMediationRole.Recipient)

    const keylist = messageContext.message.updated

    // Update connection metadata to use their key format in further protocol messages
    const connectionUsesDidKey = keylist.some((key) => isDidKey(key.recipientKey))
    await this.updateUseDidKeysFlag(
      messageContext.agentContext,
      connection,
      DidCommKeylistUpdateResponseMessage.type.protocolUri,
      connectionUsesDidKey
    )

    // update keylist in mediationRecord
    for (const update of keylist) {
      if (update.action === DidCommKeylistUpdateAction.add) {
        mediationRecord.addRecipientKey(didKeyToVerkey(update.recipientKey))
      } else if (update.action === DidCommKeylistUpdateAction.remove) {
        mediationRecord.removeRecipientKey(didKeyToVerkey(update.recipientKey))
      }
    }

    await this.mediationRepository.update(messageContext.agentContext, mediationRecord)
    this.eventEmitter.emit<DidCommKeylistUpdatedEvent>(messageContext.agentContext, {
      type: DidCommRoutingEventTypes.RecipientKeylistUpdated,
      payload: {
        mediationRecord,
        keylist,
      },
    })
  }

  public async keylistUpdateAndAwait(
    agentContext: AgentContext,
    mediationRecord: DidCommMediationRecord,
    updates: { recipientKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>; action: DidCommKeylistUpdateAction }[],
    timeoutMs = 15000 // TODO: this should be a configurable value in agent config
  ): Promise<DidCommMediationRecord> {
    const connection = await this.connectionService.getById(agentContext, mediationRecord.connectionId)

    // Use our useDidKey configuration unless we know the key formatting other party is using
    const didcommConfig = agentContext.dependencyManager.resolve(DidCommModuleConfig)

    let useDidKey = didcommConfig.useDidKeyInProtocols

    const useDidKeysConnectionMetadata = connection.metadata.get(DidCommConnectionMetadataKeys.UseDidKeysForProtocol)
    if (useDidKeysConnectionMetadata) {
      useDidKey = useDidKeysConnectionMetadata[DidCommKeylistUpdateMessage.type.protocolUri] ?? useDidKey
    }

    const message = this.createKeylistUpdateMessage(
      updates.map(
        (item) =>
          new DidCommKeylistUpdate({
            action: item.action,
            recipientKey: useDidKey
              ? new DidKey(item.recipientKey).did
              : TypedArrayEncoder.toBase58(item.recipientKey.publicKey.publicKey),
          })
      )
    )

    mediationRecord.assertReady()
    mediationRecord.assertRole(DidCommMediationRole.Recipient)

    // Create observable for event
    const observable = this.eventEmitter.observable<DidCommKeylistUpdatedEvent>(
      DidCommRoutingEventTypes.RecipientKeylistUpdated
    )
    const subject = new ReplaySubject<DidCommKeylistUpdatedEvent>(1)

    // Apply required filters to observable stream and create promise to subscribe to observable
    observable
      .pipe(
        filterContextCorrelationId(agentContext.contextCorrelationId),
        // Only take event for current mediation record
        filter((event) => mediationRecord.id === event.payload.mediationRecord.id),
        // Only wait for first event that matches the criteria
        first(),
        // Do not wait for longer than specified timeout
        timeout({
          first: timeoutMs,
          meta: 'DidCommMediationRecipientService.keylistUpdateAndAwait',
        })
      )
      .subscribe(subject)

    const outboundMessageContext = new DidCommOutboundMessageContext(message, { agentContext, connection })
    await this.messageSender.sendMessage(outboundMessageContext)

    const keylistUpdate = await firstValueFrom(subject)
    return keylistUpdate.payload.mediationRecord
  }

  public createKeylistUpdateMessage(updates: DidCommKeylistUpdate[]): DidCommKeylistUpdateMessage {
    const keylistUpdateMessage = new DidCommKeylistUpdateMessage({
      updates,
    })
    return keylistUpdateMessage
  }

  public async addMediationRouting(
    agentContext: AgentContext,
    routing: DidCommRouting,
    { mediatorId, useDefaultMediator = true }: GetRoutingOptions = {}
  ): Promise<DidCommRouting> {
    let mediationRecord: DidCommMediationRecord | null = null

    if (mediatorId) {
      mediationRecord = await this.getById(agentContext, mediatorId)
    } else if (useDefaultMediator) {
      // If no mediatorId is provided, and useDefaultMediator is true (default)
      // We use the default mediator if available
      mediationRecord = await this.findDefaultMediator(agentContext)
    }

    // Return early if no mediation record
    if (!mediationRecord) return routing

    // new did has been created and mediator needs to be updated with the public key.
    mediationRecord = await this.keylistUpdateAndAwait(agentContext, mediationRecord, [
      {
        recipientKey: routing.recipientKey,
        action: DidCommKeylistUpdateAction.add,
      },
    ])

    return {
      ...routing,
      mediatorId: mediationRecord.id,
      endpoints: mediationRecord.endpoint ? [mediationRecord.endpoint] : routing.endpoints,
      routingKeys: mediationRecord.routingKeys.map((key) =>
        Kms.PublicJwk.fromPublicKey({ kty: 'OKP', crv: 'Ed25519', publicKey: TypedArrayEncoder.fromBase58(key) })
      ),
    }
  }

  public async removeMediationRouting(
    agentContext: AgentContext,
    { recipientKeys, mediatorId }: RemoveRoutingOptions
  ): Promise<void> {
    const mediationRecord = await this.getById(agentContext, mediatorId)

    if (!mediationRecord) {
      throw new CredoError('No mediation record to remove routing from has been found')
    }

    await this.keylistUpdateAndAwait(
      agentContext,
      mediationRecord,
      recipientKeys.map((item) => {
        return {
          recipientKey: item,
          action: DidCommKeylistUpdateAction.remove,
        }
      })
    )
  }

  public async processMediationDeny(messageContext: DidCommInboundMessageContext<DidCommMediationDenyMessage>) {
    const connection = messageContext.assertReadyConnection()

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(messageContext.agentContext, connection.id)

    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`)
    }

    // Assert
    mediationRecord.assertRole(DidCommMediationRole.Recipient)
    mediationRecord.assertState(DidCommMediationState.Requested)

    // Update record
    await this.updateState(messageContext.agentContext, mediationRecord, DidCommMediationState.Denied)

    return mediationRecord
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param MediationRecord The proof record to update the state for
   * @param newState The state to update to
   *
   */
  private async updateState(
    agentContext: AgentContext,
    mediationRecord: DidCommMediationRecord,
    newState: DidCommMediationState
  ) {
    const previousState = mediationRecord.state
    mediationRecord.state = newState
    await this.mediationRepository.update(agentContext, mediationRecord)

    this.emitStateChangedEvent(agentContext, mediationRecord, previousState)
    return mediationRecord
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

  public async getById(agentContext: AgentContext, id: string): Promise<DidCommMediationRecord> {
    return this.mediationRepository.getById(agentContext, id)
  }

  public async findByConnectionId(
    agentContext: AgentContext,
    connectionId: string
  ): Promise<DidCommMediationRecord | null> {
    return this.mediationRepository.findSingleByQuery(agentContext, { connectionId })
  }

  public async getMediators(agentContext: AgentContext): Promise<DidCommMediationRecord[]> {
    return this.mediationRepository.getAll(agentContext)
  }

  public async findAllMediatorsByQuery(
    agentContext: AgentContext,
    query: Query<DidCommMediationRecord>,
    queryOptions?: QueryOptions
  ): Promise<DidCommMediationRecord[]> {
    return await this.mediationRepository.findByQuery(agentContext, query, queryOptions)
  }

  public async findDefaultMediator(agentContext: AgentContext): Promise<DidCommMediationRecord | null> {
    return this.mediationRepository.findSingleByQuery(agentContext, { default: true })
  }

  public async discoverMediation(
    agentContext: AgentContext,
    mediatorId?: string
  ): Promise<DidCommMediationRecord | undefined> {
    // If mediatorId is passed, always use it (and error if it is not found)
    if (mediatorId) {
      return this.mediationRepository.getById(agentContext, mediatorId)
    }

    const defaultMediator = await this.findDefaultMediator(agentContext)
    if (defaultMediator) {
      if (defaultMediator.state !== DidCommMediationState.Granted) {
        throw new CredoError(
          `Mediation State for ${defaultMediator.id} is not granted, but is set as default mediator!`
        )
      }

      return defaultMediator
    }
  }

  public async setDefaultMediator(agentContext: AgentContext, mediator: DidCommMediationRecord) {
    const mediationRecords = await this.mediationRepository.findByQuery(agentContext, { default: true })

    for (const record of mediationRecords) {
      record.setTag('default', false)
      await this.mediationRepository.update(agentContext, record)
    }

    // Set record coming in tag to true and then update.
    mediator.setTag('default', true)
    await this.mediationRepository.update(agentContext, mediator)
  }

  public async clearDefaultMediator(agentContext: AgentContext) {
    const mediationRecord = await this.findDefaultMediator(agentContext)

    if (mediationRecord) {
      mediationRecord.setTag('default', false)
      await this.mediationRepository.update(agentContext, mediationRecord)
    }
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

export interface MediationProtocolMsgReturnType<MessageType extends DidCommMessage> {
  message: MessageType
  mediationRecord: DidCommMediationRecord
}
