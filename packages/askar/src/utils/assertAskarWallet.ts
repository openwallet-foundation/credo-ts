import type { Wallet } from '@aries-framework/core'

import { AriesFrameworkError } from '@aries-framework/core'

import { AskarWallet, AskarProfileWallet } from '../wallet'

export function assertAskarWallet(wallet: Wallet): asserts wallet is AskarProfileWallet | AskarWallet {
  if (!(wallet instanceof AskarProfileWallet) && !(wallet instanceof AskarWallet)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClassName = (wallet as any).constructor?.name ?? 'unknown'
    throw new AriesFrameworkError(
      `Expected wallet to be instance of AskarProfileWallet or AskarWallet, found ${walletClassName}`
    )
  }
}
