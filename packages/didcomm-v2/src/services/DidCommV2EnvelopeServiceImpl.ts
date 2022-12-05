import type {
  DidCommV2EnvelopeService,
  AgentContext,
  DidCommV2Message,
  V2PackMessageParams,
  EncryptedMessage,
  SignedMessage,
  DecryptedMessageContext,
} from '@aries-framework/core'
import type { default as didcommLibrary, IMessage } from 'didcomm'

import {
  injectable,
  EnvelopeType,
  JsonEncoder,
  AriesFrameworkError,
  Key,
  DidCommMessageVersion,
  inject,
} from '@aries-framework/core'

import { DidCommV2DidResolver } from './DidCommV2DidResolver'
import { DidCommV2SecretsResolver } from './DidCommV2SecretsResolver'

export const DIDCommV2LibraryToken = Symbol('DIDCommV2LibraryToken')

@injectable()
export class DidCommV2EnvelopeServiceImpl implements DidCommV2EnvelopeService {
  private didcomm: typeof didcommLibrary

  public constructor(@inject(DIDCommV2LibraryToken) didcomm: typeof didcommLibrary) {
    this.didcomm = didcomm
  }

  public async packMessage(
    agentContext: AgentContext,
    payload: DidCommV2Message,
    params: V2PackMessageParams
  ): Promise<EncryptedMessage> {
    const message = new this.didcomm.Message(payload.toJSON() as IMessage)

    const didResolver = agentContext.dependencyManager.resolve(DidCommV2DidResolver)
    const secretsResolver = agentContext.dependencyManager.resolve(DidCommV2SecretsResolver)

    if (params.envelopeType === EnvelopeType.Signed && params.signByDid) {
      const [encryptedMsg] = await message.pack_signed(params.signByDid, didResolver, secretsResolver)
      return JsonEncoder.fromString(encryptedMsg)
    }
    if ((params.envelopeType === EnvelopeType.Encrypted || !params.envelopeType) && params.toDid) {
      const [encryptedMsg] = await message.pack_encrypted(
        params.toDid,
        params.fromDid || null,
        params.signByDid || null,
        didResolver,
        secretsResolver,
        {
          messaging_service: params.serviceId,
          forward: params.wrapIntoForward,
        }
      )
      return JsonEncoder.fromString(encryptedMsg)
    }
    throw new AriesFrameworkError('Unexpected case')
  }

  public async unpackMessage(
    agentContext: AgentContext,
    packedMessage: EncryptedMessage | SignedMessage
  ): Promise<DecryptedMessageContext> {
    const didResolver = agentContext.dependencyManager.resolve(DidCommV2DidResolver)
    const secretsResolver = agentContext.dependencyManager.resolve(DidCommV2SecretsResolver)

    const [unpackedMsg, unpackMetadata] = await this.didcomm.Message.unpack(
      JsonEncoder.toString(packedMessage),
      didResolver,
      secretsResolver,
      {}
    )

    let senderKey: Key | undefined = undefined
    let recipientKey: Key | undefined = undefined

    try {
      // FIXME: DIDComm V2 returns `kid` instead of base58 key.
      // We cannot simply create Key object as for DIDComm V1 from base58 representation
      // So we use helper parsing kid
      senderKey = unpackMetadata.encrypted_from_kid ? Key.fromPublicKeyId(unpackMetadata.encrypted_from_kid) : undefined

      recipientKey =
        unpackMetadata.encrypted_to_kids?.length && unpackMetadata.encrypted_to_kids[0]
          ? Key.fromPublicKeyId(unpackMetadata.encrypted_to_kids[0])
          : undefined
    } catch (e) {
      // nothing
    }

    return {
      senderKey,
      recipientKey,
      plaintextMessage: unpackedMsg.as_value(),
      didCommVersion: DidCommMessageVersion.V2,
    }
  }
}
