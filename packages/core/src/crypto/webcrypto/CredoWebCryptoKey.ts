import * as core from 'webcrypto-core'
import { PublicJwk } from '../../modules/kms'
import type { KeyImportParams, KeyType, KeyUsage } from './types'

export class CredoWebCryptoKey extends core.CryptoKey {
  public constructor(
    public publicJwk: PublicJwk,
    public override algorithm: KeyImportParams,
    public override extractable: boolean,
    public override type: KeyType,
    public override usages: Array<KeyUsage>
  ) {
    super()
  }
}
