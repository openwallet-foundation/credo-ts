import type { AgentContext } from './../context'
import type { DIDCommMessage } from './DIDCommMessage'
import type {
  DecryptedMessageContext,
  EncryptedMessage,
  ReceivedMessage,
  ProtectedMessage,
  SignedMessage,
} from './types'
import type { PackMessageParams as DIDCommV1PackMessageParams } from './v1/DIDCommV1EnvelopeService'
import type { DIDCommV1Message } from './v1/DIDCommV1Message'
import type {
  PackMessageEncryptedParams as DIDCommV2PackMessageParams,
  PackMessageSignedParams as DIDCommV2PackMessageSignedParams,
} from './v2/DIDCommV2EnvelopeService'
import type { DIDCommV2Message } from './v2/DIDCommV2Message'

import { AriesFrameworkError } from '../../error'
import { injectable } from '../../plugins'
import { JsonEncoder } from '../../utils'
import { AgentConfig } from '../AgentConfig'

import { DidCommV1Algorithms, DidCommV1Types, DIDCommMessageVersion, MessageType } from './types'
import { DIDCommV1EnvelopeService } from './v1/DIDCommV1EnvelopeService'
import { DIDCommV2EnvelopeService } from './v2/DIDCommV2EnvelopeService'

export type PackMessageParams = DIDCommV1PackMessageParams | DIDCommV2PackMessageParams
export type PackMessageSignedParams = DIDCommV2PackMessageSignedParams

@injectable()
export class EnvelopeService {
  private didCommV1EnvelopeService: DIDCommV1EnvelopeService
  private didCommV2EnvelopeService: DIDCommV2EnvelopeService

  public constructor(
    agentConfig: AgentConfig,
    didCommV1EnvelopeService: DIDCommV1EnvelopeService,
    didCommV2EnvelopeService: DIDCommV2EnvelopeService
  ) {
    this.didCommV1EnvelopeService = didCommV1EnvelopeService
    this.didCommV2EnvelopeService = didCommV2EnvelopeService
  }

  public async packMessageEncrypted(
    agentContext: AgentContext,
    payload: DIDCommMessage,
    params: PackMessageParams
  ): Promise<EncryptedMessage> {
    if (payload.version === DIDCommMessageVersion.V1) {
      return this.didCommV1EnvelopeService.packMessageEncrypted(
        agentContext,
        payload as DIDCommV1Message,
        params as DIDCommV1PackMessageParams
      )
    }
    if (payload.version === DIDCommMessageVersion.V2) {
      return this.didCommV2EnvelopeService.packMessageEncrypted(
        agentContext,
        payload as DIDCommV2Message,
        params as DIDCommV2PackMessageParams
      )
    }
    throw new AriesFrameworkError(`Unexpected DIDComm version: ${payload.version}`)
  }

  public async packMessageSigned(
    agentContext: AgentContext,
    payload: DIDCommMessage,
    params: PackMessageSignedParams
  ): Promise<EncryptedMessage> {
    if (payload.version === DIDCommMessageVersion.V1) {
      throw new AriesFrameworkError(`Pack message signed is not supported for DIDComm V1 message`)
    }
    if (payload.version === DIDCommMessageVersion.V2) {
      return this.didCommV2EnvelopeService.packMessageSigned(
        agentContext,
        payload as DIDCommV2Message,
        params as DIDCommV2PackMessageSignedParams
      )
    }
    throw new AriesFrameworkError(`Unexpected DIDComm version: ${payload.version}`)
  }

  public async unpackMessage(agentContext: AgentContext, message: ReceivedMessage): Promise<DecryptedMessageContext> {
    if (message.type === MessageType.Encrypted) {
      return this.unpackJWE(agentContext, message.message)
    }
    if (message.type === MessageType.Signed) {
      return this.unpackJWS(agentContext, message.message)
    }
    return {
      plaintextMessage: message.message,
    }
  }

  public async unpackJWE(agentContext: AgentContext, message: EncryptedMessage): Promise<DecryptedMessageContext> {
    const protectedValue = JsonEncoder.fromBase64(message.protected) as ProtectedMessage
    if (!protectedValue) {
      throw new AriesFrameworkError(`Unable to unpack message.`)
    }

    if (
      protectedValue.typ === DidCommV1Types.JwmV1 &&
      (protectedValue.alg === DidCommV1Algorithms.Anoncrypt || protectedValue.alg === DidCommV1Algorithms.Authcrypt)
    ) {
      const decryptedMessageContext = await this.didCommV1EnvelopeService.unpackMessage(agentContext, message)
      return {
        plaintextMessage: decryptedMessageContext.plaintextMessage,
        senderKey: decryptedMessageContext.senderKey,
        recipientKey: decryptedMessageContext.recipientKey,
        version: DIDCommMessageVersion.V1,
      }
    } else {
      const decryptedMessageContext = await this.didCommV2EnvelopeService.unpackMessage(agentContext, message)
      return {
        plaintextMessage: decryptedMessageContext.plaintextMessage,
        senderKey: decryptedMessageContext.senderKid,
        recipientKey: decryptedMessageContext.recipientKid,
        version: DIDCommMessageVersion.V2,
      }
    }
  }

  public async unpackJWS(agentContext: AgentContext, message: SignedMessage): Promise<DecryptedMessageContext> {
    const decryptedMessageContext = await this.didCommV2EnvelopeService.unpackMessage(agentContext, message)
    return {
      plaintextMessage: decryptedMessageContext.plaintextMessage,
      senderKey: decryptedMessageContext.senderKid,
      recipientKey: decryptedMessageContext.recipientKid,
      version: DIDCommMessageVersion.V2,
    }
  }
}
