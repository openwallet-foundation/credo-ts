import type { Wallet } from '../Wallet'

import { AriesFrameworkError } from '../../error'
import { IndyWallet } from '../IndyWallet'

export function assertIndyWallet(wallet: Wallet): asserts wallet is IndyWallet {
  if (!(wallet instanceof IndyWallet)) {
    throw new AriesFrameworkError(`Expected wallet to be instance of IndyWallet, found ${wallet}`)
  }
}
