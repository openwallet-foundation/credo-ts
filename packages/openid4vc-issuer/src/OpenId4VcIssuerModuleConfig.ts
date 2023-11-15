import type { IssuerMetadata } from './OpenId4VcIssuerServiceOptions'
import type { CNonceState, CredentialOfferSession, IStateManager, URIState } from '@sphereon/oid4vci-common'

export interface OpenId4VcIssuerModuleConfigOptions {
  issuerMetadata: IssuerMetadata
  cNonceStateManager?: IStateManager<CNonceState>
  credentialOfferSessionManager?: IStateManager<CredentialOfferSession>
  uriStateManager?: IStateManager<URIState>
}

export class OpenId4VcIssuerModuleConfig {
  private options: OpenId4VcIssuerModuleConfigOptions

  public constructor(options: OpenId4VcIssuerModuleConfigOptions) {
    this.options = options
  }

  public get issuerMetadata() {
    return this.options.issuerMetadata
  }

  public get cNonceStateManager() {
    return this.options.cNonceStateManager
  }

  public get credentialOfferSessionManager() {
    return this.options.credentialOfferSessionManager
  }

  public get uriStateManager() {
    return this.options.uriStateManager
  }
}
