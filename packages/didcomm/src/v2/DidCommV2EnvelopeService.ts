import {
  AgentContext,
  CredoError,
  InjectionSymbols,
  inject,
  injectable,
  JsonEncoder,
  Kms,
  type Logger,
  TypedArrayEncoder,
} from '@credo-ts/core'
import type { DidCommV2EncryptedMessage, DidCommV2PlaintextMessage } from './types'

export interface DidCommV2EnvelopeKeys {
  recipientKey: Kms.PublicJwk<Kms.X25519PublicJwk>
  senderKey: Kms.PublicJwk<Kms.X25519PublicJwk>
  /** DID URL of the sender key; used as skid in JWE so recipient can resolve it. Falls back to senderKey.keyId if absent. */
  senderKeySkid?: string
}

@injectable()
export class DidCommV2EnvelopeService {
  private logger: Logger

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger) {
    this.logger = logger
  }

  /**
   * Pack a DIDComm v2 plaintext message into an encrypted v2 envelope using ECDH-1PU (authcrypt).
   *
   * @param agentContext - The agent context (for KMS access)
   * @param plaintext - The v2 plaintext message to encrypt
   * @param keys - Recipient and sender X25519 keys
   * @returns The DIDComm v2 encrypted message (JWE with typ application/didcomm-encrypted+json)
   */
  public async pack(
    agentContext: AgentContext,
    plaintext: DidCommV2PlaintextMessage,
    keys: DidCommV2EnvelopeKeys
  ): Promise<DidCommV2EncryptedMessage> {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const plaintextBytes = JsonEncoder.toBuffer(plaintext)

    const recipientX25519 = keys.recipientKey
    if (!recipientX25519.is(Kms.X25519PublicJwk)) {
      throw new CredoError('DIDComm v2 authcrypt requires X25519 recipient key')
    }

    const { encrypted, iv, tag, encryptedKey } = await kms.encrypt({
      key: {
        keyAgreement: {
          algorithm: 'ECDH-1PU+A256KW',
          keyId: keys.senderKey.keyId,
          externalPublicJwk: recipientX25519.toJson(),
        },
      },
      encryption: { algorithm: 'A256GCM' },
      data: plaintextBytes,
    })

    if (!iv || !tag) {
      throw new CredoError('Expected iv and tag from KMS encrypt')
    }

    const epk = encryptedKey?.ephemeralPublicKey
    if (!epk) {
      throw new CredoError('ECDH-1PU must return ephemeral public key')
    }

    const skid = keys.senderKeySkid ?? keys.senderKey.keyId
    const protectedHeader = JsonEncoder.toBase64URL({
      typ: 'application/didcomm-encrypted+json',
      alg: 'ECDH-1PU+A256KW',
      enc: 'A256GCM',
      skid,
      recipients: [
        {
          header: {
            kid: keys.recipientKey.keyId,
            epk: { kty: epk.kty, crv: epk.crv, x: epk.x },
          },
          encrypted_key: TypedArrayEncoder.toBase64URL(encryptedKey.encrypted),
        },
      ],
    })

    return {
      protected: protectedHeader,
      iv: TypedArrayEncoder.toBase64URL(iv),
      ciphertext: TypedArrayEncoder.toBase64URL(encrypted),
      tag: TypedArrayEncoder.toBase64URL(tag),
    }
  }

  /**
   * Unpack a DIDComm v2 encrypted message (authcrypt only).
   *
   * @param agentContext - The agent context (for KMS access)
   * @param encrypted - The v2 encrypted message
   * @param keys - Recipient key and sender key resolver (skid → X25519)
   * @returns The plaintext message and sender key
   */
  public async unpack(
    agentContext: AgentContext,
    encrypted: DidCommV2EncryptedMessage,
    keys: {
      recipientKey: Kms.PublicJwk<Kms.X25519PublicJwk> & { keyId: string }
      /** Kid from the JWE recipient header we matched; used to select the recipient entry when it differs from recipientKey.keyId */
      matchedKid: string
      resolveSenderKey: (skid: string) => Promise<Kms.PublicJwk<Kms.X25519PublicJwk> | null>
    }
  ): Promise<{
    plaintext: DidCommV2PlaintextMessage
    senderKey: Kms.PublicJwk<Kms.X25519PublicJwk> | null
  }> {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const protectedJson = JsonEncoder.fromBase64(encrypted.protected)

    if (protectedJson.typ !== 'application/didcomm-encrypted+json') {
      throw new CredoError(`Invalid DIDComm v2 envelope typ: ${protectedJson.typ}`)
    }
    if (protectedJson.enc !== 'A256GCM') {
      throw new CredoError(`Unsupported enc: ${protectedJson.enc}`)
    }

    const recipients = protectedJson.recipients as Array<{
      header: { kid: string; epk: { kty: string; crv: string; x: string } }
      encrypted_key: string
    }>
    const recipient = recipients?.find((r) => r.header?.kid === keys.matchedKid)
    if (!recipient) {
      throw new CredoError('No matching recipient in envelope')
    }

    const epk = recipient.header.epk
    if (!epk || epk.kty !== 'OKP' || epk.crv !== 'X25519') {
      throw new CredoError('Invalid ephemeral public key in recipient header')
    }

    const skid = protectedJson.skid as string | undefined
    if (protectedJson.alg === 'ECDH-ES+A256KW' || !skid) {
      throw new CredoError(
        'DIDComm v2 anoncrypt is not supported. Only authcrypt (ECDH-1PU+A256KW with skid) is supported.'
      )
    }

    if (protectedJson.alg !== 'ECDH-1PU+A256KW') {
      throw new CredoError(`Unsupported pack algorithm: ${protectedJson.alg}`)
    }
    const senderKey = await keys.resolveSenderKey(skid)
    if (!senderKey) {
      throw new CredoError('Could not resolve sender key for skid')
    }
    const senderX25519 = senderKey.is(Kms.X25519PublicJwk)
      ? senderKey
      : (senderKey as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)

    const { data } = await kms.decrypt({
      key: {
        keyAgreement: {
          algorithm: 'ECDH-1PU+A256KW',
          keyId: keys.recipientKey.keyId,
          encryptedKey: {
            encrypted: TypedArrayEncoder.fromBase64(recipient.encrypted_key),
          },
          ephemeralPublicJwk: { kty: 'OKP', crv: 'X25519', x: epk.x },
          senderPublicJwk: senderX25519.toJson(),
        },
      },
      decryption: {
        algorithm: 'A256GCM',
        iv: TypedArrayEncoder.fromBase64(encrypted.iv),
        tag: TypedArrayEncoder.fromBase64(encrypted.tag),
      },
      encrypted: TypedArrayEncoder.fromBase64(encrypted.ciphertext),
    })

    const plaintext = JsonEncoder.fromBuffer(data) as DidCommV2PlaintextMessage
    this.logger.debug('Unpacked DIDComm v2 message', { type: plaintext.type })

    return { plaintext, senderKey: senderX25519 }
  }
}
