import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { DIDCommV2Message } from '../../../agent/didcomm'
import type { ValueTransferService } from '../services'
import type { ValueTransferWitnessService } from '../services/ValueTransferWitnessService'

import { CashRemovedMessage } from '../messages'

export class CashRemovedHandler implements Handler<typeof DIDCommV2Message> {
  private valueTransferService: ValueTransferService
  private valueTransferWitnessService: ValueTransferWitnessService

  public readonly supportedMessages = [CashRemovedMessage]

  public constructor(
    valueTransferService: ValueTransferService,
    valueTransferWitnessService: ValueTransferWitnessService
  ) {
    this.valueTransferService = valueTransferService
    this.valueTransferWitnessService = valueTransferWitnessService
  }

  public async handle(messageContext: HandlerInboundMessage<CashRemovedHandler>) {
    const { giverMessage, getterMessage } = await this.valueTransferWitnessService.processCashRemoved(messageContext)

    await Promise.all([
      this.valueTransferService.sendMessageToGetter(getterMessage),
      this.valueTransferService.sendMessageToGiver(giverMessage),
    ])
    return
  }
}
