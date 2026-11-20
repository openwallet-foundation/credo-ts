import type { DependencyManager, Module } from '../../plugins'
import { injectable } from '../../plugins'
import { Ed25519PublicJwk, P256PublicJwk, P384PublicJwk } from '../kms/jwk'
import { EcdsaJcs2019Cryptosuite } from './cryptosuites/ecdsa-jcs-2019/EcdsaJcs2019Cryptosuite'
import { EddsaJcs2022Cryptosuite } from './cryptosuites/eddsa-jcs-2022/EddsaJcs2022Cryptosuite'
import { W3cDataIntegrityCryptosuiteToken } from './cryptosuites/types'
import { W3cDataIntegrityApi } from './W3cDataIntegrityApi'
import { W3cDataIntegrityCryptosuiteRegistry } from './W3cDataIntegrityCryptosuiteRegistry'
import { W3cDataIntegrityProofService } from './W3cDataIntegrityProofService'

@injectable()
export class W3cDataIntegrityModule implements Module {
  public readonly api = W3cDataIntegrityApi

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(W3cDataIntegrityCryptosuiteRegistry)
    dependencyManager.registerSingleton(W3cDataIntegrityProofService)

    dependencyManager.registerInstance(W3cDataIntegrityCryptosuiteToken, {
      cryptosuiteClass: EddsaJcs2022Cryptosuite,
      cryptosuite: 'eddsa-jcs-2022',
      supportedPublicJwkTypes: [Ed25519PublicJwk],
    })

    dependencyManager.registerInstance(W3cDataIntegrityCryptosuiteToken, {
      cryptosuiteClass: EcdsaJcs2019Cryptosuite,
      cryptosuite: 'ecdsa-jcs-2019',
      supportedPublicJwkTypes: [P256PublicJwk, P384PublicJwk],
    })
  }
}
