import {
  AgentContext,
  CredoError,
  DidsApi,
  JsonEncoder,
  Kms,
  RecordNotFoundError,
  TypedArrayEncoder,
} from '@credo-ts/core'
import type { AgentMessage } from './AgentMessage'
import type { EncryptedMessage, PlaintextMessage } from './types'

import { InjectionSymbols, Logger, inject, injectable } from '@credo-ts/core'

import { DidCommModuleConfig } from './DidCommModuleConfig'
import { OutOfBandRepository, OutOfBandRole } from './modules'
import { getOutOfBandInlineServicesWithSigningKeyId } from './modules/connections/services/helpers'
import { ForwardMessage } from './modules/routing/messages'
import { DidCommDocumentService } from './services'

export interface EnvelopeKeys {
  recipientKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  senderKey: Kms.PublicJwk<Kms.Ed25519PublicJwk> | null
}

@injectable()
export class EnvelopeService {
  private logger: Logger
  private didcommDocumentService: DidCommDocumentService

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger, didcommDocumentService: DidCommDocumentService) {
    this.logger = logger
    this.didcommDocumentService = didcommDocumentService
  }

  private async encryptDidcommV1Message(
    agentContext: AgentContext,
    message: PlaintextMessage,
    recipientKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[],
    senderKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk> | null
  ): Promise<EncryptedMessage> {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    // Generally we would never generate the content encryption key outside of the KMS
    // However how DIDcommV1 is specified to calcualte the aad we need the encrypted content
    // encryption key, and thus we can't use the normal combined key agrement + encryption flow
    const { bytes: contentEncryptionKey } = kms.randomBytes({ length: 32 })

    const recipients: Array<{
      encrypted_key: string
      header: {
        kid: string

        // In case of Authcrypt
        sender?: string
        iv?: string
      }
    }> = []

    for (const recipientKey of recipientKeys) {
      let encryptedSender: string | undefined = undefined

      if (senderKey) {
        // Encrypt the sender
        const { encrypted } = await kms.encrypt({
          key: {
            algorithm: 'ECDH-HSALSA20',
            // DIDComm v1 uses Ed25519 keys but encryption happens with X25519 keys
            externalPublicJwk: recipientKey.jwk.toX25519PublicJwk(),
          },
          encryption: {
            algorithm: 'XSALSA20-POLY1305',
          },
          data: TypedArrayEncoder.fromString(TypedArrayEncoder.toBase58(senderKey.publicKey.publicKey)),
        })

        encryptedSender = TypedArrayEncoder.toBase64URL(encrypted)
      }

      // Encrypt the key
      const { encrypted, iv } = await kms.encrypt({
        key: {
          algorithm: 'ECDH-HSALSA20',
          externalPublicJwk: recipientKey.jwk.toX25519PublicJwk(),

          // Sender key only needed for Authcrypt
          keyId: senderKey?.keyId,
        },
        data: contentEncryptionKey,
        encryption: {
          algorithm: 'XSALSA20-POLY1305',
        },
      })

      recipients.push({
        encrypted_key: TypedArrayEncoder.toBase64URL(encrypted),
        header: {
          kid: TypedArrayEncoder.toBase58(recipientKey.publicKey.publicKey),
          iv: iv ? TypedArrayEncoder.toBase64URL(iv) : undefined,
          sender: encryptedSender,
        },
      })
    }

    const protectedString = JsonEncoder.toBase64URL({
      enc: 'xchacha20poly1305_ietf',
      typ: 'JWM/1.0',
      alg: senderKey ? 'Authcrypt' : 'Anoncrypt',
      recipients,
    })

    // Perofrm the actual encryption
    const { encrypted, iv, tag } = await kms.encrypt({
      encryption: {
        algorithm: 'XC20P',
        aad: TypedArrayEncoder.fromString(protectedString),
      },
      data: JsonEncoder.toBuffer(message),
      key: {
        kty: 'oct',
        k: TypedArrayEncoder.toBase64URL(contentEncryptionKey),
      },
    })

    if (!iv || !tag) {
      throw new CredoError("Expected 'iv' and 'tag' to be defined")
    }

    return {
      ciphertext: TypedArrayEncoder.toBase64URL(encrypted),
      iv: TypedArrayEncoder.toBase64URL(iv),
      tag: TypedArrayEncoder.toBase64URL(tag),
      protected: protectedString,
    } satisfies EncryptedMessage
  }

  private async decryptDidcommV1Message(agentContext: AgentContext, encryptedMessage: EncryptedMessage) {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const _dids = agentContext.dependencyManager.resolve(DidsApi)
    const protectedJson = JsonEncoder.fromBase64(encryptedMessage.protected)

    const alg = protectedJson.alg as 'Anoncrypt' | 'Authcrypt'
    if (alg !== 'Anoncrypt' && alg !== 'Authcrypt') {
      throw new CredoError(`Unsupported pack algorithm: ${alg}`)
    }

    if (protectedJson.enc !== 'xchacha20poly1305_ietf') {
      throw new CredoError(`Unsupported enc algorithm: ${protectedJson.enc}`)
    }

    let recipientKey: Kms.PublicJwk<Kms.Ed25519PublicJwk> | undefined = undefined
    let recipient:
      | {
          header: {
            kid: string
            iv?: string
            sender?: string
          }
          encrypted_key: string
        }
      | undefined = undefined

    for (const _recipient of protectedJson.recipients) {
      const publicKey = Kms.PublicJwk.fromPublicKey<Kms.Ed25519PublicJwk>({
        kty: 'OKP',
        crv: 'Ed25519',
        publicKey: TypedArrayEncoder.fromBase58(_recipient.header.kid),
      })

      // We need to find the associated did based on the recipient key
      // so we can extract the kms key id from the did record.
      try {
        const { didDocument, didRecord } =
          await this.didcommDocumentService.resolveCreatedDidRecordWithDocumentByRecipientKey(agentContext, publicKey)

        const verificationMethod = didDocument.findVerificationMethodByPublicKey(publicKey)
        const kmsKeyId = didRecord.keys?.find(({ didDocumentRelativeKeyId }) =>
          verificationMethod.id.endsWith(didDocumentRelativeKeyId)
        )?.kmsKeyId

        publicKey.keyId = kmsKeyId ?? publicKey.legacyKeyId
        recipientKey = publicKey
        recipient = _recipient
        break
      } catch (error) {
        // If there is no did record yet, we need to look at the out of band record
        if (error instanceof RecordNotFoundError) {
          const outOfBandRepository = agentContext.dependencyManager.resolve(OutOfBandRepository)
          const outOfBandRecord = await outOfBandRepository.findSingleByQuery(agentContext, {
            recipientKeyFingerprints: [publicKey.fingerprint],
            role: OutOfBandRole.Sender,
          })

          if (!outOfBandRecord) continue

          const services = getOutOfBandInlineServicesWithSigningKeyId(outOfBandRecord)

          for (const service of services) {
            const _recipientKey = service.recipientKeys.find((recipientKey) => recipientKey.equals(publicKey))

            if (_recipientKey) {
              recipientKey = _recipientKey
              recipient = _recipient
              break
            }
          }
        }
      }
    }

    if (!recipientKey || !recipient) {
      throw new CredoError('No corresponding recipient key found')
    }

    if (alg === 'Authcrypt' && (!recipient.header.sender || !recipient.header.iv)) {
      throw new CredoError('Sender and iv header values are required for Authcrypt')
    }

    let senderPublicJwk: Kms.PublicJwk<Kms.Ed25519PublicJwk> | undefined = undefined
    if (recipient.header.sender) {
      const { data } = await kms.decrypt({
        key: {
          algorithm: 'ECDH-HSALSA20',
          keyId: recipientKey.keyId,
        },
        decryption: {
          algorithm: 'XSALSA20-POLY1305',
        },
        encrypted: TypedArrayEncoder.fromBase64(recipient.header.sender),
      })

      senderPublicJwk = Kms.PublicJwk.fromPublicKey({
        crv: 'Ed25519',
        kty: 'OKP',
        publicKey: TypedArrayEncoder.fromBase58(TypedArrayEncoder.toUtf8String(data)),
      })
    }

    // Perofrm the actual decryption
    const { data: contentEncryptionKey } = await kms.decrypt({
      decryption: {
        algorithm: 'XSALSA20-POLY1305',
        iv: recipient.header.iv ? TypedArrayEncoder.fromBase64(recipient.header.iv) : undefined,
      },
      encrypted: TypedArrayEncoder.fromBase64(recipient.encrypted_key),
      key: {
        algorithm: 'ECDH-HSALSA20',
        keyId: recipientKey.keyId,

        // Optionally we have a sender
        externalPublicJwk: senderPublicJwk?.jwk.toX25519PublicJwk(),
      },
    })

    const { data: message } = await kms.decrypt({
      decryption: {
        algorithm: 'XC20P',
        iv: TypedArrayEncoder.fromBase64(encryptedMessage.iv),
        tag: TypedArrayEncoder.fromBase64(encryptedMessage.tag),
        aad: TypedArrayEncoder.fromString(encryptedMessage.protected),
      },
      key: {
        kty: 'oct',
        k: TypedArrayEncoder.toBase64URL(contentEncryptionKey),
      },
      encrypted: TypedArrayEncoder.fromBase64(encryptedMessage.ciphertext),
    })

    return {
      plaintextMessage: JsonEncoder.fromBuffer(message),
      senderKey: senderPublicJwk,
      recipientKey,
    }
  }

  public async packMessage(
    agentContext: AgentContext,
    payload: AgentMessage,
    keys: EnvelopeKeys
  ): Promise<EncryptedMessage> {
    const didcommConfig = agentContext.dependencyManager.resolve(DidCommModuleConfig)

    const { routingKeys, senderKey } = keys
    let recipientKeys = keys.recipientKeys

    // pass whether we want to use legacy did sov prefix
    const message = payload.toJSON({ useDidSovPrefixWhereAllowed: didcommConfig.useDidSovPrefixWhereAllowed })

    this.logger.debug(`Pack outbound message ${message['@type']}`)

    let encryptedMessage = await this.encryptDidcommV1Message(agentContext, message, recipientKeys, senderKey)

    // If the message has routing keys (mediator) pack for each mediator
    for (const routingKey of routingKeys) {
      const forwardMessage = new ForwardMessage({
        // Forward to first recipient key
        to: TypedArrayEncoder.toBase58(recipientKeys[0].publicKey.publicKey),
        message: encryptedMessage,
      })
      recipientKeys = [routingKey]
      this.logger.debug('Forward message created', forwardMessage)

      const forwardJson = forwardMessage.toJSON({
        useDidSovPrefixWhereAllowed: didcommConfig.useDidSovPrefixWhereAllowed,
      })

      // Forward messages are anon packed
      encryptedMessage = await this.encryptDidcommV1Message(agentContext, forwardJson, [routingKey])
    }

    return encryptedMessage
  }

  public async unpackMessage(
    agentContext: AgentContext,
    encryptedMessage: EncryptedMessage
  ): Promise<DecryptedMessageContext> {
    const decryptedMessage = await this.decryptDidcommV1Message(agentContext, encryptedMessage)
    return decryptedMessage
  }
}

export interface DecryptedMessageContext {
  plaintextMessage: PlaintextMessage
  senderKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  recipientKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
}
