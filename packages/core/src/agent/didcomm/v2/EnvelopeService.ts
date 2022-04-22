import type { Logger } from '../../../logger'
import type { EncryptedMessage } from '../../../types'
import type { DIDCommV2Message } from '../v2/DIDCommV2Message'

import { Message } from 'didcomm'
import { scoped, Lifecycle } from 'tsyringe'

import { JsonEncoder } from '../../../utils'
import { AgentConfig } from '../../AgentConfig'

import { DIDResolverService } from './DIDResolverService'
import { SecretResolverService } from './SecretResolverService'

export interface EnvelopeDIDs {
  toDID: string
  fromDID: string
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
  recipientKids?: string[]
}

@scoped(Lifecycle.ContainerScoped)
class EnvelopeService {
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

  public async packMessage(payload: DIDCommV2Message, dids: EnvelopeDIDs): Promise<EncryptedMessage> {
    const message = new Message(payload)
    const [encryptedMsg] = await message.pack_encrypted(
      dids.toDID,
      dids.fromDID,
      dids.signByDID,
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
    return {
      senderKid: unpackMetadata.encrypted_from_kid,
      recipientKids: unpackMetadata.encrypted_to_kids,
      plaintextMessage: unpackedMsg.as_value(),
    }
  }
}

export { EnvelopeService }
