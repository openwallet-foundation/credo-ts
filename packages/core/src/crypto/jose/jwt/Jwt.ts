import type { Buffer } from '../../../utils'

import { CredoError } from '../../../error'
import { JsonEncoder, TypedArrayEncoder } from '../../../utils'

import { Jwk } from '../../../modules/kms'
import { JwtPayload } from './JwtPayload'

// TODO: JWT Header typing
interface JwtHeader {
  alg: string
  kid?: string
  jwk?: Jwk
  x5c?: string[]
  [key: string]: unknown
}

interface JwtOptions {
  payload: JwtPayload
  header: JwtHeader
  signature: Buffer

  serializedJwt: string
}

export class Jwt {
  public static format = /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/

  public readonly payload: JwtPayload
  public readonly header: JwtHeader
  public readonly signature: Buffer

  /**
   * Compact serialization of the JWT. Contains the payload, header, and signature.
   */
  public readonly serializedJwt: string

  private constructor(options: JwtOptions) {
    this.serializedJwt = options.serializedJwt

    this.payload = options.payload
    this.header = options.header
    this.signature = options.signature
  }

  public static fromSerializedJwt(serializedJwt: string) {
    if (typeof serializedJwt !== 'string' || !Jwt.format.test(serializedJwt)) {
      throw new CredoError(`Invalid JWT. '${serializedJwt}' does not match JWT regex`)
    }

    const [header, payload, signature] = serializedJwt.split('.')

    try {
      return new Jwt({
        header: JsonEncoder.fromBase64(header),
        payload: JwtPayload.fromJson(JsonEncoder.fromBase64(payload)),
        signature: TypedArrayEncoder.fromBase64(signature),
        serializedJwt,
      })
    } catch (error) {
      throw new CredoError(`Invalid JWT. ${error instanceof Error ? error.message : JSON.stringify(error)}`)
    }
  }
}
