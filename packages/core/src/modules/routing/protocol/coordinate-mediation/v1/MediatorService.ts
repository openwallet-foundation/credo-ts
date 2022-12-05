import type { AgentContext } from '../../../../../agent'
import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { ConnectionRecord } from '../../../../connections'
import type { MediationRequestMessage } from './messages'

import { Dispatcher } from '../../../../../agent/Dispatcher'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { MessageSender } from '../../../../../agent/MessageSender'
import { InjectionSymbols } from '../../../../../constants'
import { Logger } from '../../../../../logger'
import { injectable, inject } from '../../../../../plugins'
import { ConnectionService } from '../../../../connections'
import { ConnectionMetadataKeys } from '../../../../connections/repository/ConnectionMetadataTypes'
import { didKeyToVerkey, isDidKey, verkeyToDidKey } from '../../../../dids/helpers'
import { MediatorModuleConfig } from '../../../MediatorModuleConfig'
import { MediationRole } from '../../../models/MediationRole'
import { MediationState } from '../../../models/MediationState'
import { MediationRecord } from '../../../repository/MediationRecord'
import { MediationRepository } from '../../../repository/MediationRepository'
import { MediatorRoutingRepository } from '../../../repository/MediatorRoutingRepository'
import { MediatorSharedService } from '../MediatorSharedService'

import { KeylistUpdateHandler, MediationRequestHandler } from './handlers'
import {
  KeylistUpdateMessage,
  KeylistUpdateAction,
  KeylistUpdated,
  KeylistUpdateResponseMessage,
  KeylistUpdateResult,
  MediationGrantMessage,
} from './messages'

@injectable()
export class MediatorService extends MediatorSharedService {
  public constructor(
    mediationRepository: MediationRepository,
    mediatorRoutingRepository: MediatorRoutingRepository,
    eventEmitter: EventEmitter,
    @inject(InjectionSymbols.Logger) logger: Logger,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    dispatcher: Dispatcher,
    mediatorModuleConfig: MediatorModuleConfig
  ) {
    super(
      mediationRepository,
      connectionService,
      mediatorRoutingRepository,
      eventEmitter,
      logger,
      messageSender,
      dispatcher,
      mediatorModuleConfig
    )

    this.registerHandlers()
  }

  public async processKeylistUpdateRequest(messageContext: InboundMessageContext<KeylistUpdateMessage>) {
    // Assert Ready connection
    const connection = messageContext.assertReadyConnection()

    const { message } = messageContext
    const keylist: KeylistUpdated[] = []

    const mediationRecord = await this.mediationRepository.getByConnectionId(messageContext.agentContext, connection.id)

    mediationRecord.assertReady()
    mediationRecord.assertRole(MediationRole.Mediator)

    // Update connection metadata to use their key format in further protocol messages
    const connectionUsesDidKey = message.updates.some((update) => isDidKey(update.recipientKey))
    await this.updateUseDidKeysFlag(
      messageContext.agentContext,
      connection,
      KeylistUpdateMessage.type.protocolUri,
      connectionUsesDidKey
    )

    for (const update of message.updates) {
      const updated = new KeylistUpdated({
        action: update.action,
        recipientKey: update.recipientKey,
        result: KeylistUpdateResult.NoChange,
      })

      // According to RFC 0211 key should be a did key, but base58 encoded verkey was used before
      // RFC was accepted. This converts the key to a public key base58 if it is a did key.
      const publicKeyBase58 = didKeyToVerkey(update.recipientKey)

      if (update.action === KeylistUpdateAction.add) {
        mediationRecord.addRecipientKey(publicKeyBase58)
        updated.result = KeylistUpdateResult.Success

        keylist.push(updated)
      } else if (update.action === KeylistUpdateAction.remove) {
        const success = mediationRecord.removeRecipientKey(publicKeyBase58)
        updated.result = success ? KeylistUpdateResult.Success : KeylistUpdateResult.NoChange
        keylist.push(updated)
      }
    }

    await this.mediationRepository.update(messageContext.agentContext, mediationRecord)

    return new KeylistUpdateResponseMessage({ keylist, threadId: message.threadId })
  }

  public async createGrantMediationMessage(agentContext: AgentContext, mediationRecord: MediationRecord) {
    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertRole(MediationRole.Mediator)

    await this.updateState(agentContext, mediationRecord, MediationState.Granted)

    // Use our useDidKey configuration, as this is the first interaction for this protocol
    const useDidKey = agentContext.config.useDidKeyInProtocols

    const message = new MediationGrantMessage({
      endpoint: agentContext.config.endpoints[0],
      routingKeys: useDidKey
        ? (await this.getRoutingKeys(agentContext)).map(verkeyToDidKey)
        : await this.getRoutingKeys(agentContext),
      threadId: mediationRecord.threadId,
    })

    return { mediationRecord, message }
  }

  public async processMediationRequest(messageContext: InboundMessageContext<MediationRequestMessage>) {
    // Assert ready connection
    const connection = messageContext.assertReadyConnection()

    const mediationRecord = new MediationRecord({
      connectionId: connection.id,
      role: MediationRole.Mediator,
      state: MediationState.Requested,
      threadId: messageContext.message.threadId,
    })

    await this.mediationRepository.save(messageContext.agentContext, mediationRecord)
    this.emitStateChangedEvent(messageContext.agentContext, mediationRecord, null)

    return mediationRecord
  }

  private async updateUseDidKeysFlag(
    agentContext: AgentContext,
    connection: ConnectionRecord,
    protocolUri: string,
    connectionUsesDidKey: boolean
  ) {
    const useDidKeysForProtocol = connection.metadata.get(ConnectionMetadataKeys.UseDidKeysForProtocol) ?? {}
    useDidKeysForProtocol[protocolUri] = connectionUsesDidKey
    connection.metadata.set(ConnectionMetadataKeys.UseDidKeysForProtocol, useDidKeysForProtocol)
    await this.connectionService.update(agentContext, connection)
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new KeylistUpdateHandler(this))
    this.dispatcher.registerHandler(new MediationRequestHandler(this, this.mediatorModuleConfig))
  }
}
