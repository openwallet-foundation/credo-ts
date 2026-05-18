import type { DependencyManager, Module } from '../../plugins'
import { injectable } from '../../plugins'
import { Ed25519PublicJwk } from '../kms/jwk'
import { EddsaJcs2022Cryptosuite } from './cryptosuites/eddsa-jcs-2022/EddsaJcs2022Cryptosuite'
import { DataIntegrityCryptosuiteToken } from './cryptosuites/types'
import { DataIntegrityApi } from './DataIntegrityApi'
import { DataIntegrityCryptosuiteRegistry } from './DataIntegrityCryptosuiteRegistry'
import { DataIntegrityProofService } from './DataIntegrityProofService'

@injectable()
export class DataIntegrityModule implements Module {
  public readonly api = DataIntegrityApi

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(DataIntegrityCryptosuiteRegistry)
    dependencyManager.registerSingleton(DataIntegrityProofService)

    dependencyManager.registerInstance(DataIntegrityCryptosuiteToken, {
      cryptosuiteClass: EddsaJcs2022Cryptosuite,
      cryptosuite: 'eddsa-jcs-2022',
      supportedPublicJwkTypes: [Ed25519PublicJwk],
    })
  }
}
