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
import { computeApu, computeApv } from './apuApv'
import type { DidCommV2ContentEncryptionAlgorithm, DidCommV2EncryptedMessage, DidCommV2PlaintextMessage } from './types'

export type DidCommV2KeyAgreementJwk = Kms.PublicJwk<Kms.X25519PublicJwk | Kms.P256PublicJwk>

type EpkJwk = { kty: 'OKP'; crv: 'X25519'; x: string } | { kty: 'EC'; crv: 'P-256'; x: string; y: string }

export interface DidCommV2EnvelopeKeys {
  recipientKey: DidCommV2KeyAgreementJwk
  senderKey: DidCommV2KeyAgreementJwk
  /** DID URL of the sender key; used as skid in JWE so recipient can resolve it. Falls back to senderKey.keyId if absent. */
  senderKeySkid?: string
  /** Content encryption algorithm. Defaults to A256CBC-HS512 (mandatory authcrypt enc per DIDComm v2.1). */
  contentEncryptionAlgorithm?: DidCommV2ContentEncryptionAlgorithm
}

/** Keys for anoncrypt: only recipient key; no sender (anonymous). */
export interface DidCommV2AnoncryptKeys {
  recipientKey: DidCommV2KeyAgreementJwk
  /** Content encryption algorithm. Defaults to A256CBC-HS512; A256GCM is also accepted. */
  contentEncryptionAlgorithm?: DidCommV2ContentEncryptionAlgorithm
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
    const plaintextBytes = JsonEncoder.toUint8Array(plaintext)

    const recipientCurve = getKeyAgreementCurve(keys.recipientKey)
    const senderCurve = getKeyAgreementCurve(keys.senderKey)
    if (recipientCurve !== senderCurve) {
      throw new CredoError('DIDComm v2 authcrypt requires sender and recipient on the same curve')
    }

    const enc: DidCommV2ContentEncryptionAlgorithm = keys.contentEncryptionAlgorithm ?? 'A256CBC-HS512'
    const skid = keys.senderKeySkid ?? keys.senderKey.keyId
    const recipientKid = keys.recipientKey.keyId
    const apu = computeApu(skid)
    const apv = computeApv([recipientKid])

    const ephemeralKey = await kms.createKey({
      type: recipientCurve === 'X25519' ? { kty: 'OKP', crv: 'X25519' } : { kty: 'EC', crv: 'P-256' },
    })
    try {
      const epkJwk = toEpkJwk(ephemeralKey.publicJwk, recipientCurve)

      const protectedHeader = JsonEncoder.toBase64Url({
        typ: 'application/didcomm-encrypted+json',
        alg: 'ECDH-1PU+A256KW',
        enc,
        skid,
        apu: TypedArrayEncoder.toBase64Url(apu),
        apv: TypedArrayEncoder.toBase64Url(apv),
        epk: epkJwk,
      })

      const { encrypted, iv, tag, encryptedKey } = await kms.encrypt({
        key: {
          keyAgreement: {
            algorithm: 'ECDH-1PU+A256KW',
            keyId: keys.senderKey.keyId,
            ephemeralKeyId: ephemeralKey.keyId,
            externalPublicJwk: keys.recipientKey.toJson() as Kms.KmsJwkPublicEcdh,
            apu,
            apv,
          },
        },
        encryption: { algorithm: enc, aad: TypedArrayEncoder.fromUtf8String(protectedHeader) },
        data: plaintextBytes,
      })

      if (!iv || !tag) {
        throw new CredoError('Expected iv and tag from KMS encrypt')
      }
      if (!encryptedKey?.encrypted) {
        throw new CredoError('Expected encrypted key from KMS for ECDH-1PU+A256KW')
      }

      return {
        protected: protectedHeader,
        recipients: [
          {
            header: { kid: recipientKid },
            encrypted_key: TypedArrayEncoder.toBase64Url(encryptedKey.encrypted),
          },
        ],
        iv: TypedArrayEncoder.toBase64Url(iv),
        ciphertext: TypedArrayEncoder.toBase64Url(encrypted),
        tag: TypedArrayEncoder.toBase64Url(tag),
      }
    } finally {
      await kms.deleteKey({ keyId: ephemeralKey.keyId })
    }
  }

  /**
   * Pack a DIDComm v2 plaintext message using ECDH-ES (anoncrypt).
   * No sender identity; used for forwarded messages to mediators.
   *
   * @param agentContext - The agent context (for KMS access)
   * @param plaintext - The v2 plaintext message to encrypt
   * @param keys - Recipient X25519 key only
   * @returns The DIDComm v2 encrypted message (JWE with typ application/didcomm-encrypted+json)
   */
  public async packAnoncrypt(
    agentContext: AgentContext,
    plaintext: DidCommV2PlaintextMessage,
    keys: DidCommV2AnoncryptKeys
  ): Promise<DidCommV2EncryptedMessage> {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const plaintextBytes = JsonEncoder.toUint8Array(plaintext)

    const recipientCurve = getKeyAgreementCurve(keys.recipientKey)

    const enc: DidCommV2ContentEncryptionAlgorithm = keys.contentEncryptionAlgorithm ?? 'A256CBC-HS512'
    const recipientKid = keys.recipientKey.keyId
    const apv = computeApv([recipientKid])

    const ephemeralKey = await kms.createKey({
      type: recipientCurve === 'X25519' ? { kty: 'OKP', crv: 'X25519' } : { kty: 'EC', crv: 'P-256' },
    })

    try {
      const epkJwk = toEpkJwk(ephemeralKey.publicJwk, recipientCurve)

      const protectedHeader = JsonEncoder.toBase64Url({
        typ: 'application/didcomm-encrypted+json',
        alg: 'ECDH-ES+A256KW',
        enc,
        apv: TypedArrayEncoder.toBase64Url(apv),
        epk: epkJwk,
      })

      const { encrypted, iv, tag, encryptedKey } = await kms.encrypt({
        key: {
          keyAgreement: {
            algorithm: 'ECDH-ES+A256KW',
            keyId: ephemeralKey.keyId,
            externalPublicJwk: keys.recipientKey.toJson() as Kms.KmsJwkPublicEcdh,
            apv,
          },
        },
        encryption: { algorithm: enc, aad: TypedArrayEncoder.fromUtf8String(protectedHeader) },
        data: plaintextBytes,
      })

      if (!iv || !tag) {
        throw new CredoError('Expected iv and tag from KMS encrypt')
      }
      if (!encryptedKey?.encrypted) {
        throw new CredoError('Expected encrypted key from KMS for ECDH-ES+A256KW')
      }

      return {
        protected: protectedHeader,
        recipients: [
          {
            header: { kid: recipientKid },
            encrypted_key: TypedArrayEncoder.toBase64Url(encryptedKey.encrypted),
          },
        ],
        iv: TypedArrayEncoder.toBase64Url(iv),
        ciphertext: TypedArrayEncoder.toBase64Url(encrypted),
        tag: TypedArrayEncoder.toBase64Url(tag),
      }
    } finally {
      await kms.deleteKey({ keyId: ephemeralKey.keyId })
    }
  }

  /**
   * Unpack a DIDComm v2 encrypted message (authcrypt or anoncrypt).
   *
   * @param agentContext - The agent context (for KMS access)
   * @param encrypted - The v2 encrypted message
   * @param keys - Recipient key and sender key resolver (skid → X25519); resolveSenderKey not used for anoncrypt
   * @returns The plaintext message and sender key (null for anoncrypt)
   */
  public async unpack(
    agentContext: AgentContext,
    encrypted: DidCommV2EncryptedMessage,
    keys: {
      recipientKey: DidCommV2KeyAgreementJwk & { keyId: string }
      /** Kid from the JWE recipient header we matched; used to select the recipient entry when it differs from recipientKey.keyId */
      matchedKid: string
      resolveSenderKey: (skid: string) => Promise<Kms.PublicJwk | null>
    }
  ): Promise<{
    plaintext: DidCommV2PlaintextMessage
    senderKey: DidCommV2KeyAgreementJwk | null
  }> {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const protectedJson = JsonEncoder.fromBase64Url(encrypted.protected)

    if (protectedJson.typ !== 'application/didcomm-encrypted+json') {
      throw new CredoError(`Invalid DIDComm v2 envelope typ: ${protectedJson.typ}`)
    }

    const enc = protectedJson.enc
    if (enc !== 'A256GCM' && enc !== 'A256CBC-HS512') {
      throw new CredoError(`Unsupported enc: ${enc}`)
    }

    const recipient = encrypted.recipients?.find((r) => r.header?.kid === keys.matchedKid)
    if (!recipient) {
      throw new CredoError('No matching recipient in envelope')
    }

    const recipientCurve = getKeyAgreementCurve(keys.recipientKey)
    const epkJwk = toEpkJwk(protectedJson.epk, recipientCurve)

    const aad = TypedArrayEncoder.fromUtf8String(encrypted.protected)
    const apv = this.parseAndValidateApv(protectedJson, encrypted.recipients)

    if (protectedJson.alg === 'ECDH-ES+A256KW') {
      return this.unpackAnoncrypt(agentContext, encrypted, keys, recipient, epkJwk, enc, aad, apv)
    }

    if (protectedJson.alg !== 'ECDH-1PU+A256KW') {
      throw new CredoError(`Unsupported pack algorithm: ${protectedJson.alg}`)
    }

    const skid = protectedJson.skid as string | undefined
    if (!skid) {
      throw new CredoError('Authcrypt requires skid in protected header')
    }
    const apu = this.parseAndValidateApu(protectedJson, skid)
    const senderKey = await keys.resolveSenderKey(skid)
    if (!senderKey) {
      throw new CredoError('Could not resolve sender key for skid')
    }

    let senderForKdf: DidCommV2KeyAgreementJwk
    if (recipientCurve === 'P-256') {
      if (!senderKey.is(Kms.P256PublicJwk)) {
        throw new CredoError('Sender key must be P-256 when recipient is P-256')
      }
      senderForKdf = senderKey
    } else {
      senderForKdf = senderKey.is(Kms.X25519PublicJwk)
        ? senderKey
        : (senderKey as Kms.PublicJwk<Kms.Ed25519PublicJwk>).convertTo(Kms.X25519PublicJwk)
    }

    const { data } = await kms.decrypt({
      key: {
        keyAgreement: {
          algorithm: 'ECDH-1PU+A256KW',
          keyId: keys.recipientKey.keyId,
          encryptedKey: {
            encrypted: TypedArrayEncoder.fromBase64Url(recipient.encrypted_key),
          },
          ephemeralPublicJwk: epkJwk,
          senderPublicJwk: senderForKdf.toJson() as Kms.KmsJwkPublicEcdh,
          apu,
          apv,
        },
      },
      decryption: {
        algorithm: enc,
        iv: TypedArrayEncoder.fromBase64Url(encrypted.iv),
        tag: TypedArrayEncoder.fromBase64Url(encrypted.tag),
        aad,
      },
      encrypted: TypedArrayEncoder.fromBase64Url(encrypted.ciphertext),
    })

    const plaintext = JsonEncoder.fromUint8Array(data) as DidCommV2PlaintextMessage
    this.logger.debug('Unpacked DIDComm v2 authcrypt message', { type: plaintext.type })

    return { plaintext, senderKey: senderForKdf }
  }

  private async unpackAnoncrypt(
    agentContext: AgentContext,
    encrypted: DidCommV2EncryptedMessage,
    keys: {
      recipientKey: DidCommV2KeyAgreementJwk & { keyId: string }
      matchedKid: string
    },
    recipient: { header: { kid: string }; encrypted_key: string },
    epkJwk: EpkJwk,
    enc: DidCommV2ContentEncryptionAlgorithm,
    aad: Uint8Array,
    apv: Uint8Array
  ): Promise<{
    plaintext: DidCommV2PlaintextMessage
    senderKey: DidCommV2KeyAgreementJwk | null
  }> {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

    const { data } = await kms.decrypt({
      key: {
        keyAgreement: {
          algorithm: 'ECDH-ES+A256KW',
          keyId: keys.recipientKey.keyId,
          externalPublicJwk: epkJwk,
          encryptedKey: {
            encrypted: TypedArrayEncoder.fromBase64Url(recipient.encrypted_key),
          },
          apv,
        },
      },
      decryption: {
        algorithm: enc,
        iv: TypedArrayEncoder.fromBase64Url(encrypted.iv),
        tag: TypedArrayEncoder.fromBase64Url(encrypted.tag),
        aad,
      },
      encrypted: TypedArrayEncoder.fromBase64Url(encrypted.ciphertext),
    })

    const plaintext = JsonEncoder.fromUint8Array(data) as DidCommV2PlaintextMessage
    this.logger.debug('Unpacked DIDComm v2 anoncrypt message', { type: plaintext.type })

    return { plaintext, senderKey: null }
  }

  private parseAndValidateApu(protectedJson: Record<string, unknown>, skid: string): Uint8Array {
    const expected = computeApu(skid)
    const apuField = protectedJson.apu
    if (typeof apuField !== 'string') {
      throw new CredoError('Authcrypt requires apu in protected header')
    }
    const received = TypedArrayEncoder.fromBase64Url(apuField)
    if (!constantTimeEqual(received, expected)) {
      throw new CredoError('apu in protected header does not match skid')
    }
    return received
  }

  private parseAndValidateApv(
    protectedJson: Record<string, unknown>,
    recipients: DidCommV2EncryptedMessage['recipients']
  ): Uint8Array {
    const apvField = protectedJson.apv
    if (typeof apvField !== 'string') {
      throw new CredoError('Missing apv in protected header')
    }
    const received = TypedArrayEncoder.fromBase64Url(apvField)
    const expected = computeApv(recipients.map((r) => r.header.kid))
    if (!constantTimeEqual(received, expected)) {
      throw new CredoError('apv in protected header does not match recipient kids')
    }
    return received
  }
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

function getKeyAgreementCurve(jwk: DidCommV2KeyAgreementJwk): 'X25519' | 'P-256' {
  if (jwk.is(Kms.X25519PublicJwk)) return 'X25519'
  if (jwk.is(Kms.P256PublicJwk)) return 'P-256'
  throw new CredoError('Unsupported keyAgreement curve for DIDComm v2')
}

function toEpkJwk(publicJwk: unknown, expectedCurve: 'X25519' | 'P-256'): EpkJwk {
  if (typeof publicJwk !== 'object' || publicJwk === null) {
    throw new CredoError('Invalid ephemeral public key')
  }
  const jwk = publicJwk as { kty?: unknown; crv?: unknown; x?: unknown; y?: unknown }
  if (expectedCurve === 'X25519') {
    if (jwk.kty !== 'OKP' || jwk.crv !== 'X25519' || typeof jwk.x !== 'string') {
      throw new CredoError('Expected OKP/X25519 ephemeral key for DIDComm v2 envelope')
    }
    return { kty: 'OKP', crv: 'X25519', x: jwk.x }
  }
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
    throw new CredoError('Expected EC/P-256 ephemeral key for DIDComm v2 envelope')
  }
  return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y }
}
