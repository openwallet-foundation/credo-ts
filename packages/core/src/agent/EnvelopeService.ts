import type { AgentMessage } from './AgentMessage'
import type { AgentContext } from './context'
import type { DecryptedMessageContext, EncryptedMessage } from '../didcomm/types'
import type { PackMessageParams as DidCommV1PackMessageParams } from '../didcomm/versions/v1'
import type { V2PackMessageParams as DidCommV2PackMessageParams } from '../didcomm/versions/v2'
import type { WalletPackV1Options, WalletPackV2Options } from '../wallet/Wallet'

import { InjectionSymbols } from '../constants'
import { Key, KeyType } from '../crypto'
import { DidCommMessageVersion } from '../didcomm/types'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'
import { ForwardMessage } from '../modules/routing/messages'
import { inject, injectable } from '../plugins'

export type PackMessageParams = DidCommV1PackMessageParams | DidCommV2PackMessageParams

@injectable()
export class EnvelopeService {
  private logger: Logger

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger) {
    this.logger = logger
  }

  public async packMessage(
    agentContext: AgentContext,
    message: AgentMessage,
    params: DidCommV1PackMessageParams | DidCommV2PackMessageParams
  ): Promise<EncryptedMessage> {
    // pass whether we want to use legacy did sov prefix
    const unboundMessage = message.toJSON({
      useDidSovPrefixWhereAllowed: agentContext.config.useDidSovPrefixWhereAllowed,
    })

    if (message.didCommVersion === DidCommMessageVersion.V1) {
      const { recipientKeys, routingKeys, senderKey } = params as DidCommV1PackMessageParams
      let recipientKeysBase58 = recipientKeys.map((key) => key.publicKeyBase58)
      const routingKeysBase58 = routingKeys.map((key) => key.publicKeyBase58)
      const senderKeyBase58 = senderKey && senderKey.publicKeyBase58

      this.logger.debug(`Pack outbound message ${unboundMessage['@type']}`)

      // Forward messages are anon packed
      const packParams: WalletPackV1Options = {
        version: 'v1',
        senderKey: senderKeyBase58 ?? null,
        recipientKeys: recipientKeysBase58,
      }
      let encryptedMessage = await agentContext.wallet.pack(unboundMessage, packParams)

      // If the message has routing keys (mediator) pack for each mediator
      for (const routingKey of routingKeysBase58) {
        const forwardMessage = new ForwardMessage({
          // Forward to first recipient key
          to: recipientKeysBase58[0],
          message: encryptedMessage,
        })
        recipientKeysBase58 = [routingKey]
        this.logger.debug('Forward message created', forwardMessage)

        const forwardJson = forwardMessage.toJSON({
          useDidSovPrefixWhereAllowed: agentContext.config.useDidSovPrefixWhereAllowed,
        })

        // Forward messages are anon packed
        const forwardParams: WalletPackV1Options = {
          version: 'v1',
          senderKey: null,
          recipientKeys: recipientKeysBase58,
        }
        encryptedMessage = await agentContext.wallet.pack(forwardJson, forwardParams)
      }

      return encryptedMessage
    }
    if (message.didCommVersion === DidCommMessageVersion.V2) {
      const { fromDid, toDid } = params as DidCommV2PackMessageParams
      const packParams: WalletPackV2Options = {
        version: 'v2',
        fromDid,
        toDid,
      }
      return await agentContext.wallet.pack(unboundMessage, packParams)
    }
    throw new AriesFrameworkError(`Unexpected pack DIDComm message params: ${params}`)
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

    // if (isEncryptedMessage(message)) {
    //   return this.unpackJwe(agentContext, message)
    // }
    // if (isSignedMessage(message)) {
    //   return this.unpackJws(agentContext, message)
    // }
    // throw new AriesFrameworkError(`Unexpected message!`)
  }

  // private async unpackJwe(agentContext: AgentContext, message: EncryptedMessage): Promise<DecryptedMessageContext> {
  //   if (isDidCommV1EncryptedEnvelope(message)) {
  //     return this.didCommV1EnvelopeService.unpackMessage(agentContext, message)
  //   } else {
  //     return this.getDidCommV2EnvelopeService().unpackMessage(agentContext, message)
  //   }
  // }
  //
  // private async unpackJws(agentContext: AgentContext, message: SignedMessage): Promise<DecryptedMessageContext> {
  //   return this.getDidCommV2EnvelopeService().unpackMessage(agentContext, message)
  // }
}
