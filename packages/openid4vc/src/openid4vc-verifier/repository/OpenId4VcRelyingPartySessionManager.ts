import type { OpenId4VcVerificationSessionRecord } from './OpenId4VcVerificationSessionRecord'
import type {
  OpenId4VcSiopAuthorizationRequestPayload,
  OpenId4VcSiopAuthorizationResponsePayload,
} from '../../shared/index'
import type { AgentContext } from '@credo-ts/core'

import { CredoError } from '@credo-ts/core'
import { parseOpenid4vpAuthorizationRequestPayload } from '@openid4vc/openid4vp'

import { OpenId4VcVerificationSessionState } from '../OpenId4VcVerificationSessionState'

import { OpenId4VcVerificationSessionRepository } from './OpenId4VcVerificationSessionRepository'

export interface AuthorizationRequestState {
  correlationId?: string
  request: OpenId4VcSiopAuthorizationRequestPayload
  status: AuthorizationRequestStateStatus
  timestamp: number
  lastUpdated: number
  error?: Error
}

export interface AuthorizationResponseState {
  correlationId?: string
  response: OpenId4VcSiopAuthorizationResponsePayload
  status: AuthorizationResponseStateStatus
  timestamp: number
  lastUpdated: number
  error?: Error
}

export enum AuthorizationRequestStateStatus {
  CREATED = 'created',
  SENT = 'sent',
  RECEIVED = 'received',
  VERIFIED = 'verified',
  ERROR = 'error',
}

export enum AuthorizationResponseStateStatus {
  CREATED = 'created',
  SENT = 'sent',
  RECEIVED = 'received',
  VERIFIED = 'verified',
  ERROR = 'error',
}

export class OpenId4VcRelyingPartySessionManager {
  private openId4VcVerificationSessionRepository: OpenId4VcVerificationSessionRepository

  public constructor(private agentContext: AgentContext, private verifierId: string) {
    this.openId4VcVerificationSessionRepository = agentContext.dependencyManager.resolve(
      OpenId4VcVerificationSessionRepository
    )
  }

  public async getRequestStateByCorrelationId(
    correlationId: string,
    errorOnNotFound?: boolean
  ): Promise<AuthorizationRequestState | undefined> {
    const verificationSession = await this.openId4VcVerificationSessionRepository.findById(
      this.agentContext,
      correlationId
    )

    if (!verificationSession) {
      if (errorOnNotFound)
        throw new CredoError(`OpenID4VC Authorization request state for correlation id ${correlationId} not found`)
      return undefined
    }

    return this.getRequestStateFromSessionRecord(verificationSession)
  }

  public async getRequestStateByNonce(
    nonce: string,
    errorOnNotFound?: boolean
  ): Promise<AuthorizationRequestState | undefined> {
    const verificationSession = await this.openId4VcVerificationSessionRepository.findSingleByQuery(this.agentContext, {
      verifierId: this.verifierId,
      nonce: nonce,
    })

    if (!verificationSession) {
      if (errorOnNotFound) throw new CredoError(`OpenID4VC Authorization request state for nonce ${nonce} not found`)
      return undefined
    }

    return this.getRequestStateFromSessionRecord(verificationSession)
  }

  public async getRequestStateByState(
    state: string,
    errorOnNotFound?: boolean
  ): Promise<AuthorizationRequestState | undefined> {
    const verificationSession = await this.openId4VcVerificationSessionRepository.findSingleByQuery(this.agentContext, {
      verifierId: this.verifierId,
      payloadState: state,
    })

    if (!verificationSession) {
      if (errorOnNotFound) throw new CredoError(`OpenID4VC Authorization request state for state ${state} not found`)
      return undefined
    }

    return this.getRequestStateFromSessionRecord(verificationSession)
  }

  public async getResponseStateByCorrelationId(
    correlationId: string,
    errorOnNotFound?: boolean
  ): Promise<AuthorizationResponseState | undefined> {
    const verificationSession = await this.openId4VcVerificationSessionRepository.findById(
      this.agentContext,
      correlationId
    )

    const responseState = await this.getResponseStateFromSessionRecord(verificationSession)
    if (!responseState) {
      if (errorOnNotFound)
        throw new CredoError(`OpenID4VC Authorization response state for correlation id ${correlationId} not found`)
      return undefined
    }

    return responseState
  }

  public async getResponseStateByNonce(
    nonce: string,
    errorOnNotFound?: boolean
  ): Promise<AuthorizationResponseState | undefined> {
    const verificationSession = await this.openId4VcVerificationSessionRepository.findSingleByQuery(this.agentContext, {
      verifierId: this.verifierId,
      nonce,
    })

    const responseState = await this.getResponseStateFromSessionRecord(verificationSession)
    if (!responseState) {
      if (errorOnNotFound) throw new CredoError(`OpenID4VC Authorization response state for nonce ${nonce} not found`)
      return undefined
    }

    return responseState
  }

  public async getResponseStateByState(
    state: string,
    errorOnNotFound?: boolean
  ): Promise<AuthorizationResponseState | undefined> {
    const verificationSession = await this.openId4VcVerificationSessionRepository.findSingleByQuery(this.agentContext, {
      verifierId: this.verifierId,
      payloadState: state,
    })

    const responseState = await this.getResponseStateFromSessionRecord(verificationSession)
    if (!responseState) {
      if (errorOnNotFound) throw new CredoError(`OpenID4VC Authorization response state for state ${state} not found`)
      return undefined
    }

    return responseState
  }

  public async getCorrelationIdByNonce(nonce: string, errorOnNotFound?: boolean): Promise<string | undefined> {
    const requestState = await this.getRequestStateByNonce(nonce, errorOnNotFound)
    return requestState?.correlationId
  }

  public async getCorrelationIdByState(state: string, errorOnNotFound?: boolean): Promise<string | undefined> {
    const requestState = await this.getRequestStateByState(state, errorOnNotFound)
    return requestState?.correlationId
  }

  public async deleteStateForCorrelationId() {
    throw new Error('Method not implemented.')
  }

  private async getRequestStateFromSessionRecord(
    sessionRecord: OpenId4VcVerificationSessionRecord
  ): Promise<AuthorizationRequestState> {
    const lastUpdated = sessionRecord.updatedAt?.getTime() ?? sessionRecord.createdAt.getTime()
    const parsed = parseOpenid4vpAuthorizationRequestPayload({ requestPayload: sessionRecord.authorizationRequestJwt })
    if (parsed.type === 'jar') {
      throw new CredoError('Parsed authorization request jwt as jar request.')
    }

    return {
      lastUpdated,
      timestamp: lastUpdated,
      correlationId: sessionRecord.id,
      // Not so nice that the session manager expects an error instance.....
      error: sessionRecord.errorMessage ? new Error(sessionRecord.errorMessage) : undefined,
      request: parsed.params,
      status: sphereonAuthorizationRequestStateFromOpenId4VcVerificationState(sessionRecord.state),
    }
  }

  private async getResponseStateFromSessionRecord(
    sessionRecord: OpenId4VcVerificationSessionRecord | null
  ): Promise<AuthorizationResponseState | undefined> {
    if (!sessionRecord) return undefined
    const lastUpdated = sessionRecord.updatedAt?.getTime() ?? sessionRecord.createdAt.getTime()

    // If we don't have the authorization response payload yet, it means we haven't
    // received the response yet, and thus the response state does not exist yet
    if (!sessionRecord.authorizationResponsePayload) {
      return undefined
    }

    return {
      lastUpdated,
      timestamp: lastUpdated,
      correlationId: sessionRecord.id,
      // Not so nice that the session manager expects an error instance.....
      error: sessionRecord.errorMessage ? new Error(sessionRecord.errorMessage) : undefined,
      response: sessionRecord.authorizationResponsePayload,
      status: sphereonAuthorizationResponseStateFromOpenId4VcVerificationState(sessionRecord.state),
    }
  }
}

function sphereonAuthorizationResponseStateFromOpenId4VcVerificationState(
  state: OpenId4VcVerificationSessionState
): AuthorizationResponseStateStatus {
  if (state === OpenId4VcVerificationSessionState.Error) return AuthorizationResponseStateStatus.ERROR
  if (state === OpenId4VcVerificationSessionState.ResponseVerified) return AuthorizationResponseStateStatus.VERIFIED

  throw new CredoError(`Can not map OpenId4VcVerificationSessionState ${state} to AuthorizationResponseStateStatus`)
}

function sphereonAuthorizationRequestStateFromOpenId4VcVerificationState(
  state: OpenId4VcVerificationSessionState
): AuthorizationRequestStateStatus {
  if (state === OpenId4VcVerificationSessionState.Error) return AuthorizationRequestStateStatus.ERROR

  if (
    [OpenId4VcVerificationSessionState.RequestCreated, OpenId4VcVerificationSessionState.ResponseVerified].includes(
      state
    )
  ) {
    return AuthorizationRequestStateStatus.CREATED
  }

  if (state === OpenId4VcVerificationSessionState.RequestUriRetrieved) return AuthorizationRequestStateStatus.SENT

  throw new CredoError(`Can not map OpenId4VcVerificationSessionState ${state} to AuthorizationRequestStateStatus`)
}
