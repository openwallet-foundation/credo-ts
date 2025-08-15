import type { DidCommMediationRecord } from './repository'

import { AgentContext, injectable } from '@credo-ts/core'

import { DidCommMessageHandlerRegistry } from '../../DidCommMessageHandlerRegistry'
import { DidCommMessageSender } from '../../DidCommMessageSender'
import { OutboundDidCommMessageContext } from '../../models'
import { DidCommConnectionService } from '../connections'

import { DidCommMediatorModuleConfig } from './DidCommMediatorModuleConfig'
import { ForwardHandler, KeylistUpdateHandler } from './handlers'
import { MediationRequestHandler } from './handlers/MediationRequestHandler'
import { DidCommMediatorService } from './services/DidCommMediatorService'

@injectable()
export class DidCommMediatorApi {
  public config: DidCommMediatorModuleConfig

  private mediatorService: DidCommMediatorService
  private messageSender: DidCommMessageSender
  private agentContext: AgentContext
  private connectionService: DidCommConnectionService

  public constructor(
    messageHandlerRegistry: DidCommMessageHandlerRegistry,
    mediationService: DidCommMediatorService,
    messageSender: DidCommMessageSender,
    agentContext: AgentContext,
    connectionService: DidCommConnectionService,
    config: DidCommMediatorModuleConfig
  ) {
    this.mediatorService = mediationService
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.config = config
    this.registerMessageHandlers(messageHandlerRegistry)
  }

  public async grantRequestedMediation(mediationRecordId: string): Promise<DidCommMediationRecord> {
    const record = await this.mediatorService.getById(this.agentContext, mediationRecordId)
    const connectionRecord = await this.connectionService.getById(this.agentContext, record.connectionId)

    const { message, mediationRecord } = await this.mediatorService.createGrantMediationMessage(
      this.agentContext,
      record
    )
    const outboundMessageContext = new OutboundDidCommMessageContext(message, {
      agentContext: this.agentContext,
      connection: connectionRecord,
      associatedRecord: mediationRecord,
    })

    await this.messageSender.sendMessage(outboundMessageContext)

    return mediationRecord
  }

  private registerMessageHandlers(messageHandlerRegistry: DidCommMessageHandlerRegistry) {
    messageHandlerRegistry.registerMessageHandler(new KeylistUpdateHandler(this.mediatorService))
    messageHandlerRegistry.registerMessageHandler(new ForwardHandler(this.mediatorService))
    messageHandlerRegistry.registerMessageHandler(new MediationRequestHandler(this.mediatorService, this.config))
  }
}
