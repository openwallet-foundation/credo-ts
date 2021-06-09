import type { Logger } from '../logger'
import type { OutboundMessage, UnpackedMessageContext } from '../types'
import type { Wallet } from '../wallet/Wallet'
import type { AgentConfig } from './AgentConfig'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../constants'
import { ForwardMessage } from '../modules/routing/messages'

@scoped(Lifecycle.ContainerScoped)
class EnvelopeService {
  private wallet: Wallet
  private logger: Logger

  public constructor(@inject(InjectionSymbols.Wallet) wallet: Wallet, agentConfig: AgentConfig) {
    this.wallet = wallet
    this.logger = agentConfig.logger
  }

  public async packMessage(outboundMessage: OutboundMessage): Promise<JsonWebKey> {
    const { routingKeys, recipientKeys, senderVk, payload } = outboundMessage
    const message = payload.toJSON()

    let wireMessage = await this.wallet.pack(message, recipientKeys, senderVk)

    if (routingKeys && routingKeys.length > 0) {
      for (const routingKey of routingKeys) {
        const [recipientKey] = recipientKeys

        const forwardMessage = new ForwardMessage({
          to: recipientKey,
          message: wireMessage,
        })

        this.logger.debug('Forward message created', forwardMessage)
        wireMessage = await this.wallet.pack(forwardMessage.toJSON(), [routingKey], senderVk)
      }
    }
    return wireMessage
  }

  public async unpackMessage(packedMessage: JsonWebKey): Promise<UnpackedMessageContext> {
    return this.wallet.unpack(packedMessage)
  }
}

export { EnvelopeService }
