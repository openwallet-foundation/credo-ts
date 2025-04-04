import type { AgentContext } from '../agent'
import type {
  Jws,
  JwsDetachedFormat,
  JwsFlattenedFormat,
  JwsGeneralFormat,
  JwsProtectedHeaderOptions,
} from './JwsTypes'
import type { Key } from './Key'
import type { JwkJson } from './jose/jwk/Jwk'

import { CredoError } from '../error'
import { EncodedX509Certificate, X509ModuleConfig } from '../modules/x509'
import { injectable } from '../plugins'
import { Buffer, JsonEncoder, TypedArrayEncoder, isJsonObject } from '../utils'
import { WalletError } from '../wallet/error'

import { X509Service } from './../modules/x509/X509Service'
import { JwsSigner, JwsSignerWithJwk } from './JwsSigner'
import { JWS_COMPACT_FORMAT_MATCHER } from './JwsTypes'
import { JwaSignatureAlgorithm } from './jose'
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
    {
      jws,
      resolveJwsSigner,
      trustedCertificates,
      jwsSigner: expectedJwsSigner,
      allowedJwsSignerMethods = ['did', 'jwk', 'x5c'],
    }: VerifyJwsOptions
  ): Promise<VerifyJwsResult> {
    let signatures: JwsDetachedFormat[] = []
    let payload: string

    if (expectedJwsSigner && !allowedJwsSignerMethods.includes(expectedJwsSigner.method)) {
      throw new CredoError(
        `jwsSigner provided with method '${expectedJwsSigner.method}', but allowed jws signer methods are ${allowedJwsSignerMethods.join(', ')}.`
      )
    }

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

    const jwsSigners: JwsSignerWithJwk[] = []
    for (const jws of signatures) {
      const protectedJson = JsonEncoder.fromBase64(jws.protected)

      if (!isJsonObject(protectedJson)) {
        throw new CredoError('Unable to verify JWS, protected header is not a valid JSON object.')
      }

      if (!protectedJson.alg || typeof protectedJson.alg !== 'string') {
        throw new CredoError('Unable to verify JWS, protected header alg is not provided or not a string.')
      }

      const jwsSigner =
        expectedJwsSigner ??
        (await this.jwsSignerFromJws(agentContext, {
          jws,
          payload,
          protectedHeader: {
            ...protectedJson,
            alg: protectedJson.alg,
          },
          allowedJwsSignerMethods,
          resolveJwsSigner,
        }))

      await this.verifyJwsSigner(agentContext, {
        jwsSigner,
        trustedCertificates,
      })

      if (!jwsSigner.jwk.supportsSignatureAlgorithm(protectedJson.alg)) {
        throw new CredoError(
          `alg '${protectedJson.alg}' is not a valid JWA signature algorithm for this jwk with keyType ${
            jwsSigner.jwk.keyType
          }. Supported algorithms are ${jwsSigner.jwk.supportedSignatureAlgorithms.join(', ')}`
        )
      }

      const data = TypedArrayEncoder.fromString(`${jws.protected}.${payload}`)
      const signature = TypedArrayEncoder.fromBase64(jws.signature)
      jwsSigners.push(jwsSigner)

      try {
        const isValid = await agentContext.wallet.verify({ key: jwsSigner.jwk.key, data, signature })

        if (!isValid) {
          return {
            isValid: false,
            jwsSigners: [],
            jws: jwsFlattened,
          }
        }
      } catch (error) {
        // WalletError probably means signature verification failed. Would be useful to add
        // more specific error type in wallet.verify method
        if (error instanceof WalletError) {
          return {
            isValid: false,
            jwsSigners: [],
            jws: jwsFlattened,
          }
        }

        throw error
      }
    }

    return { isValid: true, jwsSigners, jws: jwsFlattened }
  }

  private buildProtected(options: JwsProtectedHeaderOptions) {
    return {
      ...options,
      alg: options.alg,
      jwk: options.jwk?.toJson(),
      kid: options.kid,
    }
  }

  private async verifyJwsSigner(
    agentContext: AgentContext,
    options: {
      jwsSigner: JwsSignerWithJwk
      trustedCertificates?: EncodedX509Certificate[]
    }
  ) {
    const { jwsSigner } = options

    if (jwsSigner.method === 'x5c') {
      const trustedCertificatesFromConfig =
        agentContext.dependencyManager.resolve(X509ModuleConfig).trustedCertificates ?? []
      const trustedCertificates = options.trustedCertificates ?? trustedCertificatesFromConfig
      if (trustedCertificates.length === 0) {
        throw new CredoError(
          `trustedCertificates is required when the JWS protected header contains an 'x5c' property.`
        )
      }

      await X509Service.validateCertificateChain(agentContext, {
        certificateChain: jwsSigner.x5c,
        trustedCertificates,
      })
    }
  }

  private async jwsSignerFromJws(
    agentContext: AgentContext,
    options: {
      jws: JwsDetachedFormat
      allowedJwsSignerMethods: JwsSigner['method'][]
      protectedHeader: { alg: string; [key: string]: unknown }
      payload: string
      resolveJwsSigner?: JwsSignerResolver
    }
  ): Promise<JwsSignerWithJwk> {
    const { protectedHeader, resolveJwsSigner, jws, payload, allowedJwsSignerMethods } = options

    const alg = protectedHeader.alg as JwaSignatureAlgorithm
    if (!Object.values(JwaSignatureAlgorithm).includes(alg)) {
      throw new CredoError(`Unsupported JWA signature algorithm '${protectedHeader.alg}'`)
    }

    if (protectedHeader.x5c && allowedJwsSignerMethods.includes('x5c')) {
      if (
        !Array.isArray(protectedHeader.x5c) ||
        protectedHeader.x5c.some((certificate) => typeof certificate !== 'string')
      ) {
        throw new CredoError('x5c header is not a valid JSON array of strings.')
      }

      const certificate = X509Service.getLeafCertificate(agentContext, { certificateChain: protectedHeader.x5c })
      return {
        method: 'x5c',
        jwk: getJwkFromKey(certificate.publicKey),
        x5c: protectedHeader.x5c,
      }
    }

    // Jwk
    if (protectedHeader.jwk && allowedJwsSignerMethods.includes('jwk')) {
      if (!isJsonObject(protectedHeader.jwk)) throw new CredoError('JWK is not a valid JSON object.')

      const protectedJwk = getJwkFromJson(protectedHeader.jwk as JwkJson)

      return {
        method: 'jwk',
        jwk: protectedJwk,
      }
    }

    if (!resolveJwsSigner) {
      throw new CredoError(`resolveJwsSigner is required for resolving jws signers other than 'jwk' and 'x5c'.`)
    }

    try {
      const jwsSigner = await resolveJwsSigner({
        jws,
        protectedHeader: {
          ...protectedHeader,
          alg,
        },
        payload,
      })

      if (!allowedJwsSignerMethods.includes(jwsSigner.method)) {
        throw new CredoError(
          `resolveJwsSigner returned jws signer with method '${jwsSigner.method}', but allowed jws signer methods are ${allowedJwsSignerMethods.join(', ')}.`
        )
      }

      return jwsSigner
    } catch (error) {
      throw new CredoError(`Error when resolving jws signer for jws in resolveJwsSigner. ${error.message}`, {
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

  /**
   * The expected signer of the JWS. If provided the signer won't be dynamically
   * detected based on the values in the JWS.
   */
  jwsSigner?: JwsSignerWithJwk

  /**
   * Allowed jws signer methods when dynamically inferring the jws signer method.
   */
  allowedJwsSignerMethods?: JwsSigner['method'][]

  /*
   * Method that should return the JWS signer was used
   * to sign the JWS.
   *
   * This method is called by the JWS Service when it could not determine the public key.
   *
   * Currently the JWS Service can only determine the public key if the JWS protected header
   * contains a `jwk` or `x5c` property. In all other cases, it's up to the caller to resolve the public
   * key based on the JWS.
   *
   * A common use case is the `kid` property in the JWS protected header. Or determining the key
   * base on the `iss` property in the JWT payload.
   */
  resolveJwsSigner?: JwsSignerResolver

  trustedCertificates?: EncodedX509Certificate[]
}

export type JwsSignerResolver = (options: {
  jws: JwsDetachedFormat
  payload: string
  protectedHeader: { alg: JwaSignatureAlgorithm; jwk?: string; kid?: string; [key: string]: unknown }
}) => Promise<JwsSignerWithJwk> | JwsSignerWithJwk

export interface VerifyJwsResult {
  isValid: boolean
  jwsSigners: JwsSignerWithJwk[]

  jws: JwsFlattenedFormat
}
