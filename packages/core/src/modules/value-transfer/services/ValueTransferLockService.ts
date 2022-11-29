import AsyncLock from 'async-lock'

import { injectable } from '../../../plugins'

@injectable()
export class ValueTransferLockService {
  private waitPromise: Promise<void>
  private walletLock: AsyncLock
  private release: (value: void) => void

  public constructor() {
    this.waitPromise = Promise.resolve()
    this.walletLock = new AsyncLock()
    this.release = () => {
      return
    }
  }

  public async acquireWalletLock(until: () => Promise<void>) {
    await this.walletLock.acquire('wallet', async () => {
      await this.waitPromise
    })
    this.waitPromise = new Promise((resolve) => (this.release = resolve))

    until().finally(() => {
      this.release()
    })
  }
}
