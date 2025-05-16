import { PublicJwk } from '../../modules/kms'
import type { KeyGenAlgorithm, KeyType, KeyUsage } from './types'

import * as core from 'webcrypto-core'

export class CredoWebCryptoKey extends core.CryptoKey {
  public constructor(
    public publicJwk: PublicJwk,
    public override algorithm: KeyGenAlgorithm,
    public override extractable: boolean,
    public override type: KeyType,
    public override usages: Array<KeyUsage>
  ) {
    super()
  }
}
