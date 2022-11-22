import { injectable } from '../../../plugins'

@injectable()
export class ValueTransferLockService {
  private walletLock: Promise<void>
  private release: (value: void) => void

  public constructor() {
    this.walletLock = Promise.resolve()
    this.release = () => {
      return
    }
  }

  public async acquireWalletLock(until: () => Promise<void>) {
    await this.walletLock
    this.walletLock = new Promise((resolve) => (this.release = resolve))
    until()
      .then(() => {
        this.release()
      })
      .catch(() => {
        this.release()
      })
  }
}
