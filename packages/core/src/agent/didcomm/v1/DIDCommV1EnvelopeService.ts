import type { Logger } from '../../../logger'
import type { EncryptedMessage, PlaintextMessage } from '../types'
import type { AgentContext } from './../../context'
import type { DIDCommV1Message } from './DIDCommV1Message'

import { InjectionSymbols } from '../../../constants'
import { Key, KeyType } from '../../../crypto'
import { ForwardMessage } from '../../../modules/routing/messages'
import { injectable, inject } from '../../../plugins'
import { Wallet } from '../../../wallet/Wallet'
import { AgentConfig } from '../../AgentConfig'

export interface PackMessageParams {
  recipientKeys: Key[]
  routingKeys: Key[]
  senderKey: Key | null
}

export interface DecryptedMessageContext {
  plaintextMessage: PlaintextMessage
  senderKey?: Key
  recipientKey?: Key
}

@injectable()
class DIDCommV1EnvelopeService {
  private wallet: Wallet
  private logger: Logger
  private config: AgentConfig

  public constructor(@inject(InjectionSymbols.Wallet) wallet: Wallet, agentConfig: AgentConfig) {
    this.wallet = wallet
    this.logger = agentConfig.logger
    this.config = agentConfig
  }

  public async packMessageEncrypted(
    agentContext: AgentContext,
    payload: DIDCommV1Message,
    keys: PackMessageParams
  ): Promise<EncryptedMessage> {
    const { recipientKeys, routingKeys, senderKey } = keys
    let recipientKeysBase58 = recipientKeys.map((key) => key.publicKeyBase58)
    const routingKeysBase58 = routingKeys.map((key) => key.publicKeyBase58)
    const senderKeyBase58 = senderKey && senderKey.publicKeyBase58

    // pass whether we want to use legacy did sov prefix
    // pass whether we want to use legacy did sov prefix
    const message = payload.toJSON({ useLegacyDidSovPrefix: agentContext.config.useLegacyDidSovPrefix })

    this.logger.debug(`Pack outbound message ${message['@type']}`)

    let encryptedMessage = await agentContext.wallet.pack(message, recipientKeysBase58, senderKeyBase58 ?? undefined)

    // If the message has routing keys (mediator) pack for each mediator
    for (const routingKeyBase58 of routingKeysBase58) {
      const forwardMessage = new ForwardMessage({
        // Forward to first recipient key
        to: recipientKeysBase58[0],
        message: encryptedMessage,
      })
      recipientKeysBase58 = [routingKeyBase58]
      this.logger.debug('Forward message created', forwardMessage)

      const forwardJson = forwardMessage.toJSON({ useLegacyDidSovPrefix: agentContext.config.useLegacyDidSovPrefix })

      // Forward messages are anon packed
      encryptedMessage = await agentContext.wallet.pack(forwardJson, [routingKeyBase58], undefined)
    }

    return encryptedMessage
  }

  public async unpackMessage(
    agentContext: AgentContext,
    encryptedMessage: EncryptedMessage
  ): Promise<DecryptedMessageContext> {
    const decryptedMessage = await agentContext.wallet.unpack(encryptedMessage)
    const { recipientKey, senderKey, plaintextMessage } = decryptedMessage
    return {
      recipientKey: recipientKey ? Key.fromPublicKeyBase58(recipientKey, KeyType.Ed25519) : undefined,
      senderKey: senderKey ? Key.fromPublicKeyBase58(senderKey, KeyType.Ed25519) : undefined,
      plaintextMessage,
    }
  }
}

export { DIDCommV1EnvelopeService }
