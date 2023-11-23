import type { IssuerMetadata } from './OpenId4VcIssuerServiceOptions'
import type { CNonceState, CredentialOfferSession, IStateManager, URIState } from '@sphereon/oid4vci-common'

import { MemoryStates } from '@sphereon/oid4vci-issuer'

export interface OpenId4VcIssuerModuleConfigOptions {
  issuerMetadata: IssuerMetadata
  cNonceStateManager?: IStateManager<CNonceState>
  credentialOfferSessionManager?: IStateManager<CredentialOfferSession>
  uriStateManager?: IStateManager<URIState>

  cNonceExpiresIn?: number
  tokenExpiresIn?: number
}

export class OpenId4VcIssuerModuleConfig {
  private _issuerMetadata: IssuerMetadata
  private _cNonceStateManager: IStateManager<CNonceState>
  private _credentialOfferSessionManager: IStateManager<CredentialOfferSession>
  private _uriStateManager: IStateManager<URIState>
  private _cNonceExpiresIn: number
  private _tokenExpiresIn: number

  public constructor(options: OpenId4VcIssuerModuleConfigOptions) {
    this._issuerMetadata = options.issuerMetadata
    this._cNonceStateManager = options.cNonceStateManager ?? new MemoryStates()
    this._credentialOfferSessionManager = options.credentialOfferSessionManager ?? new MemoryStates()
    this._uriStateManager = options.uriStateManager ?? new MemoryStates()
    this._cNonceExpiresIn = options.cNonceExpiresIn ?? 5 * 60 * 1000 // 5 minutes
    this._tokenExpiresIn = options.tokenExpiresIn ?? 3 * 60 * 1000 // 3 minutes
  }

  public get issuerMetadata(): IssuerMetadata {
    return this._issuerMetadata
  }

  public get cNonceStateManager(): IStateManager<CNonceState> {
    return this._cNonceStateManager
  }

  public get credentialOfferSessionManager(): IStateManager<CredentialOfferSession> {
    return this._credentialOfferSessionManager
  }

  public get uriStateManager(): IStateManager<URIState> {
    return this._uriStateManager
  }

  public get cNonceExpiresIn(): number {
    return this._cNonceExpiresIn
  }

  public get tokenExpiresIn(): number {
    return this._tokenExpiresIn
  }
}
