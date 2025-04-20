import type { KeyType } from '../../KeyType'
import type { JwaEncryptionAlgorithm, JwaKeyType, JwaSignatureAlgorithm } from '../jwa'

import { KmsJwkPublicAsymmetric } from '../../../modules/kms'
import { Key } from '../../Key'

export interface JwkJson {
  kty: string
  use?: string
  kid?: string
  key_ops?: string[]
  [key: string]: unknown
}

export abstract class Jwk {
  public abstract jwkJson: KmsJwkPublicAsymmetric

  public abstract publicKey: Uint8Array
  public abstract supportedSignatureAlgorithms: JwaSignatureAlgorithm[]
  public abstract supportedEncryptionAlgorithms: JwaEncryptionAlgorithm[]

  /**
   * keyType as used by the rest of the framework, can be used in the
   * `Wallet`, `Key` and other classes.
   */
  public abstract keyType: KeyType

  /**
   * key type as defined in [JWA Specification](https://tools.ietf.org/html/rfc7518#section-6.1)
   */
  public abstract kty: JwaKeyType
  public use?: string

  public toJson(): KmsJwkPublicAsymmetric {
    return this.jwkJson
  }

  public get key() {
    return new Key(this.publicKey, this.keyType)
  }

  public supportsSignatureAlgorithm(
    algorithm: JwaSignatureAlgorithm | string
  ): algorithm is Exclude<JwaSignatureAlgorithm, 'none'> {
    return this.supportedSignatureAlgorithms.includes(algorithm as JwaSignatureAlgorithm)
  }

  public supportsEncryptionAlgorithm(algorithm: JwaEncryptionAlgorithm | string): algorithm is JwaEncryptionAlgorithm {
    return this.supportedEncryptionAlgorithms.includes(algorithm as JwaEncryptionAlgorithm)
  }
}
