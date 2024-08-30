import type { CredoWalletWebCrypto } from './CredoWalletWebCrypto'

import * as core from 'webcrypto-core'

import { CredoEcdsaProvider, CredoSha1Provider, CredoSha256Provider } from './providers'
import { CredoEd25519Provider } from './providers/CredoEd25519Provider'

export class CredoSubtle extends core.SubtleCrypto {
  public constructor(walletWebCrypto: CredoWalletWebCrypto) {
    super()

    this.providers.set(new CredoEcdsaProvider(walletWebCrypto))
    this.providers.set(new CredoEd25519Provider(walletWebCrypto))

    this.providers.set(new CredoSha1Provider())
    this.providers.set(new CredoSha256Provider())
  }
}
