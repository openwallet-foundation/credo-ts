import type { Transport } from '../routing/types'
import type { OutOfBandRecord } from './repository'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage, createOutboundPlainMessage } from '../../agent/helpers'
import { ConnectionService } from '../connections/services'
import { MediationRecipientService } from '../routing/services/MediationRecipientService'

import { OutOfBandInvitationHandler } from './handlers/OutOfBandInvitationHandler'
import { OutOfBandInvitationMessage } from './messages/OutOfBandInvitationMessage'
import { OutOfBandService } from './services/OutOfBandService'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandModule {
  private agentConfig: AgentConfig
  private connectionService: ConnectionService
  private outOfBandService: OutOfBandService
  private messageSender: MessageSender
  private mediationRecipientService: MediationRecipientService

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    connectionService: ConnectionService,
    outOfBandService: OutOfBandService,
    mediationRecipientService: MediationRecipientService,
    messageSender: MessageSender
  ) {
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.outOfBandService = outOfBandService
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
    this.registerHandlers(dispatcher)
  }

  public async createOutOfBandInvitation(config?: {
    alias?: string
    myLabel?: string
    myImageUrl?: string
    goalCode?: string
    mediatorId?: string
    send?: boolean
    connectionId?: string
    transport?: Transport
  }): Promise<{
    invitation: OutOfBandInvitationMessage
    outOfBandRecord: OutOfBandRecord
  }> {
    const routing = await this.mediationRecipientService.getRouting({
      mediatorId: config?.mediatorId,
    })
    const { outOfBandRecord, message: invitation } = await this.outOfBandService.createOutOfBandInvitation({
      alias: config?.alias,
      routing,
      myLabel: config?.myLabel,
      myImageUrl: config?.myImageUrl,
      goalCode: config?.goalCode,
      transport: config?.transport,
    })

    // VTP Demo: Getter create OoB invitation with `RequestPayCashVtp` goalCode and automatically send
    if (config?.send) {
      await this.sendInvitation(outOfBandRecord, config)

      // mark as completed
      await this.outOfBandService.complete(outOfBandRecord)
    }
    return { outOfBandRecord, invitation }
  }

  public async acceptOutOfBandInvitationFromUrl(
    invitationUrl: string,
    config?: {
      alias?: string
      mediatorId?: string
      transport?: Transport
    }
  ): Promise<{ outOfBandRecord: OutOfBandRecord }> {
    const invitation = await OutOfBandInvitationMessage.fromUrl(invitationUrl)
    const { outOfBandRecord } = await this.outOfBandService.receiveOutOfBandInvitation(invitation)
    return this.acceptOutOfBandInvitation(outOfBandRecord, {
      alias: config?.alias,
      mediatorId: config?.mediatorId,
      transport: config?.transport,
    })
  }

  public async acceptOutOfBandInvitation(
    outOfBandRecord: OutOfBandRecord,
    config?: {
      alias?: string
      mediatorId?: string
      transport?: Transport
    }
  ): Promise<{
    outOfBandRecord: OutOfBandRecord
  }> {
    const routing = await this.mediationRecipientService.getRouting({
      mediatorId: config?.mediatorId,
    })
    const { outOfBandRecord: updatedOutOfBandRecord } = await this.outOfBandService.makeOutOfBandConnection(
      outOfBandRecord.invitation,
      outOfBandRecord,
      {
        alias: config?.alias,
        transport: config?.transport,
        routing,
      }
    )
    return { outOfBandRecord: updatedOutOfBandRecord }
  }

  public async sendInvitation(
    record: OutOfBandRecord,
    config?: {
      connectionId?: string
      transport?: Transport
    }
  ) {
    if (config?.connectionId) {
      // send encrypted invitation
      const connection = await this.connectionService.getById(config?.connectionId)
      const outboundMessage = createOutboundMessage(connection, record.invitation)
      await this.messageSender.sendMessage(outboundMessage)
    } else if (config?.transport) {
      // send plain text invitation
      const outboundMessage = createOutboundPlainMessage(record.invitation)
      await this.messageSender.sendPlaintextMessage(outboundMessage, config.transport)
    } else {
      this.agentConfig.logger.error(`Could not send message because neither connection or transport defined`)
    }
  }

  public async complete(record: OutOfBandRecord) {
    await this.outOfBandService.complete(record)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerDIDCommV2Handler(
      new OutOfBandInvitationHandler(
        this.outOfBandService,
        this.agentConfig,
        this.mediationRecipientService,
        this.messageSender
      )
    )
  }
}
