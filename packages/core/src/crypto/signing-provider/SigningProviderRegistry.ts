import type { KeyType } from '..'
import type { SigningProvider } from './SigningProvider'

import { AriesFrameworkError } from '../../error'
import { injectable, injectAll } from '../../plugins'

export const SigningProviderToken = Symbol('SigningProviderToken')

@injectable()
export class SigningProviderRegistry {
  private signingKeyProviders: SigningProvider[]

  public constructor(@injectAll(SigningProviderToken) signingKeyProviders: SigningProvider[]) {
    this.signingKeyProviders = signingKeyProviders
  }

  public hasProviderForKeyType(keyType: KeyType): boolean {
    const signingKeyProvider = this.signingKeyProviders.find((x) => x.keyType === keyType)

    return signingKeyProvider !== undefined
  }

  public getProviderForKeyType(keyType: KeyType): SigningProvider {
    const signingKeyProvider = this.signingKeyProviders.find((x) => x.keyType === keyType)

    if (!signingKeyProvider) {
      throw new AriesFrameworkError(`No signing key provider for key type: ${keyType}`)
    }

    return signingKeyProvider
  }
}
