import { z } from 'zod'
import { type KmsJwkPrivate, type KmsJwkPublicFromKmsJwkPrivate, zKmsJwkPrivate } from '../jwk/knownJwk'

export const zKmsImportKeyOptions = z.object({
  /**
   * The private jwk to import. If the key needs to use a specific keyId, make sure to set
   * the `kid` property on the JWK. If no kid is provided a key id will be generated.
   */
  privateJwk: zKmsJwkPrivate,
})

export interface KmsImportKeyOptions<Jwk extends KmsJwkPrivate> {
  /**
   * The private jwk to import. If the key needs to use a specific keyId, make sure to set
   * the `kid` property on the JWK. If no kid is provided a key id will be generated.
   */
  privateJwk: Jwk
}

export interface KmsImportKeyReturn<Jwk extends KmsJwkPrivate> {
  keyId: string

  /**
   * The public JWK representation of the imported key. `kid` will always
   * be defined.
   *
   * In case of a symmetric (oct) key this won't include any key material, but
   * will include additional JWK claims such as `use`, `kty`, and `kid`
   */
  publicJwk: KmsJwkPublicFromKmsJwkPrivate<Jwk> & { kid: string }
}
