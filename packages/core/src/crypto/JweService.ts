import type { AgentContext } from '../agent'
import { CredoError } from '../error'
import {
  KeyManagementApi,
  type KmsDecryptOptions,
  type KmsEncryptReturn,
  type KmsJwkPublicEcdh,
  PublicJwk,
} from '../modules/kms'
import { injectable } from '../plugins'
import { isJsonObject } from '../types'
import { JsonEncoder, TypedArrayEncoder } from '../utils'
import type {
  JweDecryptOptions,
  JweDecryptResult,
  JweEncryptOptions,
  JweGeneralJson,
  JweRecipientOptions,
} from './JweTypes'

const PROTECTED_ONLY_HEADER_PARAMETERS = ['alg', 'enc', 'epk', 'apu', 'apv'] as const

@injectable()
export class JweService {
  public async encryptJwe(agentContext: AgentContext, options: JweEncryptOptions): Promise<JweGeneralJson> {
    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    const { keyAgreement, enc, apu, apv } = options
    const recipients = this.recipients(options)

    let encodedProtectedHeader: string | undefined
    const result = await kms.encrypt({
      key: {
        keyAgreement:
          keyAgreement.algorithm === 'ECDH-ES'
            ? {
                algorithm: 'ECDH-ES',
                externalPublicJwk: this.ecdhPublicJwk(keyAgreement.recipient.publicJwk),
                apu,
                apv,
              }
            : keyAgreement.algorithm === 'ECDH-1PU+A256KW'
              ? {
                  algorithm: 'ECDH-1PU+A256KW',
                  keyId: keyAgreement.senderKeyId,
                  recipients: recipients.map((r) => ({ externalPublicJwk: this.ecdhPublicJwk(r.publicJwk) })),
                  apu,
                  apv,
                }
              : {
                  algorithm: keyAgreement.algorithm,
                  recipients: recipients.map((r) => ({ externalPublicJwk: this.ecdhPublicJwk(r.publicJwk) })),
                  apu,
                  apv,
                },
      },
      encryption: {
        algorithm: enc,
        aad: ({ ephemeralPublicJwk }) => {
          encodedProtectedHeader = JsonEncoder.toBase64Url({
            ...options.protectedHeaderOptions,
            alg: keyAgreement.algorithm,
            enc,
            apu: apu ? TypedArrayEncoder.toBase64Url(apu) : undefined,
            apv: apv ? TypedArrayEncoder.toBase64Url(apv) : undefined,
            epk: ephemeralPublicJwk,
          })
          return TypedArrayEncoder.fromUtf8String(encodedProtectedHeader)
        },
      },
      data: options.data,
    })

    return this.toGeneralJson(encodedProtectedHeader, recipients, keyAgreement.algorithm === 'ECDH-ES', result)
  }

  public async encryptJweCompact(agentContext: AgentContext, options: JweEncryptOptions): Promise<string> {
    const recipients = this.recipients(options)
    if (recipients.length !== 1) {
      throw new CredoError('A compact JWE has exactly one recipient')
    }

    const jwe = await this.encryptJwe(agentContext, {
      ...options,
      protectedHeaderOptions: { ...options.protectedHeaderOptions, ...recipients[0].header },
    })

    return [jwe.protected, jwe.recipients?.[0]?.encrypted_key ?? '', jwe.iv, jwe.ciphertext, jwe.tag].join('.')
  }

  public async decryptJwe(agentContext: AgentContext, options: JweDecryptOptions): Promise<JweDecryptResult> {
    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    const jwe = typeof options.jwe === 'string' ? this.parseCompact(options.jwe) : options.jwe

    const protectedHeader = JsonEncoder.fromBase64Url(jwe.protected)
    if (!isJsonObject(protectedHeader)) {
      throw new CredoError('JWE protected header is not a JSON object')
    }

    const unprotectedHeaders = [jwe.unprotected, ...(jwe.recipients ?? []).map((r) => r.header)]
    const misplaced = PROTECTED_ONLY_HEADER_PARAMETERS.filter((parameter) =>
      unprotectedHeaders.some((header) => header && parameter in header)
    )
    if (misplaced.length > 0) {
      throw new CredoError(
        `JWE header parameters ${misplaced.map((p) => `'${p}'`).join(', ')} must be in the protected header`
      )
    }

    const { alg, enc } = protectedHeader
    if (typeof alg !== 'string' || typeof enc !== 'string') {
      throw new CredoError("JWE protected header must contain 'alg' and 'enc'")
    }
    if (options.allowedKeyAgreementAlgorithms && !options.allowedKeyAgreementAlgorithms.includes(alg as never)) {
      throw new CredoError(`JWE 'alg' '${alg}' is not allowed`)
    }
    if (
      options.allowedContentEncryptionAlgorithms &&
      !options.allowedContentEncryptionAlgorithms.includes(enc as never)
    ) {
      throw new CredoError(`JWE 'enc' '${enc}' is not allowed`)
    }

    const recipient = this.selectRecipient(jwe, options.recipientKid)
    const ephemeralPublicJwk = this.ecdhPublicJwk(PublicJwk.fromUnknown(protectedHeader.epk))
    const apu =
      typeof protectedHeader.apu === 'string' ? TypedArrayEncoder.fromBase64Url(protectedHeader.apu) : undefined
    const apv =
      typeof protectedHeader.apv === 'string' ? TypedArrayEncoder.fromBase64Url(protectedHeader.apv) : undefined
    const encryptedKey = recipient?.encrypted_key
      ? { encrypted: TypedArrayEncoder.fromBase64Url(recipient.encrypted_key) }
      : undefined

    let keyAgreement: Extract<KmsDecryptOptions['key'], { keyAgreement: unknown }>['keyAgreement']
    if (alg === 'ECDH-ES') {
      if (encryptedKey) {
        throw new CredoError("A JWE with 'alg' 'ECDH-ES' must not contain an encrypted key")
      }
      keyAgreement = { algorithm: 'ECDH-ES', keyId: options.recipientKeyId, ephemeralPublicJwk, apu, apv }
    } else if (alg === 'ECDH-ES+A128KW' || alg === 'ECDH-ES+A192KW' || alg === 'ECDH-ES+A256KW') {
      if (!encryptedKey) {
        throw new CredoError(`A JWE with 'alg' '${alg}' must contain an encrypted key`)
      }
      keyAgreement = { algorithm: alg, keyId: options.recipientKeyId, ephemeralPublicJwk, encryptedKey, apu, apv }
    } else if (alg === 'ECDH-1PU+A256KW') {
      if (!encryptedKey) {
        throw new CredoError(`A JWE with 'alg' '${alg}' must contain an encrypted key`)
      }
      if (!options.senderPublicJwk) {
        throw new CredoError(`Decrypting a JWE with 'alg' '${alg}' requires the sender public key`)
      }
      keyAgreement = {
        algorithm: alg,
        keyId: options.recipientKeyId,
        ephemeralPublicJwk,
        senderPublicJwk: this.ecdhPublicJwk(options.senderPublicJwk),
        encryptedKey,
        apu,
        apv,
      }
    } else {
      throw new CredoError(`JWE 'alg' '${alg}' is not supported`)
    }

    const aad = TypedArrayEncoder.fromUtf8String(jwe.aad !== undefined ? `${jwe.protected}.${jwe.aad}` : jwe.protected)
    const { data } = await kms.decrypt({
      key: { keyAgreement },
      decryption: {
        algorithm: enc,
        aad,
        iv: TypedArrayEncoder.fromBase64Url(jwe.iv),
        tag: TypedArrayEncoder.fromBase64Url(jwe.tag),
      } as KmsDecryptOptions['decryption'],
      encrypted: TypedArrayEncoder.fromBase64Url(jwe.ciphertext),
    })

    return { data, protectedHeader, recipientHeader: recipient?.header }
  }

  private recipients(options: JweEncryptOptions): JweRecipientOptions[] {
    const { keyAgreement } = options
    const recipients = keyAgreement.algorithm === 'ECDH-ES' ? [keyAgreement.recipient] : keyAgreement.recipients
    if (recipients.length === 0) {
      throw new CredoError('A JWE needs at least one recipient')
    }
    return recipients
  }

  private ecdhPublicJwk(publicJwk: PublicJwk): KmsJwkPublicEcdh {
    const jwk = publicJwk.toJson({ includeKid: false })
    if (jwk.kty === 'OKP' ? jwk.crv !== 'X25519' : jwk.kty !== 'EC') {
      throw new CredoError(`Expected an EC or X25519 key for key agreement, found ${publicJwk.jwkTypeHumanDescription}`)
    }
    return jwk as KmsJwkPublicEcdh
  }

  private toGeneralJson(
    encodedProtectedHeader: string | undefined,
    recipients: JweRecipientOptions[],
    direct: boolean,
    { encrypted, iv, tag, encryptedKeys }: KmsEncryptReturn
  ): JweGeneralJson {
    if (!encodedProtectedHeader || !iv || !tag || (!direct && encryptedKeys?.length !== recipients.length)) {
      throw new CredoError('Expected the KMS to return the protected header, iv, tag and a key for every recipient')
    }

    return {
      protected: encodedProtectedHeader,
      recipients: recipients.map(({ header }, index) => ({
        header,
        encrypted_key: direct
          ? undefined
          : TypedArrayEncoder.toBase64Url(encryptedKeys?.[index].encrypted ?? new Uint8Array()),
      })),
      iv: TypedArrayEncoder.toBase64Url(iv),
      ciphertext: TypedArrayEncoder.toBase64Url(encrypted),
      tag: TypedArrayEncoder.toBase64Url(tag),
    }
  }

  private parseCompact(jwe: string): JweGeneralJson {
    const parts = jwe.split('.')
    if (parts.length !== 5) {
      throw new CredoError('A compact JWE must have five parts')
    }
    const [protectedHeader, encryptedKey, iv, ciphertext, tag] = parts
    return {
      protected: protectedHeader,
      recipients: [{ encrypted_key: encryptedKey || undefined }],
      iv,
      ciphertext,
      tag,
    }
  }

  private selectRecipient(jwe: JweGeneralJson, kid?: string) {
    const recipients = jwe.recipients ?? []
    if (kid) {
      const recipient = recipients.find((r) => r.header?.kid === kid)
      if (recipient) return recipient
      if (recipients.length > 1 || recipients[0]?.header?.kid !== undefined) {
        throw new CredoError(`No JWE recipient with kid '${kid}'`)
      }
    }
    if (recipients.length > 1) {
      throw new CredoError('The JWE has several recipients, a recipient kid is required')
    }
    return recipients[0]
  }
}
