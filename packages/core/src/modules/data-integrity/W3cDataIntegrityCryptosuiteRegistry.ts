import type { AgentContext } from '../../agent/context'
import { CredoError } from '../../error'
import { injectAll, injectable } from '../../plugins'
import { PublicJwk, type SupportedPublicJwkClass } from '../kms/jwk/PublicJwk'
import type { DataIntegrityCryptosuiteInfo } from './cryptosuites/types'
import { DataIntegrityCryptosuiteToken } from './cryptosuites/types'

@injectable()
export class W3cDataIntegrityCryptosuiteRegistry {
  private cryptosuiteMapping: DataIntegrityCryptosuiteInfo[]

  public constructor(
    @injectAll(DataIntegrityCryptosuiteToken) cryptosuites: Array<DataIntegrityCryptosuiteInfo | 'default'>
  ) {
    this.cryptosuiteMapping = cryptosuites.filter(
      (cryptosuite): cryptosuite is DataIntegrityCryptosuiteInfo => cryptosuite !== 'default'
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
    const publicJwkClass = publicJwkType instanceof PublicJwk ? publicJwkType.JwkClass : publicJwkType
    return this.cryptosuiteMapping.filter((x) => x.supportedPublicJwkTypes.includes(publicJwkClass))
  }

  public createByCryptosuite(agentContext: AgentContext, cryptosuite: string) {
    const cryptosuiteInfo = this.getByCryptosuite(cryptosuite)
    return new cryptosuiteInfo.cryptosuiteClass(agentContext)
  }
}
