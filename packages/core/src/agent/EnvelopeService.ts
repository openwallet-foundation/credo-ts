import type { Logger } from '../logger'
import type { DecryptedMessageContext, EncryptedMessage } from '../types'
import type { AgentMessage } from './AgentMessage'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../constants'
import { didKeyToVerkey, verkeyToDidKey } from '../modules/dids/helpers'
import { ForwardMessage } from '../modules/routing/messages'
import { Wallet } from '../wallet/Wallet'

import { AgentConfig } from './AgentConfig'

export interface EnvelopeKeys {
  recipientKeys: string[]
  routingKeys: string[]
  senderKey: string | null
}

@scoped(Lifecycle.ContainerScoped)
export class EnvelopeService {
  private wallet: Wallet
  private logger: Logger
  private config: AgentConfig

  public constructor(@inject(InjectionSymbols.Wallet) wallet: Wallet, agentConfig: AgentConfig) {
    this.wallet = wallet
    this.logger = agentConfig.logger
    this.config = agentConfig
  }

  public async packMessage(payload: AgentMessage, keys: EnvelopeKeys): Promise<EncryptedMessage> {
    const { recipientKeys, routingKeys, senderKey } = keys
    let recipientVerkeys = recipientKeys.map(didKeyToVerkey)
    const routingVerkeys = routingKeys.map(didKeyToVerkey)
    const senderVerkey = senderKey && didKeyToVerkey(senderKey)

    // pass whether we want to use legacy did sov prefix
    const message = payload.toJSON({ useLegacyDidSovPrefix: this.config.useLegacyDidSovPrefix })

    this.logger.debug(`Pack outbound message ${message['@type']}`)

    let encryptedMessage = await this.wallet.pack(message, recipientVerkeys, senderVerkey ?? undefined)

    // If the message has routing keys (mediator) pack for each mediator
    for (const routingVerkey of routingVerkeys) {
      const forwardMessage = new ForwardMessage({
        // Forward to first recipient key
        to: recipientVerkeys[0],
        message: encryptedMessage,
      })
      recipientVerkeys = [routingVerkey]
      this.logger.debug('Forward message created', forwardMessage)

      const forwardJson = forwardMessage.toJSON({ useLegacyDidSovPrefix: this.config.useLegacyDidSovPrefix })

      // Forward messages are anon packed
      encryptedMessage = await this.wallet.pack(forwardJson, [routingVerkey], undefined)
    }

    return encryptedMessage
  }

  public async unpackMessage(encryptedMessage: EncryptedMessage): Promise<DecryptedMessageContext> {
    const decryptedMessage = await this.wallet.unpack(encryptedMessage)
    const { recipientKey, senderKey, plaintextMessage } = decryptedMessage
    return {
      recipientKey: recipientKey && verkeyToDidKey(recipientKey),
      senderKey: senderKey && verkeyToDidKey(senderKey),
      plaintextMessage,
    }
  }
}
