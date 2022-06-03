import type { DIDCommMessage } from './DIDCommMessage'
import type { DecryptedMessageContext, EncryptedMessage, ProtectedMessage, PackedMessage } from './types'
import type { PackMessageParams as DIDCommV1PackMessageParams } from './v1/DIDCommV1EnvelopeService'
import type { DIDCommV1Message } from './v1/DIDCommV1Message'
import type {
  PackMessageParams as DIDCommV2PackMessageParams,
  PackMessageSignedParams as DIDCommV2PackMessageSignedParams,
} from './v2/DIDCommV2EnvelopeService'
import type { DIDCommV2Message } from './v2/DIDCommV2Message'

import { Lifecycle, scoped } from 'tsyringe'

import { AriesFrameworkError } from '../../error'
import { JsonEncoder } from '../../utils'
import { AgentConfig } from '../AgentConfig'

import { DIDCommVersion } from './DIDCommMessage'
import { DidCommV1Algorithms, DidCommV1Types, SendingMessageType } from './types'
import { DIDCommV1EnvelopeService } from './v1/DIDCommV1EnvelopeService'
import { DIDCommV2EnvelopeService } from './v2/DIDCommV2EnvelopeService'

export type PackMessageParams = DIDCommV1PackMessageParams | DIDCommV2PackMessageParams
export type PackMessageSignedParams = DIDCommV2PackMessageSignedParams

export interface PlaintextMessage {
  '@type'?: string
  '@id'?: string
  type?: string
  id?: string
  [key: string]: unknown
}

@scoped(Lifecycle.ContainerScoped)
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

  public async packMessageEncrypted(payload: DIDCommMessage, params: PackMessageParams): Promise<EncryptedMessage> {
    if (payload.version === DIDCommVersion.V1) {
      return this.didCommV1EnvelopeService.packMessageEncrypted(
        payload as DIDCommV1Message,
        params as DIDCommV1PackMessageParams
      )
    }
    if (payload.version === DIDCommVersion.V2) {
      return this.didCommV2EnvelopeService.packMessageEncrypted(
        payload as DIDCommV2Message,
        params as DIDCommV2PackMessageParams
      )
    }
    throw new AriesFrameworkError(`Unexpected DIDComm version: ${payload.version}`)
  }

  public async packMessageSigned(payload: DIDCommMessage, params: PackMessageSignedParams): Promise<EncryptedMessage> {
    if (payload.version === DIDCommVersion.V1) {
      throw new AriesFrameworkError(`Pack message signed is not supported for DIDComm V1 message`)
    }
    if (payload.version === DIDCommVersion.V2) {
      return this.didCommV2EnvelopeService.packMessageSigned(
        payload as DIDCommV2Message,
        params as DIDCommV2PackMessageSignedParams
      )
    }
    throw new AriesFrameworkError(`Unexpected DIDComm version: ${payload.version}`)
  }

  public async unpackMessage(message: PackedMessage): Promise<DecryptedMessageContext> {
    if (message.type === SendingMessageType.Encrypted) {
      const protectedValue = JsonEncoder.fromBase64(message.message.protected) as ProtectedMessage
      if (!protectedValue) {
        throw new AriesFrameworkError(`Unable to unpack message.`)
      }
      if (
        protectedValue.typ === DidCommV1Types.JwmV1 &&
        (protectedValue.alg === DidCommV1Algorithms.Anoncrypt || protectedValue.alg === DidCommV1Algorithms.Authcrypt)
      ) {
        const decryptedMessageContext = await this.didCommV1EnvelopeService.unpackMessage(message.message)
        return {
          plaintextMessage: decryptedMessageContext.plaintextMessage,
          sender: decryptedMessageContext.senderKey,
          recipient: decryptedMessageContext.recipientKey,
        }
      } else {
        const decryptedMessageContext = await this.didCommV2EnvelopeService.unpackMessage(message.message)
        return {
          plaintextMessage: decryptedMessageContext.plaintextMessage,
          sender: decryptedMessageContext.senderKid,
          recipient: decryptedMessageContext.recipientKid,
        }
      }
    }
    if (message.type === SendingMessageType.Signed) {
      const decryptedMessageContext = await this.didCommV2EnvelopeService.unpackMessage(message.message)
      return {
        plaintextMessage: decryptedMessageContext.plaintextMessage,
        sender: decryptedMessageContext.senderKid,
        recipient: decryptedMessageContext.recipientKid,
      }
    }
    return {
      plaintextMessage: message.message,
    }
  }
}
