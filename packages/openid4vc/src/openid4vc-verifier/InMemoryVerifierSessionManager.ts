import type { VerifyProofResponseOptions } from './OpenId4VcVerifierServiceOptions'
import type { Logger } from '@aries-framework/core'
import type {
  AuthorizationEvent,
  AuthorizationRequest,
  AuthorizationRequestState,
  AuthorizationResponse,
  AuthorizationResponseState,
  IRPSessionManager as SphereonRPSessionManager,
} from '@sphereon/did-auth-siop'
import type { PresentationDefinitionV1, PresentationDefinitionV2 } from '@sphereon/pex-models'
import type { EventEmitter } from 'events'

import { AriesFrameworkError } from '@aries-framework/core'
import {
  AuthorizationEvents,
  AuthorizationRequestStateStatus,
  AuthorizationResponseStateStatus,
} from '@sphereon/did-auth-siop'

export type PresentationDefinitionForCorrelationId =
  | {
      proofType: 'presentation'
      presentationDefinition: PresentationDefinitionV1 | PresentationDefinitionV2
    }
  | {
      proofType: 'authentication'
    }

export interface IInMemoryVerifierSessionManager extends SphereonRPSessionManager {
  getVerifiyProofResponseOptions(correlationId: string): Promise<VerifyProofResponseOptions | undefined>
  saveVerifyProofResponseOptions(
    correlationId: string,
    presentationDefinitionForCorrelationId: VerifyProofResponseOptions
  ): Promise<void>
}

/**
 * Please note that this session manager is not really meant to be used in large production settings, as it stores everything in memory!
 * It also doesn't do scheduled cleanups. It runs a cleanup whenever a request or response is received. In a high-volume production setting you will want scheduled cleanups running in the background
 * Since this is a low level library we have not created a full-fledged implementation.
 * We suggest to create your own implementation using the event system of the library
 */
export class InMemoryVerifierSessionManager implements IInMemoryVerifierSessionManager {
  private readonly authorizationRequests: Record<string, AuthorizationRequestState> = {}
  private readonly authorizationResponses: Record<string, AuthorizationResponseState> = {}
  private readonly logger: Logger

  private readonly nonceToCorrelationId: Record<string, string> = {}

  private readonly stateToCorrelationId: Record<string, string> = {}

  private readonly correlationIdToVerifyProofResponseOptions: Record<string, VerifyProofResponseOptions> = {}

  private readonly maxAgeInSeconds: number

  private static getKeysForCorrelationId<T>(mapping: Record<number, T>, correlationId: string): number[] {
    return Object.entries(mapping)
      .filter((entry) => entry[1] === correlationId)
      .map((filtered) => Number.parseInt(filtered[0]))
  }

  public constructor(eventEmitter: EventEmitter, logger: Logger, opts?: { maxAgeInSeconds?: number }) {
    this.logger = logger
    this.maxAgeInSeconds = opts?.maxAgeInSeconds ?? 5 * 60
    eventEmitter.on(
      AuthorizationEvents.ON_AUTH_REQUEST_CREATED_SUCCESS,
      this.onAuthorizationRequestCreatedSuccess.bind(this)
    )
    eventEmitter.on(
      AuthorizationEvents.ON_AUTH_REQUEST_CREATED_FAILED,
      this.onAuthorizationRequestCreatedFailed.bind(this)
    )
    eventEmitter.on(AuthorizationEvents.ON_AUTH_REQUEST_SENT_SUCCESS, this.onAuthorizationRequestSentSuccess.bind(this))
    eventEmitter.on(AuthorizationEvents.ON_AUTH_REQUEST_SENT_FAILED, this.onAuthorizationRequestSentFailed.bind(this))
    eventEmitter.on(
      AuthorizationEvents.ON_AUTH_RESPONSE_RECEIVED_SUCCESS,
      this.onAuthorizationResponseReceivedSuccess.bind(this)
    )
    eventEmitter.on(
      AuthorizationEvents.ON_AUTH_RESPONSE_RECEIVED_FAILED,
      this.onAuthorizationResponseReceivedFailed.bind(this)
    )
    eventEmitter.on(
      AuthorizationEvents.ON_AUTH_RESPONSE_VERIFIED_SUCCESS,
      this.onAuthorizationResponseVerifiedSuccess.bind(this)
    )
    eventEmitter.on(
      AuthorizationEvents.ON_AUTH_RESPONSE_VERIFIED_FAILED,
      this.onAuthorizationResponseVerifiedFailed.bind(this)
    )
  }
  public async getVerifiyProofResponseOptions(correlationId: string): Promise<VerifyProofResponseOptions | undefined> {
    return this.correlationIdToVerifyProofResponseOptions[correlationId]
  }

  public async saveVerifyProofResponseOptions(
    correlationId: string,
    verifyProofResponseOptions: VerifyProofResponseOptions
  ) {
    await this.cleanup()
    this.correlationIdToVerifyProofResponseOptions[correlationId] = verifyProofResponseOptions
  }

  public async getRequestStateByCorrelationId(
    correlationId: string,
    errorOnNotFound?: boolean
  ): Promise<AuthorizationRequestState | undefined> {
    return await this.getFromMapping('correlationId', correlationId, this.authorizationRequests, errorOnNotFound)
  }

  public async getRequestStateByNonce(
    nonce: string,
    errorOnNotFound?: boolean
  ): Promise<AuthorizationRequestState | undefined> {
    return await this.getFromMapping('nonce', nonce, this.authorizationRequests, errorOnNotFound)
  }

  public async getRequestStateByState(
    state: string,
    errorOnNotFound?: boolean
  ): Promise<AuthorizationRequestState | undefined> {
    return await this.getFromMapping('state', state, this.authorizationRequests, errorOnNotFound)
  }

  public async getResponseStateByCorrelationId(
    correlationId: string,
    errorOnNotFound?: boolean
  ): Promise<AuthorizationResponseState | undefined> {
    return await this.getFromMapping('correlationId', correlationId, this.authorizationResponses, errorOnNotFound)
  }

  public async getResponseStateByNonce(
    nonce: string,
    errorOnNotFound?: boolean
  ): Promise<AuthorizationResponseState | undefined> {
    return await this.getFromMapping('nonce', nonce, this.authorizationResponses, errorOnNotFound)
  }

  public async getResponseStateByState(
    state: string,
    errorOnNotFound?: boolean
  ): Promise<AuthorizationResponseState | undefined> {
    return await this.getFromMapping('state', state, this.authorizationResponses, errorOnNotFound)
  }

  private async getFromMapping<T>(
    type: 'nonce' | 'state' | 'correlationId',
    value: string,
    mapping: Record<string, T>,
    errorOnNotFound?: boolean
  ): Promise<T> {
    const correlationId =
      type === 'correlationId' ? value : await this.getCorrelationIdImpl(type, value, errorOnNotFound)
    if (!correlationId) throw new AriesFrameworkError(`Could not find ${type} from correlation id ${correlationId}`)

    const result = mapping[correlationId]
    if (!result && errorOnNotFound)
      throw new AriesFrameworkError(`Could not find ${type} from correlation id ${correlationId}`)
    return result
  }

  private async onAuthorizationRequestCreatedSuccess(event: AuthorizationEvent<AuthorizationRequest>): Promise<void> {
    this.updateState('request', event, AuthorizationRequestStateStatus.CREATED).catch((error) =>
      this.logger.error(JSON.stringify(error))
    )
  }

  private async onAuthorizationRequestCreatedFailed(event: AuthorizationEvent<AuthorizationRequest>): Promise<void> {
    this.updateState('request', event, AuthorizationRequestStateStatus.ERROR).catch((error) =>
      this.logger.error(JSON.stringify(error))
    )
  }

  private async onAuthorizationRequestSentSuccess(event: AuthorizationEvent<AuthorizationRequest>): Promise<void> {
    this.updateState('request', event, AuthorizationRequestStateStatus.SENT).catch((error) =>
      this.logger.error(JSON.stringify(error))
    )
  }

  private async onAuthorizationRequestSentFailed(event: AuthorizationEvent<AuthorizationRequest>): Promise<void> {
    this.updateState('request', event, AuthorizationRequestStateStatus.ERROR).catch((error) =>
      this.logger.error(JSON.stringify(error))
    )
  }

  private async onAuthorizationResponseReceivedSuccess(
    event: AuthorizationEvent<AuthorizationResponse>
  ): Promise<void> {
    await this.updateState('response', event, AuthorizationResponseStateStatus.RECEIVED)
  }

  private async onAuthorizationResponseReceivedFailed(event: AuthorizationEvent<AuthorizationResponse>): Promise<void> {
    await this.updateState('response', event, AuthorizationResponseStateStatus.ERROR)
  }

  private async onAuthorizationResponseVerifiedFailed(event: AuthorizationEvent<AuthorizationResponse>): Promise<void> {
    await this.updateState('response', event, AuthorizationResponseStateStatus.ERROR)
  }

  private async onAuthorizationResponseVerifiedSuccess(
    event: AuthorizationEvent<AuthorizationResponse>
  ): Promise<void> {
    await this.updateState('response', event, AuthorizationResponseStateStatus.VERIFIED)
  }

  public async getCorrelationIdByNonce(nonce: string, errorOnNotFound?: boolean): Promise<string | undefined> {
    return await this.getCorrelationIdImpl('nonce', nonce, errorOnNotFound)
  }

  public async getCorrelationIdByState(state: string, errorOnNotFound?: boolean): Promise<string | undefined> {
    return await this.getCorrelationIdImpl('state', state, errorOnNotFound)
  }

  private async getCorrelationIdImpl(
    type: 'nonce' | 'state',
    key: string,
    errorOnNotFound?: boolean
  ): Promise<string | undefined> {
    let correlationId: string
    if (type === 'nonce') {
      correlationId = this.nonceToCorrelationId[key]
    } else if (type === 'state') {
      correlationId = this.stateToCorrelationId[key]
    } else {
      throw new AriesFrameworkError(`Unknown type ${type}`)
    }

    if (!correlationId && errorOnNotFound) throw new AriesFrameworkError(`Could not find ${type} '${key}'`)

    return correlationId
  }

  private async updateMapping<T>(
    mapping: Record<string, T>,
    event: AuthorizationEvent<AuthorizationRequest | AuthorizationResponse>,
    propertyKey: string,
    value: T,
    allowExisting: boolean
  ) {
    const key = (await event.subject.getMergedProperty(propertyKey)) as string
    if (!key) {
      throw new AriesFrameworkError(`No value found for key ${value} in Authorization Request`)
    }

    const existing = mapping[key]

    if (existing) {
      if (!allowExisting) {
        throw new AriesFrameworkError(`Mapping exists for key ${propertyKey} and we do not allow overwriting values`)
      } else if (existing !== value) {
        throw new AriesFrameworkError('Value changed for key')
      }
    }
    if (!value) {
      delete mapping[key]
    } else {
      mapping[key] = value
    }
  }

  private async updateState(
    type: 'request' | 'response',
    event: AuthorizationEvent<AuthorizationRequest | AuthorizationResponse>,
    status: AuthorizationRequestStateStatus | AuthorizationResponseStateStatus
  ): Promise<void> {
    if (!event.correlationId) {
      throw new AriesFrameworkError(`'${type} ${status}' event without correlation id received`)
    }

    try {
      const eventState = {
        correlationId: event.correlationId,
        ...(type === 'request' ? { request: event.subject } : {}),
        ...(type === 'response' ? { response: event.subject } : {}),
        ...(event.error ? { error: event.error } : {}),
        status,
        timestamp: event.timestamp,
        lastUpdated: event.timestamp,
      }
      if (type === 'request') {
        this.authorizationRequests[event.correlationId] = eventState as AuthorizationRequestState
        // We do not await these
        this.updateMapping(this.nonceToCorrelationId, event, 'nonce', event.correlationId, true).catch((error) =>
          this.logger.error(JSON.stringify(error))
        )
        this.nonceToCorrelationId
        this.updateMapping(this.stateToCorrelationId, event, 'state', event.correlationId, true).catch((error) =>
          this.logger.error(JSON.stringify(error))
        )
      } else {
        this.authorizationResponses[event.correlationId] = eventState as AuthorizationResponseState
      }
    } catch (error: unknown) {
      this.logger.error(`Error in update state happened: ${error}`)
    }
  }

  private static async cleanMappingForCorrelationId<T>(
    mapping: Record<number, T>,
    correlationId: string
  ): Promise<void> {
    const keys = InMemoryVerifierSessionManager.getKeysForCorrelationId(mapping, correlationId)
    if (keys && keys.length > 0) {
      keys.forEach((key) => delete mapping[key])
    }
  }

  public async deleteStateForCorrelationId(correlationId: string) {
    InMemoryVerifierSessionManager.cleanMappingForCorrelationId(this.nonceToCorrelationId, correlationId).catch(
      (error) => this.logger.error(JSON.stringify(error))
    )
    InMemoryVerifierSessionManager.cleanMappingForCorrelationId(this.stateToCorrelationId, correlationId).catch(
      (error) => this.logger.error(JSON.stringify(error))
    )
    delete this.authorizationRequests[correlationId]
    delete this.authorizationResponses[correlationId]
    delete this.correlationIdToVerifyProofResponseOptions[correlationId]
  }

  private async cleanup() {
    const now = Date.now()
    const maxAgeInMS = this.maxAgeInSeconds * 1000

    const cleanupCorrelations = async (
      reqByCorrelationId: [string, AuthorizationRequestState | AuthorizationResponseState]
    ) => {
      const correlationId = reqByCorrelationId[0]
      const authState = reqByCorrelationId[1]

      const ts = authState.lastUpdated || authState.timestamp
      if (maxAgeInMS !== 0 && now > ts + maxAgeInMS) {
        await this.deleteStateForCorrelationId(correlationId)
      }
    }

    const authRequests = Object.entries(this.authorizationRequests).map(cleanupCorrelations)
    const authResponses = Object.entries(this.authorizationResponses).map(cleanupCorrelations)
    await Promise.all([...authRequests, ...authResponses])
  }
}
