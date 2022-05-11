import type { Logger } from '../../../logger'
import type { EncryptedMessage } from '../types'
import type { DIDCommV2Message } from '../v2/DIDCommV2Message'

import { Message } from 'didcomm-node'
import { scoped, Lifecycle } from 'tsyringe'

import { JsonEncoder } from '../../../utils'
import { AgentConfig } from '../../AgentConfig'

import { DIDResolverService } from './DIDResolverService'
import { SecretResolverService } from './SecretResolverService'

export interface PackMessageParams {
  toDID: string
  fromDID: string | null
  signByDID: string | null
}

export interface PlaintextMessage {
  type: string
  id: string
  [key: string]: unknown
}

export interface DecryptedMessageContext {
  plaintextMessage: PlaintextMessage
  senderKid?: string
  recipientKid?: string
}

@scoped(Lifecycle.ContainerScoped)
export class DIDCommV2EnvelopeService {
  private logger: Logger
  private didResolverService: DIDResolverService
  private secretResolverService: SecretResolverService

  public constructor(
    agentConfig: AgentConfig,
    didResolverService: DIDResolverService,
    secretResolverService: SecretResolverService
  ) {
    this.logger = agentConfig.logger
    this.didResolverService = didResolverService
    this.secretResolverService = secretResolverService
  }

  public async packMessage(payload: DIDCommV2Message, params: PackMessageParams): Promise<EncryptedMessage> {
    const message = new Message(payload)

    const [encryptedMsg] = await message.pack_encrypted(
      params.toDID,
      params.fromDID,
      params.signByDID,
      this.didResolverService,
      this.secretResolverService,
      {}
    )
    return JsonEncoder.fromString(encryptedMsg)
  }

  public async unpackMessage(encryptedMessage: EncryptedMessage): Promise<DecryptedMessageContext> {
    const [unpackedMsg, unpackMetadata] = await Message.unpack(
      JsonEncoder.toString(encryptedMessage),
      this.didResolverService,
      this.secretResolverService,
      {}
    )

    // find actual key decrypted message
    // TODO: it will be great of `didcomm` package return this data
    let recipient: string | undefined
    for (const recipientKid of unpackMetadata.encrypted_to_kids || []) {
      const secret = await this.secretResolverService.get_secret(recipientKid)
      if (secret) {
        recipient = recipientKid
        break
      }
    }

    return {
      senderKid: unpackMetadata.encrypted_from_kid,
      recipientKid: recipient,
      plaintextMessage: unpackedMsg.as_value(),
    }
  }
}
