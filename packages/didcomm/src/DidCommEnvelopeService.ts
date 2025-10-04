import {
  AgentContext,
  CredoError,
  InjectionSymbols,
  JsonEncoder,
  Kms,
  RecordNotFoundError,
  TypedArrayEncoder,
  inject,
} from '@credo-ts/core'
import type { DidCommMessage } from './DidCommMessage'
import type { DidCommEncryptedMessage, DidCommPlaintextMessage } from './types'

import { Logger, injectable } from '@credo-ts/core'

import { DidCommModuleConfig } from './DidCommModuleConfig'
import { getResolvedDidcommServiceWithSigningKeyId } from './modules/connections/services/helpers'
import { DidCommOutOfBandRole } from './modules/oob/domain/DidCommOutOfBandRole'
import { DidCommOutOfBandRepository } from './modules/oob/repository/DidCommOutOfBandRepository'
import { DidCommOutOfBandRecordMetadataKeys } from './modules/oob/repository/outOfBandRecordMetadataTypes'
import { DidCommForwardMessage } from './modules/routing/messages/DidCommForwardMessage'
import { DidCommMediatorRoutingRepository } from './modules/routing/repository/DidCommMediatorRoutingRepository'
import { DidCommDocumentService } from './services/DidCommDocumentService'

export interface EnvelopeKeys {
  recipientKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  routingKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]
  senderKey: Kms.PublicJwk<Kms.Ed25519PublicJwk> | null
}

@injectable()
export class DidCommEnvelopeService {
  private logger: Logger
  private didcommDocumentService: DidCommDocumentService

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger, didcommDocumentService: DidCommDocumentService) {
    this.logger = logger
    this.didcommDocumentService = didcommDocumentService
  }

  private async encryptDidcommV1Message(
    agentContext: AgentContext,
    message: DidCommPlaintextMessage,
    recipientKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[],
    senderKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk> | null
  ): Promise<DidCommEncryptedMessage> {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    // Generally we would never generate the content encryption key outside of the KMS
    // However how DIDcommV1 is specified to calcualte the aad we need the encrypted content
    // encryption key, and thus we can't use the normal combined key agrement + encryption flow
    const contentEncryptionKey = kms.randomBytes({ length: 32 })

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
            keyAgreement: {
              algorithm: 'ECDH-HSALSA20',
              // DIDComm v1 uses Ed25519 keys but encryption happens with X25519 keys
              externalPublicJwk: recipientKey.convertTo(Kms.X25519PublicJwk).toJson(),
            },
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
          keyAgreement: {
            algorithm: 'ECDH-HSALSA20',
            externalPublicJwk: recipientKey.convertTo(Kms.X25519PublicJwk).toJson(),

            // Sender key only needed for Authcrypt
            keyId: senderKey?.keyId,
          },
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
        algorithm: 'C20P',
        aad: TypedArrayEncoder.fromString(protectedString),
      },
      data: JsonEncoder.toBuffer(message),
      key: {
        privateJwk: {
          kty: 'oct',
          k: TypedArrayEncoder.toBase64URL(contentEncryptionKey),
        },
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
    } satisfies DidCommEncryptedMessage
  }

  private async decryptDidcommV1Message(agentContext: AgentContext, encryptedMessage: DidCommEncryptedMessage) {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const protectedJson = JsonEncoder.fromBase64(encryptedMessage.protected)

    const alg = protectedJson.alg as 'Anoncrypt' | 'Authcrypt'
    if (alg !== 'Anoncrypt' && alg !== 'Authcrypt') {
      throw new CredoError(`Unsupported pack algorithm: ${alg}`)
    }

    if (protectedJson.enc !== 'xchacha20poly1305_ietf') {
      throw new CredoError(`Unsupported enc algorithm: ${protectedJson.enc}`)
    }

    let recipientKey: Kms.PublicJwk<Kms.Ed25519PublicJwk> | null = null
    let recipient: {
      header: {
        kid: string
        iv?: string
        sender?: string
      }
      encrypted_key: string
    } | null = null

    for (const _recipient of protectedJson.recipients) {
      recipientKey = await this.extractOurRecipientKeyWithKeyId(agentContext, _recipient)

      if (recipientKey) {
        recipient = _recipient
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
          keyAgreement: {
            algorithm: 'ECDH-HSALSA20',
            keyId: recipientKey.keyId,
          },
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
        keyAgreement: {
          algorithm: 'ECDH-HSALSA20',
          keyId: recipientKey.keyId,

          // Optionally we have a sender
          externalPublicJwk: senderPublicJwk?.convertTo(Kms.X25519PublicJwk).toJson(),
        },
      },
    })

    const { data: message } = await kms.decrypt({
      decryption: {
        algorithm: 'C20P',
        iv: TypedArrayEncoder.fromBase64(encryptedMessage.iv),
        tag: TypedArrayEncoder.fromBase64(encryptedMessage.tag),
        aad: TypedArrayEncoder.fromString(encryptedMessage.protected),
      },
      key: {
        privateJwk: {
          kty: 'oct',
          k: TypedArrayEncoder.toBase64URL(contentEncryptionKey),
        },
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
    payload: DidCommMessage,
    keys: EnvelopeKeys
  ): Promise<DidCommEncryptedMessage> {
    const didcommConfig = agentContext.dependencyManager.resolve(DidCommModuleConfig)

    const { routingKeys, senderKey } = keys
    let recipientKeys = keys.recipientKeys

    // pass whether we want to use legacy did sov prefix
    const message = payload.toJSON({ useDidSovPrefixWhereAllowed: didcommConfig.useDidSovPrefixWhereAllowed })

    this.logger.debug(`Pack outbound message ${message['@type']}`)

    let encryptedMessage = await this.encryptDidcommV1Message(agentContext, message, recipientKeys, senderKey)

    // If the message has routing keys (mediator) pack for each mediator
    for (const routingKey of routingKeys) {
      const forwardMessage = new DidCommForwardMessage({
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

    this.logger.debug(`Packed outbound message ${message['@type']}`, {
      routingKeys: routingKeys.map((routingKey) => routingKey.fingerprint),
    })

    return encryptedMessage
  }

  public async unpackMessage(
    agentContext: AgentContext,
    encryptedMessage: DidCommEncryptedMessage
  ): Promise<DecryptedDidCommMessageContext> {
    const decryptedMessage = await this.decryptDidcommV1Message(agentContext, encryptedMessage)
    return decryptedMessage
  }

  private async extractOurRecipientKeyWithKeyId(
    agentContext: AgentContext,
    recipient: {
      header: {
        kid: string
      }
    }
  ): Promise<Kms.PublicJwk<Kms.Ed25519PublicJwk> | null> {
    const kms = agentContext.resolve(Kms.KeyManagementApi)

    const publicKey = Kms.PublicJwk.fromPublicKey({
      kty: 'OKP',
      crv: 'Ed25519',
      publicKey: TypedArrayEncoder.fromBase58(recipient.header.kid),
    })

    // We need to find the associated did based on the recipient key
    // so we can extract the kms key id from the did record.
    try {
      const { didDocument, keys } = await this.didcommDocumentService.resolveCreatedDidDocumentWithKeysByRecipientKey(
        agentContext,
        publicKey
      )

      const verificationMethod = didDocument.findVerificationMethodByPublicKey(publicKey)
      const kmsKeyId = keys?.find(({ didDocumentRelativeKeyId }) =>
        verificationMethod.id.endsWith(didDocumentRelativeKeyId)
      )?.kmsKeyId

      agentContext.config.logger.debug(
        `Found did '${didDocument.id}' for recipient key '${publicKey.fingerprint}' for incoming didcomm message`
      )

      publicKey.keyId = kmsKeyId ?? publicKey.legacyKeyId
      return publicKey
    } catch (error) {
      // If there is no did record yet, we first look at the mediator routing record
      const mediatorRoutingRepository = agentContext.dependencyManager.resolve(DidCommMediatorRoutingRepository)
      if (error instanceof RecordNotFoundError) {
        const mediatorRoutingRecord = await mediatorRoutingRepository.findSingleByQuery(agentContext, {
          routingKeyFingerprints: [publicKey.fingerprint],
        })

        if (mediatorRoutingRecord) {
          agentContext.config.logger.debug(
            `Found mediator routing record with id '${mediatorRoutingRecord.id}' for recipient key '${publicKey.fingerprint}' for incoming didcomm message`
          )

          const routingKey = mediatorRoutingRecord.routingKeysWithKeyId.find((routingKey) =>
            publicKey.equals(routingKey)
          )

          // This should not happen as we only get here if the tag matches
          if (!routingKey) {
            throw new CredoError(
              `Expected to find key with fingerprint '${publicKey.fingerprint}' in routing keys of mediator routing record '${mediatorRoutingRecord.id}'`
            )
          }

          if (routingKey) {
            return routingKey
          }
        }

        //  If there is no mediator routing record, we look at the out of band record
        const outOfBandRepository = agentContext.dependencyManager.resolve(DidCommOutOfBandRepository)
        const outOfBandRecord = await outOfBandRepository.findSingleByQuery(agentContext, {
          $or: [
            // In case we are the creator of the out of band invitation we can query based on
            // out of band invitation recipient key fingerprint
            {
              role: DidCommOutOfBandRole.Sender,
              recipientKeyFingerprints: [publicKey.fingerprint],
            },
            // In case we are the receiver of the out of band invitation we need to query
            // for the recipient routing fingerprint
            {
              role: DidCommOutOfBandRole.Receiver,
              recipientRoutingKeyFingerprint: publicKey.fingerprint,
            },
          ],
        })

        if (outOfBandRecord?.role === DidCommOutOfBandRole.Sender) {
          agentContext.config.logger.debug(
            `Found out of band record with id '${outOfBandRecord.id}' and role '${outOfBandRecord.role}' for recipient key '${publicKey.fingerprint}' for incoming didcomm message`
          )

          for (const service of outOfBandRecord.outOfBandInvitation.getInlineServices()) {
            const resolvedService = getResolvedDidcommServiceWithSigningKeyId(
              service,
              outOfBandRecord.invitationInlineServiceKeys
            )
            const _recipientKey = resolvedService.recipientKeys.find((recipientKey) => recipientKey.equals(publicKey))

            if (_recipientKey) {
              return _recipientKey
            }
          }
        } else if (outOfBandRecord?.role === DidCommOutOfBandRole.Receiver) {
          agentContext.config.logger.debug(
            `Found out of band record with id '${outOfBandRecord.id}' and role '${outOfBandRecord.role}' for recipient key '${publicKey.fingerprint}' for incoming didcomm message`
          )

          // If there is still no key we need to look at the metadata
          const recipieintRouting = outOfBandRecord.metadata.get(DidCommOutOfBandRecordMetadataKeys.RecipientRouting)
          if (recipieintRouting?.recipientKeyFingerprint === publicKey.fingerprint) {
            publicKey.keyId = recipieintRouting.recipientKeyId ?? publicKey.legacyKeyId
            return publicKey
          }
        }

        // If there is no did found, no out of band record found, and not mediator routing record
        // this is either:
        //  - a connectionless oob exchange initiated before we added key ids.
        //  - a message for a mediator, where the mediator routing record is created before we added key ids
        //
        // We will check if the public key exists based on the base58 encoded public key. We can remove this flow once we create a migration
        // that optimizes this flow.
        const kmsJwkPublic = await kms
          .getPublicKey({
            keyId: publicKey.legacyKeyId,
          })
          .catch((error) => {
            if (error instanceof Kms.KeyManagementKeyNotFoundError) return null
            throw error
          })
        if (kmsJwkPublic) {
          agentContext.config.logger.debug(
            `Found public key with legacy key id '${publicKey.legacyKeyId}' for recipient key '${publicKey.fingerprint}' for incoming didcomm message`
          )

          publicKey.keyId = publicKey.legacyKeyId
          return publicKey
        }
      }
    }

    // no match found
    return null
  }
}

export interface DecryptedDidCommMessageContext {
  plaintextMessage: DidCommPlaintextMessage
  senderKey?: Kms.PublicJwk<Kms.Ed25519PublicJwk>
  recipientKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>
}
