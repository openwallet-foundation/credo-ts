/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TransportInterface } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Lifecycle, scoped } from 'tsyringe'

import { MessageSender } from '../../../agent/MessageSender'
import { SendingMessageType } from '../../../agent/didcomm/types'
import { DIDCommV2Message } from '../../../agent/didcomm/v2/DIDCommV2Message'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferTransportService implements TransportInterface {
  private messageSender: MessageSender

  public constructor(messageSender: MessageSender) {
    this.messageSender = messageSender
  }

  public async send(message: any): Promise<void> {
    const didcommmessae = new DIDCommV2Message({ ...message })
    await this.messageSender.sendDIDCommV2Message(didcommmessae, SendingMessageType.Encrypted)
  }
}
