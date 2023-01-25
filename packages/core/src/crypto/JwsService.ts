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
  private async createJwsBase(agentContext: AgentContext, options: CreateJwsOptions) {
    const base64Payload = TypedArrayEncoder.toBase64URL(options.payload)
    const base64Protected = JsonEncoder.toBase64URL(this.buildProtected(options.verkey, options.protectedHeaderOptions))
    const key = Key.fromPublicKeyBase58(options.verkey, KeyType.Ed25519)

    const signature = TypedArrayEncoder.toBase64URL(
      await agentContext.wallet.sign({ data: TypedArrayEncoder.fromString(`${base64Protected}.${base64Payload}`), key })
    )

    return {
      base64Payload,
      base64Protected,
      signature,
    }
  }

  public async createJws(
    agentContext: AgentContext,
    { payload, verkey, header, protectedHeaderOptions }: CreateJwsOptions
  ): Promise<JwsGeneralFormat> {
    const { base64Protected, signature } = await this.createJwsBase(agentContext, {
      payload,
      verkey,
      header,
      protectedHeaderOptions,
    })

    return {
      protected: base64Protected,
      signature,
      header,
    }
  }

  /**
   *  @see {@link https://www.rfc-editor.org/rfc/rfc7515#section-3.1}
   * */
  public async createJwsCompact(
    agentContext: AgentContext,
    { payload, verkey, header, protectedHeaderOptions }: CreateJwsOptions
  ): Promise<string> {
    const { base64Payload, base64Protected, signature } = await this.createJwsBase(agentContext, {
      payload,
      verkey,
      header,
      protectedHeaderOptions,
    })
    return `${base64Protected}.${base64Payload}.${signature}`
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

    const signerVerkeys = []
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

      const verkey = TypedArrayEncoder.toBase58(TypedArrayEncoder.fromBase64(protectedJson?.jwk?.x))
      const key = Key.fromPublicKeyBase58(verkey, KeyType.Ed25519)
      signerVerkeys.push(verkey)

      try {
        const isValid = await agentContext.wallet.verify({ key, data, signature })

        if (!isValid) {
          return {
            isValid: false,
            signerVerkeys: [],
          }
        }
      } catch (error) {
        // WalletError probably means signature verification failed. Would be useful to add
        // more specific error type in wallet.verify method
        if (error instanceof WalletError) {
          return {
            isValid: false,
            signerVerkeys: [],
          }
        }

        throw error
      }
    }

    return { isValid: true, signerVerkeys }
  }

  /**
   * @todo This currently only work with a single alg, key type and curve
   *    This needs to be extended with other formats in the future
   */
  private buildProtected(verkey: string, options: ProtectedHeaderOptions) {
    if (!options.jwk && !options.kid) {
      throw new AriesFrameworkError('Both JWK and kid are undefined. Please provide one or the other.')
    }
    if (options.jwk && options.kid) {
      throw new AriesFrameworkError('Both JWK and kid are provided. Please only provide one of the two.')
    }

    return {
      alg: options.alg,
      ...(options.jwk && { jwk: options.jwk }),
      ...(options.kid && { kid: options.kid }),
    }
  }
}

export interface CreateJwsOptions {
  verkey: string
  payload: Buffer
  header: Record<string, unknown>
  protectedHeaderOptions: ProtectedHeaderOptions
}

export interface VerifyJwsOptions {
  jws: Jws
  payload: Buffer
}

export interface VerifyJwsResult {
  isValid: boolean
  signerVerkeys: string[]
}

export interface Jwk {
  kty: string
  crv: string
  x: string
}

export type kid = string

export interface ProtectedHeaderOptions {
  alg: string
  jwk?: Jwk
  kid?: kid
}
