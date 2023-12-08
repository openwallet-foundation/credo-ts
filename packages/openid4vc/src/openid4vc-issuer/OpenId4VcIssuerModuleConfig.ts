import type { IssuerMetadata } from './OpenId4VcIssuerServiceOptions'
import type { AgentContext } from '@aries-framework/core'
import type { CNonceState, CredentialOfferSession, IStateManager, StateType, URIState } from '@sphereon/oid4vci-common'

import { MemoryStates } from '@sphereon/oid4vci-issuer'

export type StateManagerFactory<T extends StateType> = () => IStateManager<T>

export interface OpenId4VcIssuerModuleConfigOptions {
  issuerMetadata: IssuerMetadata
  cNonceStateManagerFactory?: StateManagerFactory<CNonceState>
  credentialOfferSessionManagerFactory?: StateManagerFactory<CredentialOfferSession>
  uriStateManagerFactory?: StateManagerFactory<URIState>
  cNonceExpiresIn?: number
  tokenExpiresIn?: number
}

export class OpenId4VcIssuerModuleConfig {
  private options: OpenId4VcIssuerModuleConfigOptions
  private uriStateManagerMap: Map<string, IStateManager<URIState>>
  private credentialOfferSessionManagerMap: Map<string, IStateManager<CredentialOfferSession>>
  private cNonceStateManagerMap: Map<string, IStateManager<CNonceState>>

  private basePathMap: Map<string, string>
  private _cNonceExpiresIn: number
  private _tokenExpiresIn: number

  public constructor(options: OpenId4VcIssuerModuleConfigOptions) {
    this.basePathMap = new Map()
    this.uriStateManagerMap = new Map()
    this.credentialOfferSessionManagerMap = new Map()
    this.cNonceStateManagerMap = new Map()
    this._cNonceExpiresIn = options.cNonceExpiresIn ?? 5 * 60 * 1000 // 5 minutes
    this._tokenExpiresIn = options.tokenExpiresIn ?? 3 * 60 * 1000 // 3 minutes
    this.options = options
  }

  public get issuerMetadata(): IssuerMetadata {
    return this.options.issuerMetadata
  }

  public get cNonceExpiresIn(): number {
    return this._cNonceExpiresIn
  }

  public get tokenExpiresIn(): number {
    return this._tokenExpiresIn
  }

  public getBasePath(agentContext: AgentContext): string {
    return this.basePathMap.get(agentContext.contextCorrelationId) ?? '/'
  }

  public setBasePath(agentContext: AgentContext, basePath: string): void {
    this.basePathMap.set(agentContext.contextCorrelationId, basePath)
  }

  public getUriStateManager(agentContext: AgentContext) {
    const val = this.uriStateManagerMap.get(agentContext.contextCorrelationId)
    if (val) return val

    const newVal = this.options.uriStateManagerFactory?.() ?? new MemoryStates<URIState>()
    this.uriStateManagerMap.set(agentContext.contextCorrelationId, newVal)
    return newVal
  }

  public getCredentialOfferSessionStateManager(agentContext: AgentContext) {
    const val = this.credentialOfferSessionManagerMap.get(agentContext.contextCorrelationId)
    if (val) return val

    const newVal = this.options.credentialOfferSessionManagerFactory?.() ?? new MemoryStates<CredentialOfferSession>()
    this.credentialOfferSessionManagerMap.set(agentContext.contextCorrelationId, newVal)
    return newVal
  }

  public getCNonceStateManager(agentContext: AgentContext) {
    const val = this.cNonceStateManagerMap.get(agentContext.contextCorrelationId)
    if (val) return val

    const newVal = this.options.cNonceStateManagerFactory?.() ?? new MemoryStates<CNonceState>()
    this.cNonceStateManagerMap.set(agentContext.contextCorrelationId, newVal)
    return newVal
  }
}
