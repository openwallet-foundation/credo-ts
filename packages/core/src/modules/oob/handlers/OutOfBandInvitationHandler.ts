import type { AgentConfig } from '../../../agent/AgentConfig'
import type { HandlerV2, HandlerV2InboundMessage } from '../../../agent/Handler'
import type { MessageSender } from '../../../agent/MessageSender'
import type { MediationRecipientService } from '../../routing/services/MediationRecipientService'
import type { OutOfBandService } from '../services/OutOfBandService'

import { OutOfBandInvitationMessage } from '../messages/OutOfBandInvitationMessage'

export class OutOfBandInvitationHandler implements HandlerV2 {
  private outOfBandService: OutOfBandService
  private agentConfig: AgentConfig
  private mediationRecipientService: MediationRecipientService
  private messageSender: MessageSender
  public supportedMessages = [OutOfBandInvitationMessage]

  public constructor(
    outOfBandService: OutOfBandService,
    agentConfig: AgentConfig,
    mediationRecipientService: MediationRecipientService,
    messageSender: MessageSender
  ) {
    this.outOfBandService = outOfBandService
    this.agentConfig = agentConfig
    this.mediationRecipientService = mediationRecipientService
    this.messageSender = messageSender
  }

  public async handle(messageContext: HandlerV2InboundMessage<OutOfBandInvitationHandler>) {
    if (!this.agentConfig.autoAcceptConnections) return

    // create out-of-band record
    await this.outOfBandService.receiveOutOfBandInvitation(messageContext.message)

    // if (messageContext.message.body.goalCode === OutOfBandGoalCodes.RequestPayCashVtp) {
    //   if (this.agentConfig.valueTransferConfig?.role === ValueTransferRole.Witness) {
    //     // witness forwards plain message to giver
    //     const transport = this.agentConfig.valueTransferConfig.giverTransport
    //     if (!transport) {
    //       this.agentConfig.logger.error(`Could not automatically forward message as giver transport is not defined`)
    //       return
    //     }
    //
    //     const outboundMessage = createOutboundPlainMessage(messageContext.message)
    //     await this.messageSender.sendPlaintextMessage(outboundMessage, transport)
    //
    //     // witness marks out-of-band record as processed
    //     await this.outOfBandService.complete(outOfBandRecord)
    //   }
    //   if (this.agentConfig.valueTransferConfig?.role === ValueTransferRole.Giver) {
    //     // giver creates new out-of-band invitation with it's DID and pay cash goal code
    //     const routing = await this.mediationRecipientService.getRouting()
    //     const transport = messageContext.transport
    //
    //     const { message: invitation, outOfBandRecord: newOutOfBandRecord } =
    //       await this.outOfBandService.createOutOfBandInvitation({
    //         alias: this.agentConfig.label,
    //         routing,
    //         myLabel: this.agentConfig.label,
    //         myImageUrl: this.agentConfig.connectionImageUrl,
    //         goalCode: OutOfBandGoalCodes.PayCashVtp,
    //         transport,
    //       })
    //
    //     // giver sends plain text invitation to witness
    //     if (!transport) {
    //       this.agentConfig.logger.error(`Could not automatically forward message as witness transport is not defined`)
    //       return
    //     }
    //
    //     const outboundMessage = createOutboundPlainMessage(invitation)
    //     await this.messageSender.sendPlaintextMessage(outboundMessage, transport)
    //
    //     // giver marks out-of-band records as processed
    //     await this.outOfBandService.complete(outOfBandRecord)
    //     await this.outOfBandService.complete(newOutOfBandRecord)
    //   }
    // }
    //
    // if (messageContext.message.body.goalCode === OutOfBandGoalCodes.PayCashVtp) {
    //   if (this.agentConfig.valueTransferConfig?.role === ValueTransferRole.Witness) {
    //     // witness makes connection
    //     const routing = await this.mediationRecipientService.getRouting()
    //     await this.outOfBandService.makeOutOfBandConnection(messageContext.message, outOfBandRecord, {
    //       alias: this.agentConfig.label,
    //       transport: messageContext?.transport,
    //       routing,
    //     })
    //
    //     // witness forwards message to getter
    //     const transport = this.agentConfig.valueTransferConfig.getterTransport
    //     if (!transport) {
    //       this.agentConfig.logger.error(`Could not automatically forward message as getter transport is not defined`)
    //       return
    //     }
    //
    //     const outboundMessage = createOutboundPlainMessage(messageContext.message)
    //     await this.messageSender.sendPlaintextMessage(outboundMessage, transport)
    //
    //     // witness mark out-of-band records as processed
    //     await this.outOfBandService.complete(outOfBandRecord)
    //   }
    //   if (this.agentConfig.valueTransferConfig?.role === ValueTransferRole.Getter) {
    //     // getter must request payment and then mark out-of-band as completed
    //   }
    // }
  }
}
