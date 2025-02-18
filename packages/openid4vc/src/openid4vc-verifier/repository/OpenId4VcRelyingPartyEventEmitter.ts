import type { AgentContext } from '@credo-ts/core'
import type { AuthorizationEvent, AuthorizationRequest } from '@sphereon/did-auth-siop'
import type { OpenId4VcVerificationSessionStateChangedEvent } from '../OpenId4VcVerifierEvents'

import {
  AgentContextProvider,
  AgentDependencies,
  CredoError,
  EventEmitter,
  inject,
  injectable,
  InjectionSymbols,
} from '@credo-ts/core'
import { AuthorizationEvents } from '@sphereon/did-auth-siop'
import { EventEmitter as NativeEventEmitter } from 'events'

import { OpenId4VcVerificationSessionState } from '../OpenId4VcVerificationSessionState'
import { OpenId4VcVerifierEvents } from '../OpenId4VcVerifierEvents'

import { isOpenid4vpAuthorizationResponseDcApi, Openid4vpAuthorizationResponse, Openid4vpAuthorizationResponseDcApi } from '@openid4vc/oid4vp'
import { OpenId4VcVerificationSessionRecord } from './OpenId4VcVerificationSessionRecord'
import { OpenId4VcVerificationSessionRepository } from './OpenId4VcVerificationSessionRepository'

interface RelyingPartyEventEmitterContext {
  contextCorrelationId: string
  verifierId: string
}

@injectable()
export class OpenId4VcRelyingPartyEventHandler {
  public readonly nativeEventEmitter: NativeEventEmitter

  public constructor(
    @inject(InjectionSymbols.AgentContextProvider) private agentContextProvider: AgentContextProvider,
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies
  ) {
    this.nativeEventEmitter = new agentDependencies.EventEmitterClass()

    this.nativeEventEmitter.on(
      AuthorizationEvents.ON_AUTH_REQUEST_CREATED_SUCCESS,
      this.authorizationRequestCreatedSuccess
    )

    // We don't want to do anything currently when a request creation failed, as then the method that
    // is called to create it will throw and we won't create a session
    // AuthorizationEvents.ON_AUTH_REQUEST_CREATED_FAILED,

    this.nativeEventEmitter.on(AuthorizationEvents.ON_AUTH_REQUEST_SENT_SUCCESS, this.onAuthorizationRequestSentSuccess)

    // We manually call when the request is retrieved, and there's not really a case where it can fail, and
    // not really sure how to represent it in the verification session. So not doing anything here.
    // AuthorizationEvents.ON_AUTH_REQUEST_SENT_FAILED

    // NOTE: the response received and response verified states are fired in such rapid succession
    // that the verification session record is not updated yet to received before the verified event is
    // emitted. For now we only track the verified / failed event. Otherwise we need to use record locking, which we don't have in-place yet
    // AuthorizationEvents.ON_AUTH_RESPONSE_RECEIVED_SUCCESS,

    this.nativeEventEmitter.on(
      AuthorizationEvents.ON_AUTH_RESPONSE_RECEIVED_FAILED,
      this.authorizationResponseReceivedFailed
    )

    this.nativeEventEmitter.on(
      AuthorizationEvents.ON_AUTH_RESPONSE_VERIFIED_SUCCESS,
      this.authorizationResponseVerifiedSuccess
    )
    this.nativeEventEmitter.on(
      AuthorizationEvents.ON_AUTH_RESPONSE_VERIFIED_FAILED,
      this.authorizationResponseVerifiedFailed
    )
  }

  public getEventEmitterForVerifier(contextCorrelationId: string, verifierId: string) {
    return new OpenId4VcRelyingPartyEventEmitter(this.nativeEventEmitter, contextCorrelationId, verifierId)
  }

  public authorizationRequestCreatedSuccess = async (
    agentContext: AgentContext,
    options: {
      verifierId: string
      correlationId: string
      authorizationRequestJwt?: string
      authorizationRequestUri?: string
    }
  ) => {
    const { verifierId, correlationId, authorizationRequestJwt, authorizationRequestUri } = options

    if (!authorizationRequestJwt) {
      throw new CredoError('Authorization request object JWT is missing')
    }

    if (!authorizationRequestUri) {
      throw new CredoError('Authorization request URI is missing')
    }

    const verificationSession = new OpenId4VcVerificationSessionRecord({
      id: correlationId,
      authorizationRequestJwt,
      authorizationRequestUri,
      state: OpenId4VcVerificationSessionState.RequestCreated,
      verifierId: verifierId,
    })

    await this.withSession(agentContext.contextCorrelationId, async (agentContext, verificationSessionRepository) => {
      await verificationSessionRepository.save(agentContext, verificationSession)
      this.emitStateChangedEvent(agentContext, verificationSession, null)
    })

    return verificationSession
  }

  private onAuthorizationRequestSentSuccess = async (
    event: AuthorizationEvent<AuthorizationRequest>,
    context: RelyingPartyEventEmitterContext
  ): Promise<void> => {
    await this.withSession(context.contextCorrelationId, async (agentContext, verificationSessionRepository) => {
      const verificationSession = await verificationSessionRepository.getById(agentContext, event.correlationId)

      // In all other cases it doesn't make sense to update the state, as the state is already advanced beyond
      // this state.
      if (verificationSession.state === OpenId4VcVerificationSessionState.RequestCreated) {
        verificationSession.state = OpenId4VcVerificationSessionState.RequestUriRetrieved
        await verificationSessionRepository.update(agentContext, verificationSession)
        this.emitStateChangedEvent(agentContext, verificationSession, OpenId4VcVerificationSessionState.RequestCreated)
      }
    })
  }

  public authorizationResponseReceivedFailed = async (
    agentContext: AgentContext,
    options: {
      verifierId: string
      correlationId: string
      authorizationResponsePayload: Openid4vpAuthorizationResponse
      errorMessage: string
    }
  ): Promise<void> => {
    await this.withSession(agentContext.contextCorrelationId, async (agentContext, verificationSessionRepository) => {
      const verificationSession = await verificationSessionRepository.getById(agentContext, options.correlationId)

      const previousState = verificationSession.state
      verificationSession.state = OpenId4VcVerificationSessionState.Error
      verificationSession.authorizationResponsePayload = options.authorizationResponsePayload
      verificationSession.errorMessage = options.errorMessage
      await verificationSessionRepository.update(agentContext, verificationSession)
      this.emitStateChangedEvent(agentContext, verificationSession, previousState)
    })
  }

  public authorizationResponseVerifiedSuccess = async (
    agentContext: AgentContext,
    options: {
      verifierId: string
      correlationId: string
      authorizationResponsePayload: Openid4vpAuthorizationResponse | Openid4vpAuthorizationResponseDcApi
    }
  ): Promise<void> => {
    await this.withSession(agentContext.contextCorrelationId, async (agentContext, verificationSessionRepository) => {
      const verificationSession = await verificationSessionRepository.getById(agentContext, options.correlationId)

      if (
        verificationSession.state !== OpenId4VcVerificationSessionState.Error &&
        verificationSession.state !== OpenId4VcVerificationSessionState.ResponseVerified
      ) {
        const previousState = verificationSession.state
        verificationSession.authorizationResponsePayload = isOpenid4vpAuthorizationResponseDcApi(options.authorizationResponsePayload) ? options.authorizationResponsePayload.data : options.authorizationResponsePayload
        verificationSession.state = OpenId4VcVerificationSessionState.ResponseVerified
        await verificationSessionRepository.update(agentContext, verificationSession)
        this.emitStateChangedEvent(agentContext, verificationSession, previousState)
      }
    })
  }

  public authorizationResponseVerifiedFailed = async (
    agentContext: AgentContext,
    options: {
      verifierId: string
      correlationId: string
      errorMessage: string
    }
  ): Promise<void> => {
    await this.withSession(agentContext.contextCorrelationId, async (agentContext, verificationSessionRepository) => {
      const verificationSession = await verificationSessionRepository.getById(agentContext, options.correlationId)

      const previousState = verificationSession.state
      verificationSession.state = OpenId4VcVerificationSessionState.Error
      verificationSession.errorMessage = options.errorMessage
      await verificationSessionRepository.update(agentContext, verificationSession)
      this.emitStateChangedEvent(agentContext, verificationSession, previousState)
    })
  }

  private async withSession<T>(
    contextCorrelationId: string,
    callback: (agentContext: AgentContext, verificationSessionRepository: OpenId4VcVerificationSessionRepository) => T
  ): Promise<T> {
    const agentContext = await this.agentContextProvider.getAgentContextForContextCorrelationId(contextCorrelationId)

    try {
      const verificationSessionRepository = agentContext.dependencyManager.resolve(
        OpenId4VcVerificationSessionRepository
      )
      const result = await callback(agentContext, verificationSessionRepository)
      return result
    } finally {
      await agentContext.endSession()
    }
  }

  protected emitStateChangedEvent(
    agentContext: AgentContext,
    verificationSession: OpenId4VcVerificationSessionRecord,
    previousState: OpenId4VcVerificationSessionState | null
  ) {
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)

    eventEmitter.emit<OpenId4VcVerificationSessionStateChangedEvent>(agentContext, {
      type: OpenId4VcVerifierEvents.VerificationSessionStateChanged,
      payload: {
        verificationSession: verificationSession.clone(),
        previousState,
      },
    })
  }
}

/**
 * Custom implementation of the event emitter so we can associate the contextCorrelationId
 * and the verifierId with the events that are emitted. This allows us to only create one
 * event emitter and thus not have endless event emitters and listeners for each active RP.
 *
 * We only modify the emit method, and add the verifierId and contextCorrelationId to the event
 * this allows the listener to know which tenant and which verifier the event is associated with.
 */
class OpenId4VcRelyingPartyEventEmitter implements NativeEventEmitter {
  public constructor(
    private nativeEventEmitter: NativeEventEmitter,
    private contextCorrelationId: string,
    private verifierId: string
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public emit(eventName: string | symbol, ...args: any[]): boolean {
    return this.nativeEventEmitter.emit(eventName, ...args, {
      contextCorrelationId: this.contextCorrelationId,
      verifierId: this.verifierId,
    } satisfies RelyingPartyEventEmitterContext)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public [NativeEventEmitter.captureRejectionSymbol]?(error: Error, event: string, ...args: any[]): void {
    return this.nativeEventEmitter[NativeEventEmitter.captureRejectionSymbol]?.(error, event, ...args)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public addListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.nativeEventEmitter.addListener(eventName, listener)
    return this
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.nativeEventEmitter.on(eventName, listener)
    return this
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public once(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.nativeEventEmitter.once(eventName, listener)
    return this
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public removeListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.nativeEventEmitter.removeListener(eventName, listener)
    return this
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public off(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.nativeEventEmitter.off(eventName, listener)
    return this
  }

  public removeAllListeners(event?: string | symbol | undefined): this {
    this.nativeEventEmitter.removeAllListeners(event)
    return this
  }

  public setMaxListeners(n: number): this {
    this.nativeEventEmitter.setMaxListeners(n)
    return this
  }

  public getMaxListeners(): number {
    return this.nativeEventEmitter.getMaxListeners()
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  public listeners(eventName: string | symbol): Function[] {
    return this.nativeEventEmitter.listeners(eventName)
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  public rawListeners(eventName: string | symbol): Function[] {
    return this.nativeEventEmitter.rawListeners(eventName)
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  public listenerCount(eventName: string | symbol, listener?: Function | undefined): number {
    return this.nativeEventEmitter.listenerCount(eventName, listener)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public prependListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.nativeEventEmitter.prependListener(eventName, listener)
    return this
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public prependOnceListener(eventName: string | symbol, listener: (...args: any[]) => void): this {
    this.nativeEventEmitter.prependOnceListener(eventName, listener)
    return this
  }

  public eventNames(): (string | symbol)[] {
    return this.nativeEventEmitter.eventNames()
  }
}
