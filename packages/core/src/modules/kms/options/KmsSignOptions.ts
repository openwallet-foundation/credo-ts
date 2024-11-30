import type { KnownJwaSignatureAlgorithm } from '../jwk/jwa'

import * as v from 'valibot'

import { vKnownJwaSignatureAlgorithm } from '../jwk/jwa'

export const vKmsSignOptions = v.object({
  keyId: v.string(),
  algorithm: v.pipe(vKnownJwaSignatureAlgorithm, v.description('The JWA signature algorithm to use for signing')),

  data: v.pipe(v.instance(Uint8Array), v.description('The data to sign')),
})

export interface KmsSignOptions {
  /**
   * The key to use for signing
   */
  keyId: string

  /**
   * The JWA signature algorithm to use for signing
   */
  algorithm: KnownJwaSignatureAlgorithm

  /**
   * The data to sign
   */
  data: Uint8Array
}

export interface KmsSignReturn {
  signature: Uint8Array
}
