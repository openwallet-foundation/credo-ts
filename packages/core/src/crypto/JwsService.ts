import type { AgentContext } from '../agent'
import type {
  Jws,
  JwsDetachedFormat,
  JwsFlattenedFormat,
  JwsGeneralFormat,
  JwsProtectedHeaderOptions,
} from './JwsTypes'
import type { Key } from './Key'
import type { Jwk } from './jose/jwk'
import type { JwkJson } from './jose/jwk/Jwk'

import { CredoError } from '../error'
import { EncodedX509Certificate, X509ModuleConfig } from '../modules/x509'
import { injectable } from '../plugins'
import { Buffer, JsonEncoder, TypedArrayEncoder, isJsonObject } from '../utils'
import { WalletError } from '../wallet/error'

import { X509Service } from './../modules/x509/X509Service'
import { JWS_COMPACT_FORMAT_MATCHER } from './JwsTypes'
import { getJwkFromJson, getJwkFromKey } from './jose/jwk'
import { JwtPayload } from './jose/jwt'

@injectable()
export class JwsService {
  private async createJwsBase(agentContext: AgentContext, options: CreateJwsBaseOptions) {
    const { jwk, alg, x5c } = options.protectedHeaderOptions
    const keyJwk = getJwkFromKey(options.key)

    // Make sure the options.x5c and x5c from protectedHeader are the same.
    if (x5c) {
      const certificate = X509Service.getLeafCertificate(agentContext, { certificateChain: x5c })
      if (
        certificate.publicKey.keyType !== options.key.keyType ||
        !Buffer.from(certificate.publicKey.publicKey).equals(Buffer.from(options.key.publicKey))
      ) {
        throw new CredoError('Protected header x5c does not match key for signing.')
      }
    }

    // Make sure the options.key and jwk from protectedHeader are the same.
    if (
      jwk &&
      (jwk.key.keyType !== options.key.keyType ||
        !Buffer.from(jwk.key.publicKey).equals(Buffer.from(options.key.publicKey)))
    ) {
      throw new CredoError('Protected header JWK does not match key for signing.')
    }

    // Validate the options.key used for signing against the jws options
    // We use keyJwk instead of jwk, as the user could also use kid instead of jwk
    if (keyJwk && !keyJwk.supportsSignatureAlgorithm(alg)) {
      throw new CredoError(
        `alg '${alg}' is not a valid JWA signature algorithm for this jwk with keyType ${
          keyJwk.keyType
        }. Supported algorithms are ${keyJwk.supportedSignatureAlgorithms.join(', ')}`
      )
    }

    const payload =
      options.payload instanceof JwtPayload ? JsonEncoder.toBuffer(options.payload.toJson()) : options.payload

    const base64Payload = TypedArrayEncoder.toBase64URL(payload)
    const base64UrlProtectedHeader = JsonEncoder.toBase64URL(this.buildProtected(options.protectedHeaderOptions))

    const signature = TypedArrayEncoder.toBase64URL(
      await agentContext.wallet.sign({
        data: TypedArrayEncoder.fromString(`${base64UrlProtectedHeader}.${base64Payload}`),
        key: options.key,
      })
    )

    return {
      base64Payload,
      base64UrlProtectedHeader,
      signature,
    }
  }

  public async createJws(
    agentContext: AgentContext,
    { payload, key, header, protectedHeaderOptions }: CreateJwsOptions
  ): Promise<JwsGeneralFormat> {
    const { base64UrlProtectedHeader, signature, base64Payload } = await this.createJwsBase(agentContext, {
      payload,
      key,
      protectedHeaderOptions,
    })

    return {
      protected: base64UrlProtectedHeader,
      signature,
      header,
      payload: base64Payload,
    }
  }

  /**
   *  @see {@link https://www.rfc-editor.org/rfc/rfc7515#section-3.1}
   * */
  public async createJwsCompact(
    agentContext: AgentContext,
    { payload, key, protectedHeaderOptions }: CreateCompactJwsOptions
  ): Promise<string> {
    const { base64Payload, base64UrlProtectedHeader, signature } = await this.createJwsBase(agentContext, {
      payload,
      key,
      protectedHeaderOptions,
    })
    return `${base64UrlProtectedHeader}.${base64Payload}.${signature}`
  }

  /**
   * Verify a JWS
   */
  public async verifyJws(
    agentContext: AgentContext,
    { jws, jwkResolver, trustedCertificates }: VerifyJwsOptions
  ): Promise<VerifyJwsResult> {
    let signatures: JwsDetachedFormat[] = []
    let payload: string

    if (typeof jws === 'string') {
      if (!JWS_COMPACT_FORMAT_MATCHER.test(jws)) throw new CredoError(`Invalid JWS compact format for value '${jws}'.`)

      const [protectedHeader, _payload, signature] = jws.split('.')

      payload = _payload
      signatures.push({
        header: {},
        protected: protectedHeader,
        signature,
      })
    } else if ('signatures' in jws) {
      signatures = jws.signatures
      payload = jws.payload
    } else {
      signatures.push(jws)
      payload = jws.payload
    }

    if (signatures.length === 0) {
      throw new CredoError('Unable to verify JWS, no signatures present in JWS.')
    }

    const jwsFlattened = {
      signatures,
      payload,
    } satisfies JwsFlattenedFormat

    const signerKeys: Key[] = []
    for (const jws of signatures) {
      const protectedJson = JsonEncoder.fromBase64(jws.protected)

      if (!isJsonObject(protectedJson)) {
        throw new CredoError('Unable to verify JWS, protected header is not a valid JSON object.')
      }

      if (!protectedJson.alg || typeof protectedJson.alg !== 'string') {
        throw new CredoError('Unable to verify JWS, protected header alg is not provided or not a string.')
      }

      const jwk = await this.jwkFromJws(agentContext, {
        jws,
        payload,
        protectedHeader: {
          ...protectedJson,
          alg: protectedJson.alg,
        },
        jwkResolver,
        trustedCertificates,
      })
      if (!jwk.supportsSignatureAlgorithm(protectedJson.alg)) {
        throw new CredoError(
          `alg '${protectedJson.alg}' is not a valid JWA signature algorithm for this jwk with keyType ${
            jwk.keyType
          }. Supported algorithms are ${jwk.supportedSignatureAlgorithms.join(', ')}`
        )
      }

      const data = TypedArrayEncoder.fromString(`${jws.protected}.${payload}`)
      const signature = TypedArrayEncoder.fromBase64(jws.signature)
      signerKeys.push(jwk.key)

      try {
        const isValid = await agentContext.wallet.verify({ key: jwk.key, data, signature })

        if (!isValid) {
          return {
            isValid: false,
            signerKeys: [],
            jws: jwsFlattened,
          }
        }
      } catch (error) {
        // WalletError probably means signature verification failed. Would be useful to add
        // more specific error type in wallet.verify method
        if (error instanceof WalletError) {
          return {
            isValid: false,
            signerKeys: [],
            jws: jwsFlattened,
          }
        }

        throw error
      }
    }

    return { isValid: true, signerKeys, jws: jwsFlattened }
  }

  private buildProtected(options: JwsProtectedHeaderOptions) {
    // FIXME: checking for kid starting with '#' is not good.
    // but now we don't really limit that kid (did key reference)
    // cannot be combined with x5c/jwk
    if (options.kid?.startsWith('did:')) {
      if (options.jwk || options.x5c) {
        throw new CredoError("When 'kid' is a did, 'jwk' and 'x5c' cannot be provided.")
      }
    } else if ((options.jwk && options.x5c) || (!options.jwk && !options.x5c && !options.kid)) {
      throw new CredoError("Header must contain one of 'x5c', 'jwk' or 'kid' with a did value.")
    }

    return {
      ...options,
      alg: options.alg,
      jwk: options.jwk?.toJson(),
      kid: options.kid,
    }
  }

  private async jwkFromJws(
    agentContext: AgentContext,
    options: {
      jws: JwsDetachedFormat
      protectedHeader: { alg: string; [key: string]: unknown }
      payload: string
      jwkResolver?: JwsJwkResolver
      trustedCertificates?: EncodedX509Certificate[]
    }
  ): Promise<Jwk> {
    const {
      protectedHeader,
      jwkResolver,
      jws,
      payload,
      trustedCertificates: trustedCertificatesFromOptions = [],
    } = options

    // FIXME: checking for kid starting with '#' is not good.
    // but now we don't really limit that kid (did key reference)
    // cannot be combined with x5c/jwk
    if (typeof protectedHeader.kid === 'string' && protectedHeader.kid?.startsWith('did:')) {
      if (protectedHeader.jwk || protectedHeader.x5c) {
        throw new CredoError("When 'kid' is a did, 'jwk' and 'x5c' cannot be provided.")
      }
    } else if (protectedHeader.jwk && protectedHeader.x5c) {
      throw new CredoError("Header must contain one of 'x5c', 'jwk' or 'kid' with a did value.")
    }

    if (protectedHeader.x5c) {
      if (
        !Array.isArray(protectedHeader.x5c) ||
        protectedHeader.x5c.some((certificate) => typeof certificate !== 'string')
      ) {
        throw new CredoError('x5c header is not a valid JSON array of strings.')
      }

      const trustedCertificatesFromConfig =
        agentContext.dependencyManager.resolve(X509ModuleConfig).trustedCertificates ?? []
      const trustedCertificates = trustedCertificatesFromOptions ?? trustedCertificatesFromConfig
      if (trustedCertificates.length === 0) {
        throw new CredoError(
          `trustedCertificates is required when the JWS protected header contains an 'x5c' property.`
        )
      }

      await X509Service.validateCertificateChain(agentContext, {
        certificateChain: protectedHeader.x5c,
        trustedCertificates,
      })

      const certificate = X509Service.getLeafCertificate(agentContext, { certificateChain: protectedHeader.x5c })
      return getJwkFromKey(certificate.publicKey)
    }

    // Jwk
    if (protectedHeader.jwk) {
      if (!isJsonObject(protectedHeader.jwk)) throw new CredoError('JWK is not a valid JSON object.')
      return getJwkFromJson(protectedHeader.jwk as JwkJson)
    }

    if (!jwkResolver) {
      throw new CredoError(
        `jwkResolver is required when the JWS protected header does not contain a 'jwk' or 'x5c' property.`
      )
    }

    try {
      const jwk = await jwkResolver({
        jws,
        protectedHeader,
        payload,
      })

      return jwk
    } catch (error) {
      throw new CredoError(`Error when resolving JWK for JWS in jwkResolver. ${error.message}`, {
        cause: error,
      })
    }
  }
}

export interface CreateJwsOptions {
  key: Key
  payload: Buffer | JwtPayload
  header: Record<string, unknown>
  protectedHeaderOptions: JwsProtectedHeaderOptions
}

type CreateJwsBaseOptions = Omit<CreateJwsOptions, 'header'>
type CreateCompactJwsOptions = Omit<CreateJwsOptions, 'header'>

export interface VerifyJwsOptions {
  jws: Jws

  /*
   * Method that should return the JWK public key that was used
   * to sign the JWS.
   *
   * This method is called by the JWS Service when it could not determine the public key.
   *
   * Currently the JWS Service can only determine the public key if the JWS protected header
   * contains a `jwk` property. In all other cases, it's up to the caller to resolve the public
   * key based on the JWS.
   *
   * A common use case is the `kid` property in the JWS protected header. Or determining the key
   * base on the `iss` property in the JWT payload.
   */
  jwkResolver?: JwsJwkResolver

  trustedCertificates?: EncodedX509Certificate[]
}

export type JwsJwkResolver = (options: {
  jws: JwsDetachedFormat
  payload: string
  protectedHeader: { alg: string; jwk?: string; kid?: string; [key: string]: unknown }
}) => Promise<Jwk> | Jwk

export interface VerifyJwsResult {
  isValid: boolean
  signerKeys: Key[]

  jws: JwsFlattenedFormat
}
