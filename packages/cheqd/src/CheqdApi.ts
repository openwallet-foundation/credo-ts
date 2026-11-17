import { AgentContext, injectable } from '@credo-ts/core'

import { type CheqdCreateResourceOptions, CheqdDidRegistrar, CheqdDidResolver } from './dids'
import {
  type CreateLegacyStatusListOptions,
  checkLegacyCredentialStatus,
  checkLegacyPresentationStatus,
  createLegacyStatusList,
  fetchTokenStatusList,
  getTokenStatusListUri,
  type LegacyStatusAction,
  type LegacyStatusCredential,
  type LegacyStatusEntry,
  type PublishTokenStatusListOptions,
  publishTokenStatusList,
  setLegacyCredentialStatus,
  type TokenStatusListUriOptions,
  updateLegacyStatusList,
} from './status-list'

@injectable()
export class CheqdApi {
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
  }

  public async createResource(did: string, options: CheqdCreateResourceOptions) {
    const cheqdDidRegistrar = this.agentContext.dependencyManager.resolve(CheqdDidRegistrar)
    return await cheqdDidRegistrar.createResource(this.agentContext, did, options)
  }

  public async resolveResource(resourceUrl: string) {
    const cheqdDidResolver = this.agentContext.dependencyManager.resolve(CheqdDidResolver)
    return await cheqdDidResolver.resolveResource(this.agentContext, resourceUrl)
  }

  /** @see {@link publishTokenStatusList} */
  public async publishTokenStatusList(did: string, options: PublishTokenStatusListOptions) {
    return await publishTokenStatusList(this.agentContext, did, options)
  }

  /** @see {@link fetchTokenStatusList} */
  public async fetchTokenStatusList(did: string, name: string) {
    return await fetchTokenStatusList(this.agentContext, { did, name })
  }

  /** @see {@link getTokenStatusListUri} */
  public getTokenStatusListUri(options: TokenStatusListUriOptions) {
    return getTokenStatusListUri(options)
  }

  /** @see {@link checkLegacyCredentialStatus} */
  public async checkLegacyCredentialStatus(
    credential: { issuer: string | { id: string }; credentialStatus?: LegacyStatusEntry | LegacyStatusEntry[] },
    options?: { requireIssuerMatch?: boolean }
  ) {
    return await checkLegacyCredentialStatus(this.agentContext, credential, options)
  }

  /** @see {@link createLegacyStatusList} */
  public async createLegacyStatusList(did: string, options: CreateLegacyStatusListOptions) {
    return await createLegacyStatusList(this.agentContext, did, options)
  }

  /** @see {@link updateLegacyStatusList} */
  public async updateLegacyStatusList(did: string, options: Parameters<typeof updateLegacyStatusList>[2]) {
    return await updateLegacyStatusList(this.agentContext, did, options)
  }

  /** @see {@link setLegacyCredentialStatus} */
  public async setLegacyCredentialStatus(credential: LegacyStatusCredential, action: LegacyStatusAction) {
    return await setLegacyCredentialStatus(this.agentContext, credential, action)
  }

  /** @see {@link checkLegacyPresentationStatus} */
  public async checkLegacyPresentationStatus(presentation: {
    verifiableCredential?: LegacyStatusCredential | LegacyStatusCredential[]
  }) {
    return await checkLegacyPresentationStatus(this.agentContext, presentation)
  }
}
