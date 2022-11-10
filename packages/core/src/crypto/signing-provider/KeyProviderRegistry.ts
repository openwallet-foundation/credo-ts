import type { KeyType } from '..'
import type { KeyProvider } from './KeyProvider'

import { AriesFrameworkError } from '../../error'
import { injectable, injectAll } from '../../plugins'

export const KeyProviderToken = Symbol('KeyProviderToken')

@injectable()
export class KeyProviderRegistry {
  public keyProviders: KeyProvider[]

  public constructor(@injectAll(KeyProviderToken) keyProviders: Array<'default' | KeyProvider>) {
    // This is a really ugly hack to make tsyringe work without any SigningProviders registered
    // It is currently impossible to use @injectAll if there are no instances registered for the
    // token. We register a value of `default` by default and will filter that out in the registry.
    // Once we have a signing provider that should always be registered we can remove this. We can make an ed25519
    // signer using the @stablelib/ed25519 library.
    this.keyProviders = keyProviders.filter((provider) => provider !== 'default') as KeyProvider[]
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
