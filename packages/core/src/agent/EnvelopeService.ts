import type { AgentMessage } from './AgentMessage'
import type { AgentContext } from './context'
import type { Key } from '../crypto'
import type {
  DidCommV1PackMessageParams,
  DidCommV2PackMessageParams,
  DecryptedMessageContext,
  EncryptedMessage,
} from '../didcomm'
import type { ResolvedDidCommService } from '../modules/didcomm'
import type { DidDocument } from '../modules/dids'
import type { WalletPackOptions, WalletUnpackOptions } from '../wallet/Wallet'

import { InjectionSymbols } from '../constants'
import { V2Attachment } from '../decorators/attachment'
import { V2AttachmentData } from '../decorators/attachment/V2Attachment'
import { isDidCommV1EncryptedEnvelope } from '../didcomm'
import { DidCommMessageVersion } from '../didcomm/types'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'
import { DidResolverService } from '../modules/dids'
import { ForwardMessage, V2ForwardMessage } from '../modules/routing/messages'
import { inject, injectable } from '../plugins'
import { JsonEncoder } from '../utils'

export interface PackMessageParams {
  senderKey: Key | null
  recipientDidDocument?: DidDocument
  senderDidDocument?: DidDocument
  service: ResolvedDidCommService
}

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
      return this.packDIDCommV1Message(agentContext, message, {
        recipientKeys: params.service.recipientKeys,
        senderKey: params.senderKey,
        routingKeys: params.service.routingKeys,
      })
    }
    if (message.didCommVersion === DidCommMessageVersion.V2) {
      if (!params.service || !params.recipientDidDocument) {
        throw new AriesFrameworkError(`Unexpected to pack DIDComm V2 message. Invalid params provided: ${params}`)
      }
      return this.packDIDCommV2Message(agentContext, message, {
        service: params.service,
        recipientDidDocument: params.recipientDidDocument,
        senderDidDocument: params.senderDidDocument,
      })
    }
    throw new AriesFrameworkError(`Unexpected pack DIDComm message params: ${params}`)
  }

  public async unpackMessage(
    agentContext: AgentContext,
    encryptedMessage: EncryptedMessage
  ): Promise<DecryptedMessageContext> {
    if (isDidCommV1EncryptedEnvelope(encryptedMessage)) {
      return this.unpackDidCommV1(agentContext, encryptedMessage)
    } else {
      return this.unpackDidCommV2(agentContext, encryptedMessage)
    }
  }

  public async unpackDidCommV1(
    agentContext: AgentContext,
    encryptedMessage: EncryptedMessage
  ): Promise<DecryptedMessageContext> {
    return agentContext.wallet.unpack(encryptedMessage)
  }

  public async unpackDidCommV2(
    agentContext: AgentContext,
    encryptedMessage: EncryptedMessage
  ): Promise<DecryptedMessageContext> {
    // FIXME: Temporary workaround to extract sender/recipient keys out of JWE and resolve their DidDocuments
    // In future we are going to completely rework Wallet interface to expose crypto functions and construct / parse JWE here
    const protected_ = JsonEncoder.fromBase64(encryptedMessage.protected)

    const senderDidDocument = protected_.skid
      ? await this.didResolverService.resolveDidDocument(agentContext, protected_.skid)
      : undefined

    const recipientDidDocuments = await Promise.all(
      encryptedMessage.recipients.map((recipient) =>
        this.didResolverService.resolveDidDocument(agentContext, recipient.header.kid)
      )
    )

    const params: WalletUnpackOptions = {
      senderDidDocument,
      recipientDidDocuments,
    }

    return agentContext.wallet.unpack(encryptedMessage, params)
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
    const unboundMessage = message.toJSON()
    const packParams: WalletPackOptions = {
      didCommVersion: DidCommMessageVersion.V2,
      recipientDidDocuments: [params.recipientDidDocument],
      senderDidDocument: params.senderDidDocument,
    }
    const encryptedMessage = await agentContext.wallet.pack(unboundMessage, packParams)
    return await this.wrapDIDCommV2MessageInForward(agentContext, encryptedMessage, params)
  }

  private async wrapDIDCommV2MessageInForward(
    agentContext: AgentContext,
    encryptedMessage: EncryptedMessage,
    params: DidCommV2PackMessageParams
  ): Promise<EncryptedMessage> {
    const { recipientDidDocument, service } = params
    if (!recipientDidDocument) {
      return encryptedMessage
    }

    const routingDidDocuments: DidDocument[] = service.routingDidDocuments ?? []

    if (!routingDidDocuments.length) {
      // There is no routing keys defined -> we do not need to wrap the message into Forward
      return encryptedMessage
    }

    // If the message has routing keys (mediator) pack for each mediator
    let next = recipientDidDocument.id
    for (const routing of routingDidDocuments) {
      const forwardMessage = new V2ForwardMessage({
        to: [routing.id],
        body: { next },
        attachments: [
          new V2Attachment({
            data: new V2AttachmentData({ json: encryptedMessage }),
          }),
        ],
      })
      next = routing.id
      this.logger.debug('Forward message created', forwardMessage)

      const forwardJson = forwardMessage.toJSON()

      // Forward messages are anon packed
      const forwardParams: WalletPackOptions = {
        didCommVersion: DidCommMessageVersion.V2,
        recipientDidDocuments: [routing],
      }
      encryptedMessage = await agentContext.wallet.pack(forwardJson, forwardParams)
    }

    return encryptedMessage
  }
}
