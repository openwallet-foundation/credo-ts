import type { AgentContext } from '../../agent/context'
import { CredoError } from '../../error'
import { injectAll, injectable } from '../../plugins'
import { PublicJwk, type SupportedPublicJwkClass } from '../kms/jwk/PublicJwk'
import type { W3cDataIntegrityCryptosuiteInfo } from './cryptosuites/types'
import { W3cDataIntegrityCryptosuiteToken } from './cryptosuites/types'

@injectable()
export class W3cDataIntegrityCryptosuiteRegistry {
  private cryptosuiteMapping: W3cDataIntegrityCryptosuiteInfo[]

  public constructor(
    @injectAll(W3cDataIntegrityCryptosuiteToken) cryptosuites: Array<W3cDataIntegrityCryptosuiteInfo | 'default'>
  ) {
    this.cryptosuiteMapping = cryptosuites.filter(
      (cryptosuite): cryptosuite is W3cDataIntegrityCryptosuiteInfo => cryptosuite !== 'default'
    )
  }

  public get supportedCryptosuites(): string[] {
    return this.cryptosuiteMapping.map((x) => x.cryptosuite)
  }

  public getByCryptosuite(cryptosuite: string) {
    const cryptosuiteInfo = this.cryptosuiteMapping.find((x) => x.cryptosuite === cryptosuite)

    if (!cryptosuiteInfo) {
      throw new CredoError(`No Data Integrity cryptosuite registered for cryptosuite: ${cryptosuite}`)
    }

    return cryptosuiteInfo
  }

  public getAllByPublicJwkType(publicJwkType: SupportedPublicJwkClass | PublicJwk) {
    if (publicJwkType instanceof PublicJwk) {
      return this.cryptosuiteMapping.filter((cryptosuiteInfo) =>
        cryptosuiteInfo.supportedPublicJwkTypes.includes(publicJwkType.JwkClass)
      )
    }

    return this.cryptosuiteMapping.filter((cryptosuiteInfo) =>
      cryptosuiteInfo.supportedPublicJwkTypes.includes(publicJwkType)
    )
  }

  public createByCryptosuite(agentContext: AgentContext, cryptosuite: string) {
    const cryptosuiteInfo = this.getByCryptosuite(cryptosuite)
    return new cryptosuiteInfo.cryptosuiteClass(agentContext)
  }
}
