import type { Logger } from '../../../logger'
import type { PlaintextMessage } from '../../../types'
import type { EncryptedMessage } from '../types'
import type { DIDCommV1Message } from './DIDCommV1Message'

import { inject, scoped, Lifecycle } from 'tsyringe'

import { InjectionSymbols } from '../../../constants'
import { ForwardMessage } from '../../../modules/routing/messages'
import { JsonEncoder } from '../../../utils'
import { Wallet } from '../../../wallet/Wallet'
import { AgentConfig } from '../../AgentConfig'

export interface PackMessageParams {
  recipientKeys: string[]
  routingKeys: string[]
  senderKey: string | null
}

export interface DecryptedMessageContext {
  plaintextMessage: PlaintextMessage
  senderKey?: string
  recipientKey?: string
}

@scoped(Lifecycle.ContainerScoped)
class DIDCommV1EnvelopeService {
  private wallet: Wallet
  private logger: Logger
  private config: AgentConfig

  public constructor(@inject(InjectionSymbols.Wallet) wallet: Wallet, agentConfig: AgentConfig) {
    this.wallet = wallet
    this.logger = agentConfig.logger
    this.config = agentConfig
  }

  public async packMessage(payload: DIDCommV1Message, keys: PackMessageParams): Promise<EncryptedMessage> {
    const { routingKeys, senderKey } = keys
    let recipientKeys = keys.recipientKeys

    // pass whether we want to use legacy did sov prefix
    const message = payload.toJSON({ useLegacyDidSovPrefix: this.config.useLegacyDidSovPrefix })
    const messageBuffer = JsonEncoder.toBuffer(payload)

    this.logger.debug(`Pack outbound message ${message['@type']}`)

    let encryptedMessage = await this.wallet.pack(messageBuffer, recipientKeys, senderKey ?? undefined)

    // If the record has routing keys (mediator) pack for each mediator
    for (const routingKey of routingKeys) {
      const forwardMessage = new ForwardMessage({
        // Forward to first recipient key
        to: recipientKeys[0],
        message: encryptedMessage,
      })
      recipientKeys = [routingKey]
      this.logger.debug('Forward record created', forwardMessage)

      const forwardJson = forwardMessage.toJSON({ useLegacyDidSovPrefix: this.config.useLegacyDidSovPrefix })
      const forwardBuffer = JsonEncoder.toBuffer(forwardJson)

      // Forward messages are anon packed
      encryptedMessage = await this.wallet.pack(forwardBuffer, [routingKey], undefined)
    }

    return encryptedMessage
  }

  public async unpackMessage(encryptedMessage: EncryptedMessage): Promise<DecryptedMessageContext> {
    return this.wallet.unpack(encryptedMessage)
  }
}

export { DIDCommV1EnvelopeService }
