import * as core from 'webcrypto-core'
import type { CredoWalletWebCrypto } from './CredoWalletWebCrypto'

import {
  CredoEcdsaProvider,
  CredoEd25519Provider,
  CredoRsaPssProvider,
  CredoRsaSsaProvider,
  CredoSha1Provider,
  CredoSha256Provider,
} from './providers'

export class CredoSubtle extends core.SubtleCrypto {
  public constructor(walletWebCrypto: CredoWalletWebCrypto) {
    super()

    this.providers.set(new CredoEcdsaProvider(walletWebCrypto))
    this.providers.set(new CredoEd25519Provider(walletWebCrypto))
    this.providers.set(new CredoRsaPssProvider(walletWebCrypto))
    this.providers.set(new CredoRsaSsaProvider(walletWebCrypto))

    this.providers.set(new CredoSha1Provider())
    this.providers.set(new CredoSha256Provider())
  }
}
