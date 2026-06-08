import {
  AgentContext,
  CredoError,
  InjectionSymbols,
  inject,
  injectable,
  JsonEncoder,
  JwsService,
  Kms,
  type Logger,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { computeApu, computeApv } from './apuApv'
import type {
  DidCommV2AnoncryptContentEncryptionAlgorithm,
  DidCommV2AuthcryptContentEncryptionAlgorithm,
  DidCommV2EncryptedMessage,
  DidCommV2KeyAgreementJwk,
  DidCommV2PlaintextMessage,
  DidCommV2SignedMessage,
  DidCommV2SigningAlgorithm,
} from './types'
import { DIDCOMM_V2_SIGNED_MIME_TYPE, DIDCOMM_V2_SIGNING_ALGORITHMS } from './types'

type EpkJwk = { kty: 'OKP'; crv: 'X25519'; x: string } | { kty: 'EC'; crv: 'P-256'; x: string; y: string }

export interface DidCommV2EnvelopeKeys {
  recipientKey: DidCommV2KeyAgreementJwk
  senderKey: DidCommV2KeyAgreementJwk
  /** DID URL of the sender key; used as skid in JWE so recipient can resolve it. Falls back to senderKey.keyId if absent. */
  senderKeySkid?: string
  /** Content encryption algorithm. Authcrypt is restricted to A256CBC-HS512 per DIDComm v2.1. */
  contentEncryptionAlgorithm?: DidCommV2AuthcryptContentEncryptionAlgorithm
}

/** Keys for anoncrypt: only recipient key; no sender (anonymous). */
export interface DidCommV2AnoncryptKeys {
  recipientKey: DidCommV2KeyAgreementJwk
  /** Content encryption algorithm. Defaults to A256CBC-HS512; A256GCM is also accepted. */
  contentEncryptionAlgorithm?: DidCommV2AnoncryptContentEncryptionAlgorithm
}

export interface DidCommV2Signer {
  keyId: string
  /** DID URL emitted in the JWS protected header; recipients dereference it against authentication. */
  kid: string
  alg: DidCommV2SigningAlgorithm
}

export interface DidCommV2VerifiedSigner {
  kid: string
  alg: DidCommV2SigningAlgorithm
  jwk: Kms.PublicJwk
}

@injectable()
export class DidCommV2EnvelopeService {
  private logger: Logger
  private jwsService: JwsService

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger, jwsService: JwsService) {
    this.logger = logger
    this.jwsService = jwsService
  }

  /**
   * Pack a DIDComm v2 plaintext message into an encrypted v2 envelope using ECDH-1PU (authcrypt).
   * Accepts pre-serialized bytes for the sign-then-encrypt flow where the JWS itself is the payload.
   */
  public async pack(
    agentContext: AgentContext,
    payload: DidCommV2PlaintextMessage | Uint8Array,
    keys: DidCommV2EnvelopeKeys
  ): Promise<DidCommV2EncryptedMessage> {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const plaintextBytes = payload instanceof Uint8Array ? payload : JsonEncoder.toUint8Array(payload)

    const recipientCurve = getKeyAgreementCurve(keys.recipientKey)
    const senderCurve = getKeyAgreementCurve(keys.senderKey)
    if (recipientCurve !== senderCurve) {
      throw new CredoError('DIDComm v2 authcrypt requires sender and recipient on the same curve')
    }

    const enc: DidCommV2AuthcryptContentEncryptionAlgorithm = keys.contentEncryptionAlgorithm ?? 'A256CBC-HS512'
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
   * Pack a DIDComm v2 plaintext message using ECDH-ES (anoncrypt). No sender identity;
   * used for forwarded messages to mediators. Accepts pre-serialized bytes for sign-then-anoncrypt.
   */
  public async packAnoncrypt(
    agentContext: AgentContext,
    payload: DidCommV2PlaintextMessage | Uint8Array,
    keys: DidCommV2AnoncryptKeys
  ): Promise<DidCommV2EncryptedMessage> {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const plaintextBytes = payload instanceof Uint8Array ? payload : JsonEncoder.toUint8Array(payload)

    const recipientCurve = getKeyAgreementCurve(keys.recipientKey)

    const enc: DidCommV2AnoncryptContentEncryptionAlgorithm = keys.contentEncryptionAlgorithm ?? 'A256CBC-HS512'
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

  /** Sign a v2 plaintext into a single-signer JWS (typ application/didcomm-signed+json). */
  public async signPlaintext(
    agentContext: AgentContext,
    plaintext: DidCommV2PlaintextMessage,
    signer: DidCommV2Signer
  ): Promise<DidCommV2SignedMessage> {
    if (!DIDCOMM_V2_SIGNING_ALGORITHMS.includes(signer.alg)) {
      throw new CredoError(
        `Unsupported DIDComm v2 signing algorithm '${signer.alg}'. Expected one of ${DIDCOMM_V2_SIGNING_ALGORITHMS.join(', ')}`
      )
    }

    if (plaintext.from && plaintext.from !== signer.kid.split('#')[0]) {
      throw new CredoError(
        `Plaintext 'from' (${plaintext.from}) does not match signer DID (${signer.kid.split('#')[0]})`
      )
    }

    // SICPA's validate_jws requires kid in the unprotected per-signature header. The DIDComm
    // v2.1 spec example shows kid in the protected header but doesn't normatively mandate it.
    // We emit unprotected for interop; verify accepts either location.
    const signed = await this.jwsService.createJws(agentContext, {
      payload: JsonEncoder.toUint8Array(plaintext),
      keyId: signer.keyId,
      header: { kid: signer.kid },
      protectedHeaderOptions: {
        typ: DIDCOMM_V2_SIGNED_MIME_TYPE,
        alg: signer.alg,
      },
    })

    return {
      payload: signed.payload,
      signatures: [{ protected: signed.protected, signature: signed.signature, header: { kid: signer.kid } }],
    }
  }

  /**
   * Sign then authcrypt: sign the plaintext, JWE-wrap the JWS using ECDH-1PU.
   * Spec mandates this order (sign before encrypt) for non-repudiation over DIDComm v2.
   */
  public async packSignedAndEncrypted(
    agentContext: AgentContext,
    plaintext: DidCommV2PlaintextMessage,
    signer: DidCommV2Signer,
    keys: DidCommV2EnvelopeKeys
  ): Promise<DidCommV2EncryptedMessage> {
    const signed = await this.signPlaintext(agentContext, plaintext, signer)
    return this.pack(agentContext, JsonEncoder.toUint8Array(signed), keys)
  }

  /** Sign then anoncrypt: hides sender identity on the wire while preserving the signature for the recipient. */
  public async packSignedAndAnoncrypted(
    agentContext: AgentContext,
    plaintext: DidCommV2PlaintextMessage,
    signer: DidCommV2Signer,
    keys: DidCommV2AnoncryptKeys
  ): Promise<DidCommV2EncryptedMessage> {
    const signed = await this.signPlaintext(agentContext, plaintext, signer)
    return this.packAnoncrypt(agentContext, JsonEncoder.toUint8Array(signed), keys)
  }

  /**
   * Unpack a DIDComm v2 encrypted message (authcrypt or anoncrypt).
   *
   * @param agentContext - The agent context (for KMS access)
   * @param encrypted - The v2 encrypted message
   * @param keys - Recipient key and sender key resolver; resolveSenderKey not used for anoncrypt
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
    if (enc !== 'A256GCM' && enc !== 'A256CBC-HS512' && enc !== 'XC20P') {
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
    if (enc === 'XC20P') {
      throw new CredoError('XC20P content encryption is only valid with anoncrypt (ECDH-ES+A256KW)')
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
    enc: DidCommV2AnoncryptContentEncryptionAlgorithm,
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

  /**
   * Verify a single-signer DIDComm v2 signed message and return its plaintext.
   * Enforces typ, alg allowlist, and that the plaintext `from` matches the signer DID.
   */
  public async verifySignedMessage(
    agentContext: AgentContext,
    signedMessage: DidCommV2SignedMessage,
    options: { resolveSignerJwk: (kid: string) => Promise<Kms.PublicJwk | null> }
  ): Promise<{ plaintext: DidCommV2PlaintextMessage; signers: DidCommV2VerifiedSigner[] }> {
    if (signedMessage.signatures.length !== 1) {
      throw new CredoError(
        `DIDComm v2 signed message must have exactly one signature, found ${signedMessage.signatures.length}`
      )
    }

    const [signature] = signedMessage.signatures
    const protectedJson = JsonEncoder.fromBase64Url(signature.protected) as {
      typ?: string
      alg?: string
      kid?: string
    }
    if (protectedJson.typ !== DIDCOMM_V2_SIGNED_MIME_TYPE) {
      throw new CredoError(`Invalid DIDComm v2 signed message typ: ${protectedJson.typ}`)
    }
    if (!protectedJson.alg || !DIDCOMM_V2_SIGNING_ALGORITHMS.includes(protectedJson.alg as DidCommV2SigningAlgorithm)) {
      throw new CredoError(
        `Unsupported DIDComm v2 signing algorithm '${protectedJson.alg}'. Expected one of ${DIDCOMM_V2_SIGNING_ALGORITHMS.join(', ')}`
      )
    }
    const alg = protectedJson.alg as DidCommV2SigningAlgorithm

    // Spec puts kid in protected; SICPA fixtures put it in unprotected.
    const kid = protectedJson.kid ?? signature.header?.kid
    if (!kid || typeof kid !== 'string') {
      throw new CredoError('DIDComm v2 signed message signature missing kid in protected or unprotected header')
    }

    const signerJwk = await options.resolveSignerJwk(kid)
    if (!signerJwk) {
      throw new CredoError(`Could not resolve DIDComm v2 signer JWK for kid '${kid}'`)
    }

    // JwsService.verifyJws requires `header` on each signature entry; v2 wire format may omit it.
    const normalizedJws = {
      payload: signedMessage.payload,
      signatures: signedMessage.signatures.map((s) => ({
        protected: s.protected,
        signature: s.signature,
        header: s.header ?? {},
      })),
    }
    const result = await this.jwsService.verifyJws(agentContext, {
      jws: normalizedJws,
      jwsSigner: { method: 'jwk', jwk: signerJwk },
      allowedJwsSignerMethods: ['jwk'],
    })

    if (!result.isValid) {
      throw new CredoError(`DIDComm v2 signed message signature verification failed for kid '${kid}'`)
    }

    const plaintext = JsonEncoder.fromBase64Url(signedMessage.payload) as DidCommV2PlaintextMessage
    const signerDid = kid.split('#')[0]
    if (plaintext.from && plaintext.from !== signerDid) {
      throw new CredoError(`Plaintext 'from' (${plaintext.from}) does not match signer DID (${signerDid})`)
    }

    this.logger.debug('Verified DIDComm v2 signed message', { type: plaintext.type, kid, alg })

    return { plaintext, signers: [{ kid, alg, jwk: signerJwk }] }
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
