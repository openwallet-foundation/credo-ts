import type { HandlerInboundMessage, Handler } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferService } from '../services'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { MintMessage } from '../messages/MintMessage'

export class MintHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferService: ValueTransferService
  private valueTransferWitnessService: ValueTransferWitnessService
  public readonly supportedMessages = [MintMessage]

  public constructor(
    valueTransferService: ValueTransferService,
    valueTransferWitnessService: ValueTransferWitnessService
  ) {
    this.valueTransferService = valueTransferService
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerInboundMessage<MintHandler>) {
    const message = await this.valueTransferWitnessService.processCashMint(messageContext)
    if (messageContext.message.please_ack) {
      return this.valueTransferService.sendMessage(message)
    }
  }
}
