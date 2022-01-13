import type { Logger } from '../logger'
import type { DecryptedMessageContext, EncryptedMessage } from '../types'
import type { AgentMessage } from './AgentMessage'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../constants'
import { ForwardMessage } from '../modules/routing/messages'
import { Wallet } from '../wallet/Wallet'

import { AgentConfig } from './AgentConfig'

export interface EnvelopeKeys {
  recipientKeys: string[]
  routingKeys: string[]
  senderKey: string | null
}

@scoped(Lifecycle.ContainerScoped)
class EnvelopeService {
  private wallet: Wallet
  private logger: Logger
  private config: AgentConfig

  public constructor(@inject(InjectionSymbols.Wallet) wallet: Wallet, agentConfig: AgentConfig) {
    this.wallet = wallet
    this.logger = agentConfig.logger
    this.config = agentConfig
  }

  public async packMessage(payload: AgentMessage, keys: EnvelopeKeys): Promise<EncryptedMessage> {
    const { routingKeys, senderKey } = keys
    let recipientKeys = keys.recipientKeys

    // pass whether we want to use legacy did sov prefix
    const message = payload.toJSON({ useLegacyDidSovPrefix: this.config.useLegacyDidSovPrefix })

    this.logger.debug(`Pack outbound message ${message['@type']}`)

    let encryptedMessage = await this.wallet.pack(message, recipientKeys, senderKey ?? undefined)

    // If the message has routing keys (mediator) pack for each mediator
    for (const routingKey of routingKeys) {
      const forwardMessage = new ForwardMessage({
        // Forward to first recipient key
        to: recipientKeys[0],
        message: encryptedMessage,
      })
      recipientKeys = [routingKey]
      this.logger.debug('Forward message created', forwardMessage)

      const forwardJson = forwardMessage.toJSON({ useLegacyDidSovPrefix: this.config.useLegacyDidSovPrefix })

      // Forward messages are anon packed
      encryptedMessage = await this.wallet.pack(forwardJson, [routingKey], undefined)
    }

    return encryptedMessage
  }

  public async unpackMessage(encryptedMessage: EncryptedMessage): Promise<DecryptedMessageContext> {
    return this.wallet.unpack(encryptedMessage)
  }
}

export { EnvelopeService }
