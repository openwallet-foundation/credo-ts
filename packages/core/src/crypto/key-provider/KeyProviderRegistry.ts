import type { KeyProvider } from './KeyProvider'
import type { KeyType } from '..'

import { AriesFrameworkError } from '../../error'
import { injectable, injectAll } from '../../plugins'

export const KeyProviderToken = Symbol('KeyProviderToken')

@injectable()
export class KeyProviderRegistry {
  public keyProviders: KeyProvider[]

  public constructor(@injectAll(KeyProviderToken) keyProviders: KeyProvider[]) {
    this.keyProviders = keyProviders
  }

  public hasProviderForKeyType(keyType: KeyType): boolean {
    const keyProvider = this.keyProviders.find((x) => x.keyType === keyType)

    return keyProvider !== undefined
  }

  public getProviderForKeyType(keyType: KeyType): KeyProvider {
    const keyProvider = this.keyProviders.find((x) => x.keyType === keyType)

    if (!keyProvider) {
      throw new AriesFrameworkError(`No key provider for key type: ${keyType}`)
    }

    return keyProvider
  }
}
