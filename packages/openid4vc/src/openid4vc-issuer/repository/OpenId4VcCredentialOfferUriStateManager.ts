import type { AgentContext } from '@credo-ts/core'
import type { IStateManager, URIState } from '@sphereon/oid4vci-common'

import { CredoError } from '@credo-ts/core'

import { OpenId4VcIssuanceSessionRepository } from './OpenId4VcIssuanceSessionRepository'

export class OpenId4VcCredentialOfferUriStateManager implements IStateManager<URIState> {
  private openId4VcIssuanceSessionRepository: OpenId4VcIssuanceSessionRepository

  public constructor(private agentContext: AgentContext, private issuerId: string) {
    this.openId4VcIssuanceSessionRepository = agentContext.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
  }

  public async set(uri: string, stateValue: URIState): Promise<void> {
    // Just to make sure that the uri is the same as the id as that's what we use to query
    if (uri !== stateValue.uri) {
      throw new CredoError('Expected the uri of the uri state to be equal to the id')
    }

    // NOTE: we're currently not ding anything here, as we store the uri in the record
    // when the credential offer session is stored.
  }

  public async get(uri: string): Promise<URIState | undefined> {
    const record = await this.openId4VcIssuanceSessionRepository.findSingleByQuery(this.agentContext, {
      issuerId: this.issuerId,
      credentialOfferUri: uri,
    })

    if (!record) return undefined

    return {
      preAuthorizedCode: record.preAuthorizedCode,
      uri: record.credentialOfferUri,
      createdAt: record.createdAt.getTime(),
    }
  }

  public async has(uri: string): Promise<boolean> {
    const record = await this.openId4VcIssuanceSessionRepository.findSingleByQuery(this.agentContext, {
      issuerId: this.issuerId,
      credentialOfferUri: uri,
    })

    return record !== undefined
  }

  public async delete(): Promise<boolean> {
    // NOTE: we're not doing anything here as the uri is stored in the credential offer session
    // Not sure how to best handle this, but for now we just don't delete it
    return false
  }

  public async clearExpired(): Promise<void> {
    // FIXME: we should have a way to remove expired records
    // or just not return the value in the get if the record is expired
    throw new Error('Method not implemented.')
  }

  public async clearAll(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public async getAsserted(id: string): Promise<URIState> {
    const state = await this.get(id)

    if (!state) {
      throw new CredoError(`No uri state found for id ${id}`)
    }

    return state
  }

  public async startCleanupRoutine(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public async stopCleanupRoutine(): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
