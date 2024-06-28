import type { AgentContext } from '../../agent'

import * as core from 'webcrypto-core'

import { CredoSubtle } from './CredoSubtle'
import { CredoWalletWebCrypto } from './CredoWalletWebCrypto'

export class CredoWebCrypto extends core.Crypto {
  private walletWebCrypto: CredoWalletWebCrypto
  public subtle: CredoSubtle

  public constructor(agentContext: AgentContext) {
    super()
    this.walletWebCrypto = new CredoWalletWebCrypto(agentContext)
    this.subtle = new CredoSubtle(this.walletWebCrypto)
  }

  public getRandomValues<T extends ArrayBufferView | null>(array: T): T {
    return this.walletWebCrypto.generateRandomValues(array)
  }
}
