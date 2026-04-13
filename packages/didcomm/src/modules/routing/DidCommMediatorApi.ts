import { AgentContext, injectable } from '@credo-ts/core'
import { DidCommMessageSender } from '../../DidCommMessageSender'
import { DidCommOutboundMessageContext } from '../../models'
import { DidCommConnectionService } from '../connections'
import { DidCommMediatorModuleConfig } from './DidCommMediatorModuleConfig'
import type { DidCommMediationRecord } from './repository'
import { DidCommMediatorService } from './services/DidCommMediatorService'

@injectable()
export class DidCommMediatorApi {
  public config: DidCommMediatorModuleConfig

  private mediatorService: DidCommMediatorService
  private messageSender: DidCommMessageSender
  private agentContext: AgentContext
  private connectionService: DidCommConnectionService

  public constructor(
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
  }

  /**
   * Grant a pending mediation request. Automatically sends a v1 or v2 grant
   * based on the mediation record's protocol version.
   */
  public async grantRequestedMediation(mediationRecordId: string): Promise<DidCommMediationRecord> {
    const record = await this.mediatorService.getById(this.agentContext, mediationRecordId)
    const connectionRecord = await this.connectionService.getById(this.agentContext, record.connectionId)

    const { message, mediationRecord } =
      record.mediationProtocolVersion === 'v2'
        ? await this.mediatorService.createGrantMediationMessageV2(this.agentContext, record)
        : await this.mediatorService.createGrantMediationMessage(this.agentContext, record)

    const outboundMessageContext = new DidCommOutboundMessageContext(message, {
      agentContext: this.agentContext,
      connection: connectionRecord,
      associatedRecord: mediationRecord,
    })

    await this.messageSender.sendMessage(outboundMessageContext)

    return mediationRecord
  }
}
