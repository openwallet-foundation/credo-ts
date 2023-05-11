import type { Buffer } from '../../../utils'
import type { KeyType } from '../../KeyType'
import type { JwaKeyType, JwaEncryptionAlgorithm, JwaSignatureAlgorithm } from '../jwa'

import { Key } from '../../Key'

export interface JwkJson {
  kty: string
  use?: string
  [key: string]: unknown
}

export abstract class Jwk {
  public abstract publicKey: Buffer
  public abstract keyType: KeyType
  public abstract supportedSignatureAlgorithms: JwaSignatureAlgorithm[]
  public abstract supportedEncryptionAlgorithms: JwaEncryptionAlgorithm[]

  public abstract kty: JwaKeyType
  public use?: string

  public toJson(): JwkJson {
    return {
      kty: this.kty,
      use: this.use,
    }
  }

  public get key() {
    return new Key(this.publicKey, this.keyType)
  }

  public supportsSignatureAlgorithm(algorithm: JwaSignatureAlgorithm | string) {
    return this.supportedSignatureAlgorithms.includes(algorithm as JwaSignatureAlgorithm)
  }

  public supportsEncryptionAlgorithm(algorithm: JwaEncryptionAlgorithm | string) {
    return this.supportedEncryptionAlgorithms.includes(algorithm as JwaEncryptionAlgorithm)
  }
}
