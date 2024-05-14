import type { AgentContext } from '@credo-ts/core'
import type { CNonceState, IStateManager } from '@sphereon/oid4vci-common'

import { CredoError } from '@credo-ts/core'

import { OpenId4VcIssuerModuleConfig } from '../OpenId4VcIssuerModuleConfig'

import { OpenId4VcIssuanceSessionRepository } from './OpenId4VcIssuanceSessionRepository'

export class OpenId4VcCNonceStateManager implements IStateManager<CNonceState> {
  private openId4VcIssuanceSessionRepository: OpenId4VcIssuanceSessionRepository
  private openId4VcIssuerModuleConfig: OpenId4VcIssuerModuleConfig

  public constructor(private agentContext: AgentContext, private issuerId: string) {
    this.openId4VcIssuanceSessionRepository = agentContext.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    this.openId4VcIssuerModuleConfig = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
  }

  public async set(cNonce: string, stateValue: CNonceState): Promise<void> {
    // Just to make sure that the cNonce is the same as the id as that's what we use to query
    if (cNonce !== stateValue.cNonce) {
      throw new CredoError('Expected the id of the cNonce state to be equal to the cNonce')
    }

    if (!stateValue.preAuthorizedCode) {
      throw new CredoError("Expected the stateValue to have a 'preAuthorizedCode' property")
    }

    // Record MUST exist (otherwise there's no issuance session active yet)
    const record = await this.openId4VcIssuanceSessionRepository.getSingleByQuery(this.agentContext, {
      // NOTE: once we support authorized flow, we need to add an $or for the issuer state as well
      issuerId: this.issuerId,
      preAuthorizedCode: stateValue.preAuthorizedCode,
    })

    // cNonce already matches, no need to update
    if (record.cNonce === stateValue.cNonce) {
      return
    }

    const expiresAtDate = new Date(
      Date.now() + this.openId4VcIssuerModuleConfig.accessTokenEndpoint.cNonceExpiresInSeconds * 1000
    )

    record.cNonce = stateValue.cNonce
    record.cNonceExpiresAt = expiresAtDate
    await this.openId4VcIssuanceSessionRepository.update(this.agentContext, record)
  }

  public async get(cNonce: string): Promise<CNonceState | undefined> {
    const record = await this.openId4VcIssuanceSessionRepository.findSingleByQuery(this.agentContext, {
      issuerId: this.issuerId,
      cNonce,
    })

    if (!record) return undefined

    // NOTE: This should not happen as we query by the credential offer uri
    // so it's mostly to make TS happy
    if (!record.cNonce) {
      throw new CredoError('No cNonce found on record.')
    }

    return {
      cNonce: record.cNonce,
      preAuthorizedCode: record.preAuthorizedCode,
      createdAt: record.createdAt.getTime(),
    }
  }

  public async has(cNonce: string): Promise<boolean> {
    const record = await this.openId4VcIssuanceSessionRepository.findSingleByQuery(this.agentContext, {
      issuerId: this.issuerId,
      cNonce,
    })

    return record !== undefined
  }

  public async delete(cNonce: string): Promise<boolean> {
    const record = await this.openId4VcIssuanceSessionRepository.findSingleByQuery(this.agentContext, {
      issuerId: this.issuerId,
      cNonce,
    })

    if (!record) return false

    // We only remove the cNonce from the record, we don't want to remove
    // the whole issuance session.
    record.cNonce = undefined
    record.cNonceExpiresAt = undefined
    await this.openId4VcIssuanceSessionRepository.update(this.agentContext, record)
    return true
  }

  public async clearExpired(): Promise<void> {
    // FIXME: we should have a way to remove expired records
    // or just not return the value in the get if the record is expired
    throw new Error('Method not implemented.')
  }

  public async clearAll(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public async getAsserted(id: string): Promise<CNonceState> {
    const state = await this.get(id)

    if (!state) {
      throw new CredoError(`No cNonce state found for id ${id}`)
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
