import type { Wallet } from '../Wallet'

import { AriesFrameworkError } from '../../error'
import { IndyWallet } from '../IndyWallet'

export function assertIndyWallet(wallet: Wallet): asserts wallet is IndyWallet {
  if (!(wallet instanceof IndyWallet)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClassName = (wallet as any).constructor?.name ?? 'unknown'
    throw new AriesFrameworkError(`Expected wallet to be instance of IndyWallet, found ${walletClassName}`)
  }
}
