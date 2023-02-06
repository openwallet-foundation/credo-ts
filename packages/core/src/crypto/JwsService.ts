import type { Jwk } from './JwkTypes'
import type { Jws, JwsGeneralFormat } from './JwsTypes'
import type { AgentContext } from '../agent'
import type { Buffer } from '../utils'

import { AriesFrameworkError } from '../error'
import { injectable } from '../plugins'
import { JsonEncoder, TypedArrayEncoder } from '../utils'
import { WalletError } from '../wallet/error'

import { Key } from './Key'
import { KeyType } from './KeyType'

// TODO: support more key types, more generic jws format
const JWS_KEY_TYPE = 'OKP'
const JWS_CURVE = 'Ed25519'
const JWS_ALG = 'EdDSA'

@injectable()
export class JwsService {
  public static supportedKeyTypes = [KeyType.Ed25519]

  private async createJwsBase(agentContext: AgentContext, options: CreateJwsBaseOptions) {
    if (!JwsService.supportedKeyTypes.includes(options.key.keyType)) {
      throw new AriesFrameworkError(
        `Only ${JwsService.supportedKeyTypes.join(',')} key type(s) supported for creating JWS`
      )
    }
    const base64Payload = TypedArrayEncoder.toBase64URL(options.payload)
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
    const { base64UrlProtectedHeader, signature } = await this.createJwsBase(agentContext, {
      payload,
      key,
      protectedHeaderOptions,
    })

    return {
      protected: base64UrlProtectedHeader,
      signature,
      header,
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
  public async verifyJws(agentContext: AgentContext, { jws, payload }: VerifyJwsOptions): Promise<VerifyJwsResult> {
    const base64Payload = TypedArrayEncoder.toBase64URL(payload)
    const signatures = 'signatures' in jws ? jws.signatures : [jws]

    if (signatures.length === 0) {
      throw new AriesFrameworkError('Unable to verify JWS: No entries in JWS signatures array.')
    }

    const signerKeys: Key[] = []
    for (const jws of signatures) {
      const protectedJson = JsonEncoder.fromBase64(jws.protected)

      const isValidKeyType = protectedJson?.jwk?.kty === JWS_KEY_TYPE
      const isValidCurve = protectedJson?.jwk?.crv === JWS_CURVE
      const isValidAlg = protectedJson?.alg === JWS_ALG

      if (!isValidKeyType || !isValidCurve || !isValidAlg) {
        throw new AriesFrameworkError('Invalid protected header')
      }

      const data = TypedArrayEncoder.fromString(`${jws.protected}.${base64Payload}`)
      const signature = TypedArrayEncoder.fromBase64(jws.signature)

      const publicKey = TypedArrayEncoder.fromBase64(protectedJson?.jwk?.x)
      const key = Key.fromPublicKey(publicKey, KeyType.Ed25519)
      signerKeys.push(key)

      try {
        const isValid = await agentContext.wallet.verify({ key, data, signature })

        if (!isValid) {
          return {
            isValid: false,
            signerKeys: [],
          }
        }
      } catch (error) {
        // WalletError probably means signature verification failed. Would be useful to add
        // more specific error type in wallet.verify method
        if (error instanceof WalletError) {
          return {
            isValid: false,
            signerKeys: [],
          }
        }

        throw error
      }
    }

    return { isValid: true, signerKeys: signerKeys }
  }

  private buildProtected(options: ProtectedHeaderOptions) {
    if (!options.jwk && !options.kid) {
      throw new AriesFrameworkError('Both JWK and kid are undefined. Please provide one or the other.')
    }
    if (options.jwk && options.kid) {
      throw new AriesFrameworkError('Both JWK and kid are provided. Please only provide one of the two.')
    }

    return {
      alg: options.alg,
      jwk: options.jwk,
      kid: options.kid,
    }
  }
}

export interface CreateJwsOptions {
  key: Key
  payload: Buffer
  header: Record<string, unknown>
  protectedHeaderOptions: ProtectedHeaderOptions
}

type CreateJwsBaseOptions = Omit<CreateJwsOptions, 'header'>

type CreateCompactJwsOptions = Omit<CreateJwsOptions, 'header'>

export interface VerifyJwsOptions {
  jws: Jws
  payload: Buffer
}

export interface VerifyJwsResult {
  isValid: boolean
  signerKeys: Key[]
}

export type kid = string

export interface ProtectedHeaderOptions {
  alg: string
  jwk?: Jwk
  kid?: kid
  [key: string]: any
}
