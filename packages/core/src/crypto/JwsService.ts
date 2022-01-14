import type { Buffer } from '../utils'
import type { Jws, JwsGeneralFormat } from './JwsTypes'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { InjectionSymbols } from '../constants'
import { AriesFrameworkError } from '../error'
import { JsonEncoder, BufferEncoder } from '../utils'
import { Wallet } from '../wallet'
import { WalletError } from '../wallet/error'

// TODO: support more key types, more generic jws format
const JWS_KEY_TYPE = 'OKP'
const JWS_CURVE = 'Ed25519'
const JWS_ALG = 'EdDSA'

@scoped(Lifecycle.ContainerScoped)
export class JwsService {
  private wallet: Wallet

  public constructor(@inject(InjectionSymbols.Wallet) wallet: Wallet) {
    this.wallet = wallet
  }

  public async createJws({ payload, verkey, header }: CreateJwsOptions): Promise<JwsGeneralFormat> {
    const base64Payload = BufferEncoder.toBase64URL(payload)
    const base64Protected = JsonEncoder.toBase64URL(this.buildProtected(verkey))

    const signature = BufferEncoder.toBase64URL(
      await this.wallet.sign(BufferEncoder.fromString(`${base64Protected}.${base64Payload}`), verkey)
    )

    return {
      protected: base64Protected,
      signature,
      header,
    }
  }

  /**
   * Verify a a JWS
   */
  public async verifyJws({ jws, payload }: VerifyJwsOptions): Promise<VerifyJwsResult> {
    const base64Payload = BufferEncoder.toBase64URL(payload)
    const signatures = 'signatures' in jws ? jws.signatures : [jws]

    const signerVerkeys = []
    for (const jws of signatures) {
      const protectedJson: {
        alg?: string
        jwk?: {
          kty?: string
          crv?: string
          x?: string
        }
      } = JsonEncoder.fromBase64(jws.protected)

      const key = protectedJson?.jwk?.x

      const isValidKeyType = protectedJson?.jwk?.kty === JWS_KEY_TYPE
      const isValidCurve = protectedJson?.jwk?.crv === JWS_CURVE
      const isValidAlg = protectedJson?.alg === JWS_ALG

      if (!isValidKeyType || !isValidCurve || !isValidAlg || !key) {
        throw new AriesFrameworkError('Invalid protected header')
      }

      const data = BufferEncoder.fromString(`${jws.protected}.${base64Payload}`)
      const signature = BufferEncoder.fromBase64(jws.signature)

      const verkey = BufferEncoder.toBase58(BufferEncoder.fromBase64(key))
      signerVerkeys.push(verkey)

      try {
        const isValid = await this.wallet.verify(verkey, data, signature)

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
  private buildProtected(verkey: string) {
    return {
      alg: 'EdDSA',
      jwk: {
        kty: 'OKP',
        crv: 'Ed25519',
        x: BufferEncoder.toBase64URL(BufferEncoder.fromBase58(verkey)),
      },
    }
  }
}

export interface CreateJwsOptions {
  verkey: string
  payload: Buffer
  header: Record<string, unknown>
}

export interface VerifyJwsOptions {
  jws: Jws
  payload: Buffer
}

export interface VerifyJwsResult {
  isValid: boolean
  signerVerkeys: string[]
}
