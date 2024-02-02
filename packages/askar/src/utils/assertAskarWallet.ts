import type { Wallet } from '@credo-ts/core'

import { CredoError } from '@credo-ts/core'

import { AskarWallet, AskarProfileWallet } from '../wallet'

export function assertAskarWallet(wallet: Wallet): asserts wallet is AskarProfileWallet | AskarWallet {
  if (!(wallet instanceof AskarProfileWallet) && !(wallet instanceof AskarWallet)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClassName = (wallet as any).constructor?.name ?? 'unknown'
    throw new CredoError(
      `Expected wallet to be instance of AskarProfileWallet or AskarWallet, found ${walletClassName}`
    )
  }
}
