import type { AgentMessage } from './AgentMessage'
import type { AgentContext } from './context'
import type { Key } from '../crypto'
import type {
  DidCommV1PackMessageParams,
  DidCommV2PackMessageParams,
  DecryptedMessageContext,
  EncryptedMessage,
} from '../didcomm'
import type { DidDocument } from '../modules/dids'
import type { WalletPackOptions } from '../wallet/Wallet'

import { InjectionSymbols } from '../constants'
import { V2Attachment } from '../decorators/attachment'
import { V2AttachmentData } from '../decorators/attachment/V2Attachment'
import { DidCommMessageVersion } from '../didcomm/types'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'
import { DidResolverService, getAgreementKeys, keyReferenceToKey } from '../modules/dids'
import { ForwardMessage, V2ForwardMessage } from '../modules/routing/messages'
import { inject, injectable } from '../plugins'

export type PackMessageParams = DidCommV1PackMessageParams | DidCommV2PackMessageParams

@injectable()
export class EnvelopeService {
  private logger: Logger
  private didResolverService: DidResolverService

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger, didResolverService: DidResolverService) {
    this.logger = logger
    this.didResolverService = didResolverService
  }

  public async packMessage(
    agentContext: AgentContext,
    message: AgentMessage,
    params: PackMessageParams
  ): Promise<EncryptedMessage> {
    if (message.didCommVersion === DidCommMessageVersion.V1) {
      return this.packDIDCommV1Message(agentContext, message, params as DidCommV1PackMessageParams)
    }
    if (message.didCommVersion === DidCommMessageVersion.V2) {
      return this.packDIDCommV2Message(agentContext, message, params as DidCommV2PackMessageParams)
    }
    throw new AriesFrameworkError(`Unexpected pack DIDComm message params: ${params}`)
  }

  public async unpackMessage(
    agentContext: AgentContext,
    encryptedMessage: EncryptedMessage
  ): Promise<DecryptedMessageContext> {
    return await agentContext.wallet.unpack(encryptedMessage)
  }

  private async packDIDCommV1Message(
    agentContext: AgentContext,
    message: AgentMessage,
    params: DidCommV1PackMessageParams
  ): Promise<EncryptedMessage> {
    const { recipientKeys, senderKey } = params

    // pass whether we want to use legacy did sov prefix
    const unboundMessage = message.toJSON({
      useDidSovPrefixWhereAllowed: agentContext.config.useDidSovPrefixWhereAllowed,
    })

    this.logger.debug(`Pack outbound message ${unboundMessage['@type']}`)

    // Forward messages are anon packed
    const packParams: WalletPackOptions = {
      didCommVersion: DidCommMessageVersion.V1,
      senderKey,
      recipientKeys,
    }
    const encryptedMessage = await agentContext.wallet.pack(unboundMessage, packParams)
    return await this.wrapDIDCommV1MessageInForward(agentContext, encryptedMessage, params)
  }

  private async wrapDIDCommV1MessageInForward(
    agentContext: AgentContext,
    encryptedMessage: EncryptedMessage,
    params: DidCommV1PackMessageParams
  ): Promise<EncryptedMessage> {
    const { recipientKeys, routingKeys } = params

    if (!recipientKeys.length || !routingKeys.length) {
      return encryptedMessage
    }

    // If the message has routing keys (mediator) pack for each mediator
    let to = recipientKeys[0].publicKeyBase58
    for (const routingKey of routingKeys) {
      const forwardMessage = new ForwardMessage({
        to,
        message: encryptedMessage,
      })
      to = routingKey.publicKeyBase58
      this.logger.debug('Forward message created', forwardMessage)

      const forwardJson = forwardMessage.toJSON({
        useDidSovPrefixWhereAllowed: agentContext.config.useDidSovPrefixWhereAllowed,
      })

      // Forward messages are anon packed
      const forwardParams: WalletPackOptions = {
        didCommVersion: DidCommMessageVersion.V1,
        recipientKeys: [routingKey],
      }
      encryptedMessage = await agentContext.wallet.pack(forwardJson, forwardParams)
    }

    return encryptedMessage
  }

  private async packDIDCommV2Message(
    agentContext: AgentContext,
    message: AgentMessage,
    params: DidCommV2PackMessageParams
  ): Promise<EncryptedMessage> {
    const { recipientDidDoc, senderDidDoc } = params
    const { senderKey, recipientKey } = EnvelopeService.findCommonSupportedEncryptionKeys(recipientDidDoc, senderDidDoc)
    if (!recipientKey) {
      throw new AriesFrameworkError(
        `Unable to pack message ${message.id} because there is no any commonly supported key types to encrypt message`
      )
    }
    const unboundMessage = message.toJSON()
    const packParams: WalletPackOptions = {
      didCommVersion: DidCommMessageVersion.V2,
      recipientKeys: [recipientKey],
      senderKey,
    }
    const encryptedMessage = await agentContext.wallet.pack(unboundMessage, packParams)
    return await this.wrapDIDCommV2MessageInForward(agentContext, encryptedMessage, params)
  }

  private async wrapDIDCommV2MessageInForward(
    agentContext: AgentContext,
    encryptedMessage: EncryptedMessage,
    params: DidCommV2PackMessageParams
  ): Promise<EncryptedMessage> {
    const { recipientDidDoc, service } = params
    if (!recipientDidDoc) {
      return encryptedMessage
    }

    const routings: { did: string; key: Key }[] = []
    for (const routingKey of service.routingKeys ?? []) {
      const routingDidDocument = await this.didResolverService.resolveDidDocument(agentContext, routingKey)
      routings.push({
        did: routingDidDocument.id,
        key: keyReferenceToKey(routingDidDocument, routingKey),
      })
    }

    if (!routings.length) {
      return encryptedMessage
    }

    // If the message has routing keys (mediator) pack for each mediator
    let next = recipientDidDoc.id
    for (const routing of routings) {
      const forwardMessage = new V2ForwardMessage({
        to: [routing.did],
        body: { next },
        attachments: [
          new V2Attachment({
            data: new V2AttachmentData({ json: encryptedMessage }),
          }),
        ],
      })
      next = routing.did
      this.logger.debug('Forward message created', forwardMessage)

      const forwardJson = forwardMessage.toJSON()

      // Forward messages are anon packed
      const forwardParams: WalletPackOptions = {
        didCommVersion: DidCommMessageVersion.V2,
        recipientKeys: [routing.key],
      }
      encryptedMessage = await agentContext.wallet.pack(forwardJson, forwardParams)
    }

    return encryptedMessage
  }

  private static findCommonSupportedEncryptionKeys(recipientDidDocument: DidDocument, senderDidDocument?: DidDocument) {
    const recipientAgreementKeys = getAgreementKeys(recipientDidDocument)

    if (!senderDidDocument) {
      return { senderKey: undefined, recipientKey: recipientAgreementKeys[0] }
    }

    const senderAgreementKeys = getAgreementKeys(senderDidDocument)

    let senderKey: Key | undefined
    let recipientKey: Key | undefined

    for (const senderAgreementKey of senderAgreementKeys) {
      for (const recipientAgreementKey of recipientAgreementKeys) {
        if (senderAgreementKey.keyType === recipientAgreementKey.keyType) {
          senderKey = senderAgreementKey
          recipientKey = recipientAgreementKey
          break
        }
      }
      if (senderKey) break
    }

    return {
      senderKey,
      recipientKey,
    }
  }
}
