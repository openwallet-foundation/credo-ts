import type { EncryptedMessage, SignedMessage } from '../types'
import type { AgentContext } from './../../context'
import type { DIDCommV2Message } from './DIDCommV2Message'
import type { default as didcomm, IMessage } from 'didcomm'

import { Key } from '../../../crypto'
import { injectable } from '../../../plugins'
import { JsonEncoder } from '../../../utils'
import { AgentConfig } from '../../AgentConfig'

import { DIDResolverService } from './DIDResolverService'
import { SecretResolverService } from './SecretResolverService'

export interface PackMessageEncryptedParams {
  toDID: string
  fromDID?: string
  signByDID?: string
  serviceId?: string
  forward?: boolean
}

export interface PackMessageSignedParams {
  signByDID: string
}

export interface PlaintextMessage {
  type: string
  id: string
  [key: string]: unknown
}

export interface DecryptedMessageContext {
  plaintextMessage: PlaintextMessage
  senderKid?: Key
  recipientKid?: Key
}

@injectable()
export class DIDCommV2EnvelopeService {
  private didResolverService: DIDResolverService
  private secretResolverService: SecretResolverService
  private didcomm: typeof didcomm

  public constructor(
    agentConfig: AgentConfig,
    didResolverService: DIDResolverService,
    secretResolverService: SecretResolverService
  ) {
    this.didcomm = agentConfig.agentDependencies.didcomm
    this.didResolverService = didResolverService
    this.secretResolverService = secretResolverService
  }

  public async packMessageEncrypted(
    agentContext: AgentContext,
    payload: DIDCommV2Message,
    params: PackMessageEncryptedParams
  ): Promise<EncryptedMessage> {
    const message = new this.didcomm.Message(payload.toJSON() as IMessage)

    const [encryptedMsg] = await message.pack_encrypted(
      params.toDID,
      params.fromDID || null,
      params.signByDID || null,
      this.didResolverService.bindAgentContext(agentContext),
      this.secretResolverService,
      {
        messaging_service: params.serviceId,
        forward: params.forward,
      }
    )
    return JsonEncoder.fromString(encryptedMsg)
  }

  public async packMessageSigned(
    agentContext: AgentContext,
    payload: DIDCommV2Message,
    params: PackMessageSignedParams
  ): Promise<EncryptedMessage> {
    const message = new this.didcomm.Message(payload.toJSON() as IMessage)

    const [encryptedMsg] = await message.pack_signed(
      params.signByDID,
      this.didResolverService.bindAgentContext(agentContext),
      this.secretResolverService
    )
    return JsonEncoder.fromString(encryptedMsg)
  }

  public async unpackMessage(
    agentContext: AgentContext,
    packedMessage: EncryptedMessage | SignedMessage
  ): Promise<DecryptedMessageContext> {
    const [unpackedMsg, unpackMetadata] = await this.didcomm.Message.unpack(
      JsonEncoder.toString(packedMessage),
      this.didResolverService.bindAgentContext(agentContext),
      this.secretResolverService,
      {}
    )

    // FIXME: DIDComm V2 returns `kid` instead of base58 key.
    // We cannot simply create Key object as for DIDComm V1 from base58 representation
    // So we use helper parsing kid
    const senderKid = unpackMetadata.encrypted_from_kid
      ? Key.fromPublicKeyId(unpackMetadata.encrypted_from_kid)
      : undefined

    const recipientKid =
      unpackMetadata.encrypted_to_kids?.length && unpackMetadata.encrypted_to_kids[0]
        ? Key.fromPublicKeyId(unpackMetadata.encrypted_to_kids[0])
        : undefined

    return {
      senderKid,
      recipientKid,
      plaintextMessage: unpackedMsg.as_value(),
    }
  }
}
