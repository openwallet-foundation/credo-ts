import type { OpenId4VcIssuanceSessionStateChangedEvent } from '../OpenId4VcIssuerEvents'
import type { AgentContext, Query } from '@credo-ts/core'
import type { CredentialOfferSession, IStateManager } from '@sphereon/oid4vci-common'

import { CredoError, EventEmitter } from '@credo-ts/core'
import { IssueStatus } from '@sphereon/oid4vci-common'

import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerEvents } from '../OpenId4VcIssuerEvents'

import { OpenId4VcIssuanceSessionRecord } from './OpenId4VcIssuanceSessionRecord'
import { OpenId4VcIssuanceSessionRepository } from './OpenId4VcIssuanceSessionRepository'

export type OpenId4VcIssuanceCodeType = 'preAuthorized' | 'issuerState'

const createCodeQuery = (
  issuerId: string,
  code: string,
  type?: OpenId4VcIssuanceCodeType
): Query<OpenId4VcIssuanceSessionRecord> => {
  const $or: Query<OpenId4VcIssuanceSessionRecord>[] = []

  if (!type || type === 'preAuthorized') $or.push({ preAuthorizedCode: code })
  if (!type || type === 'issuerState') $or.push({ issuerState: code })

  return { issuerId, $or }
}

export class OpenId4VcCredentialOfferSessionStateManager implements IStateManager<CredentialOfferSession> {
  private openId4VcIssuanceSessionRepository: OpenId4VcIssuanceSessionRepository
  private eventEmitter: EventEmitter

  public constructor(private agentContext: AgentContext, private issuerId: string) {
    this.openId4VcIssuanceSessionRepository = agentContext.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    this.eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)
  }

  public async set(code: string, stateValue: CredentialOfferSession, type?: OpenId4VcIssuanceCodeType): Promise<void> {
    // Just to make sure that the preAuthorizedCode is the same as the id as that's what we use to query
    // NOTE: once we support authorized flow, we need to also allow the id to be equal to issuer state
    if (
      (type === 'preAuthorized' && code !== stateValue.preAuthorizedCode) ||
      (type === 'issuerState' && code !== stateValue.issuerState)
    ) {
      throw new CredoError(`Expected the id of the credential offer state to be equal to the '${type}'`)
    }

    if (code !== stateValue.issuerState && code !== stateValue.preAuthorizedCode) {
      throw new CredoError(
        `Expected the id of the credential offer state to be equal to the 'preAuthorizedCode' or 'issuerState'`
      )
    }

    if (!stateValue.issuerState && !stateValue.preAuthorizedCode) {
      throw new CredoError("Expected the stateValue to have a 'preAuthorizedCode' or 'issuerState' property")
    }

    // Record may already exist
    let record = await this.openId4VcIssuanceSessionRepository.findSingleByQuery(
      this.agentContext,
      createCodeQuery(this.issuerId, code, type)
    )

    const previousState = record?.state ?? null

    let credentialOfferUri = stateValue.credentialOffer.credential_offer_uri
    if (!credentialOfferUri) {
      throw new CredoError("Expected the stateValue to have a 'credentialOfferUri' property")
    }

    if (credentialOfferUri.includes('credential_offer_uri=')) {
      // NOTE: it's a bit cumbersome, but the credential_offer_uri is the encoded uri. This seems
      // odd to me, as this is the offer payload, which should only contain the hosted URI (I think
      // this is a bug in OID4VCI). But for now we have to extract the uri from the payload.
      credentialOfferUri = decodeURIComponent(credentialOfferUri.split('credential_offer_uri=')[1].split('=')[0])
    }

    let state = openId4VcIssuanceStateFromSphereon(stateValue.status)

    // we set the completed state manually when all credentials have been issued
    if (
      state === OpenId4VcIssuanceSessionState.CredentialsPartiallyIssued &&
      (record?.issuedCredentials?.length ?? 0) >= stateValue.credentialOffer.credential_offer.credentials.length
    ) {
      state = OpenId4VcIssuanceSessionState.Completed
    }

    // NOTE: we don't use clientId at the moment, will become relevant when doing the authorized flow
    if (record) {
      record.issuanceMetadata = stateValue.credentialDataSupplierInput
      record.credentialOfferPayload = stateValue.credentialOffer.credential_offer
      record.userPin = stateValue.userPin
      record.preAuthorizedCode = stateValue.preAuthorizedCode
      record.issuerState = stateValue.issuerState
      record.errorMessage = stateValue.error
      record.credentialOfferUri = credentialOfferUri
      record.state = state
      await this.openId4VcIssuanceSessionRepository.update(this.agentContext, record)
    } else {
      record = new OpenId4VcIssuanceSessionRecord({
        issuerId: this.issuerId,
        preAuthorizedCode: stateValue.preAuthorizedCode,
        issuerState: stateValue.issuerState,
        issuanceMetadata: stateValue.credentialDataSupplierInput,
        credentialOfferPayload: stateValue.credentialOffer.credential_offer,
        credentialOfferUri,
        userPin: stateValue.userPin,
        errorMessage: stateValue.error,
        state: state,
      })

      await this.openId4VcIssuanceSessionRepository.save(this.agentContext, record)
    }

    this.emitStateChangedEvent(this.agentContext, record, previousState)
  }

  public async get(code: string, type?: OpenId4VcIssuanceCodeType): Promise<CredentialOfferSession | undefined> {
    const record = await this.openId4VcIssuanceSessionRepository.findSingleByQuery(
      this.agentContext,
      createCodeQuery(this.issuerId, code, type)
    )

    if (!record) return undefined

    if (!record.preAuthorizedCode && !record.issuerState) {
      throw new CredoError("No 'preAuthorizedCode' and 'issuerState' found on record.")
    }

    if (!record.credentialOfferPayload) {
      throw new CredoError("No 'credentialOfferPayload' found on record.")
    }

    return {
      credentialOffer: {
        credential_offer: record.credentialOfferPayload,
        credential_offer_uri: record.credentialOfferUri,
      },
      status: sphereonIssueStatusFromOpenId4VcIssuanceState(record.state),
      preAuthorizedCode: record.preAuthorizedCode,
      issuerState: record.issuerState,
      credentialDataSupplierInput: record.issuanceMetadata,
      error: record.errorMessage,
      userPin: record.userPin,
      createdAt: record.createdAt.getTime(),
      lastUpdatedAt: record.updatedAt?.getTime() ?? record.createdAt.getTime(),
    }
  }

  public async has(code: string, type?: OpenId4VcIssuanceCodeType): Promise<boolean> {
    const record = await this.openId4VcIssuanceSessionRepository.findSingleByQuery(
      this.agentContext,
      createCodeQuery(this.issuerId, code, type)
    )

    return record !== undefined
  }

  public async delete(code: string, type?: OpenId4VcIssuanceCodeType): Promise<boolean> {
    const record = await this.openId4VcIssuanceSessionRepository.findSingleByQuery(
      this.agentContext,
      createCodeQuery(this.issuerId, code, type)
    )

    if (!record) return false

    await this.openId4VcIssuanceSessionRepository.deleteById(this.agentContext, record.id)
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

  public async getAsserted(code: string, type?: OpenId4VcIssuanceCodeType): Promise<CredentialOfferSession> {
    const state = await this.get(code, type)

    if (!state) {
      throw new CredoError(`No credential offer state found for id '${code}'`)
    }

    return state
  }

  public async startCleanupRoutine(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public async stopCleanupRoutine(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  protected emitStateChangedEvent(
    agentContext: AgentContext,
    issuanceSession: OpenId4VcIssuanceSessionRecord,
    previousState: OpenId4VcIssuanceSessionState | null
  ) {
    this.eventEmitter.emit<OpenId4VcIssuanceSessionStateChangedEvent>(agentContext, {
      type: OpenId4VcIssuerEvents.IssuanceSessionStateChanged,
      payload: {
        issuanceSession: issuanceSession.clone(),
        previousState,
      },
    })
  }
}

function openId4VcIssuanceStateFromSphereon(stateValue: IssueStatus): OpenId4VcIssuanceSessionState {
  if (stateValue === IssueStatus.OFFER_CREATED) return OpenId4VcIssuanceSessionState.OfferCreated
  if (stateValue === IssueStatus.OFFER_URI_RETRIEVED) return OpenId4VcIssuanceSessionState.OfferUriRetrieved
  if (stateValue === IssueStatus.ACCESS_TOKEN_REQUESTED) return OpenId4VcIssuanceSessionState.AccessTokenRequested
  if (stateValue === IssueStatus.ACCESS_TOKEN_CREATED) return OpenId4VcIssuanceSessionState.AccessTokenCreated
  if (stateValue === IssueStatus.CREDENTIAL_REQUEST_RECEIVED)
    return OpenId4VcIssuanceSessionState.CredentialRequestReceived
  // we set the completed state manually when all credentials have been issued
  if (stateValue === IssueStatus.CREDENTIAL_ISSUED) return OpenId4VcIssuanceSessionState.CredentialsPartiallyIssued
  if (stateValue === IssueStatus.ERROR) return OpenId4VcIssuanceSessionState.Error

  throw new CredoError(`Unknown state value: ${stateValue}`)
}

function sphereonIssueStatusFromOpenId4VcIssuanceState(state: OpenId4VcIssuanceSessionState): IssueStatus {
  if (state === OpenId4VcIssuanceSessionState.OfferCreated) return IssueStatus.OFFER_CREATED
  if (state === OpenId4VcIssuanceSessionState.OfferUriRetrieved) return IssueStatus.OFFER_URI_RETRIEVED
  if (state === OpenId4VcIssuanceSessionState.AccessTokenRequested) return IssueStatus.ACCESS_TOKEN_REQUESTED
  if (state === OpenId4VcIssuanceSessionState.AccessTokenCreated) return IssueStatus.ACCESS_TOKEN_CREATED
  if (state === OpenId4VcIssuanceSessionState.CredentialRequestReceived) return IssueStatus.CREDENTIAL_REQUEST_RECEIVED
  // sphereon does not have a completed state indicating that all credentials have been issued
  if (state === OpenId4VcIssuanceSessionState.CredentialsPartiallyIssued) return IssueStatus.CREDENTIAL_ISSUED
  if (state === OpenId4VcIssuanceSessionState.Completed) return IssueStatus.CREDENTIAL_ISSUED
  if (state === OpenId4VcIssuanceSessionState.Error) return IssueStatus.ERROR

  throw new CredoError(`Unknown state value: ${state}`)
}
