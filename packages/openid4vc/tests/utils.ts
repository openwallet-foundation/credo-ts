import type { AgentContext, BaseEvent, InitConfig, ModulesMap, X509Module } from '@credo-ts/core'
import { Agent, getDomainFromUrl, JsonTransformer, LogLevel } from '@credo-ts/core'
import type { TenantsModule } from '@credo-ts/tenants'
import type { Observable } from 'rxjs'
import { catchError, filter, lastValueFrom, map, ReplaySubject, take, timeout } from 'rxjs'
import {
  agentDependencies,
  createDidKidVerificationMethod,
  createX509Certificate,
  setupEventReplaySubjects,
  TestLogger,
} from '../../core/tests'
import type {
  OpenId4VcIssuanceSessionState,
  OpenId4VcIssuanceSessionStateChangedEvent,
  OpenId4VcUpdateIssuanceSessionWithLockOptions,
  OpenId4VcVerificationSessionState,
  OpenId4VcVerificationSessionStateChangedEvent,
} from '../src'
import {
  OpenId4VcIssuanceSessionRecord,
  OpenId4VcIssuanceSessionRepository,
  OpenId4VcIssuerEvents,
  OpenId4VcIssuerService,
  OpenId4VcModule,
  OpenId4VcVerifierEvents,
} from '../src'

export async function createAgentFromModules<MM extends ModulesMap>(
  modulesMap: MM,
  secretKey?: string,
  customFetch?: typeof global.fetch,
  config?: InitConfig
) {
  const agent = new Agent<MM>({
    config: {
      allowInsecureHttpUrls: true,
      logger: new TestLogger(LogLevel.Off),
      ...config,
    },
    dependencies: {
      ...agentDependencies,
      fetch: customFetch ?? agentDependencies.fetch,
    },
    modules: modulesMap,
  })

  let dns = 'localhost'
  if (modulesMap.openid4vc instanceof OpenId4VcModule) {
    const baseUrl = modulesMap.openid4vc.issuer?.config.baseUrl ?? modulesMap.openid4vc.verifier?.config.baseUrl
    if (baseUrl) {
      dns = getDomainFromUrl(baseUrl)
    }
  }

  checkIssuanceSessionUpdates()

  await agent.initialize()
  const data = await createDidKidVerificationMethod(agent.context, secretKey)
  const certificate = await createX509Certificate(agent.context, dns, data.publicJwk)

  const [replaySubject] = setupEventReplaySubjects(
    [agent],
    [OpenId4VcIssuerEvents.IssuanceSessionStateChanged, OpenId4VcVerifierEvents.VerificationSessionStateChanged]
  )

  return {
    ...data,
    jwk: data.publicJwk,
    certificate: certificate.certificate,
    agent,
    replaySubject,
  }
}

export type AgentType<MM extends ModulesMap> = Awaited<ReturnType<typeof createAgentFromModules<MM>>>

/**
 * Fails the test when a locked issuance session update doesn't write a field that the request changed on its own copy
 * of the session, compared to the session as it was loaded. Catches a field that is set on the session but not copied
 * to the stored record in `updateIssuanceSessionWithLock`.
 */
export function checkIssuanceSessionUpdates() {
  if (vi.isMockFunction(OpenId4VcIssuerService.prototype.updateIssuanceSessionWithLock)) return

  const loadedSessions = new WeakMap<OpenId4VcIssuanceSessionRecord, Record<string, string>>()
  const rememberLoaded = (value: unknown) => {
    if (value instanceof OpenId4VcIssuanceSessionRecord) loadedSessions.set(value, flattenJson(value))
  }

  const repository = OpenId4VcIssuanceSessionRepository.prototype as unknown as Record<
    string,
    (...args: unknown[]) => Promise<unknown>
  >
  for (const method of ['getById', 'findById', 'findByQuery', 'findSingleByQuery', 'getSingleByQuery', 'save']) {
    const original = repository[method]
    vi.spyOn(repository, method).mockImplementation(async function (this: unknown, ...args: unknown[]) {
      const result = await original.apply(this, args)
      // `save` returns nothing, the saved record is its second argument
      for (const value of [result, args[1]].flat()) rememberLoaded(value)
      return result
    })
  }

  const updateIssuanceSessionWithLock = OpenId4VcIssuerService.prototype.updateIssuanceSessionWithLock
  vi.spyOn(OpenId4VcIssuerService.prototype, 'updateIssuanceSessionWithLock').mockImplementation(async function (
    this: OpenId4VcIssuerService,
    agentContext: AgentContext,
    issuanceSession: OpenId4VcIssuanceSessionRecord,
    options: OpenId4VcUpdateIssuanceSessionWithLockOptions
  ) {
    const result = await updateIssuanceSessionWithLock.call(this, agentContext, issuanceSession, options)
    if (!result) return result

    const loaded = loadedSessions.get(issuanceSession)
    const changed = flattenJson(issuanceSession)
    const written = flattenJson(result.issuanceSession)
    const notWritten = loaded
      ? [...new Set([...Object.keys(loaded), ...Object.keys(changed)])].filter(
          (path) => loaded[path] !== changed[path] && written[path] !== changed[path]
        )
      : ['the session was not loaded through the repository, so its changes are unknown']

    expect.soft(notWritten, `Changes to issuance session '${issuanceSession.id}' that were not written`).toEqual([])

    rememberLoaded(result.issuanceSession)
    return result
  })
}

function flattenJson(record: OpenId4VcIssuanceSessionRecord) {
  const paths: Record<string, string> = {}
  const flatten = (value: unknown, path: string) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) flatten(child, path ? `${path}.${key}` : key)
    } else {
      paths[path] = JSON.stringify(value)
    }
  }
  flatten(JsonTransformer.toJSON(record), '')
  return paths
}

// biome-ignore lint/suspicious/noExplicitAny: no explanation
type AgentWithTenantsModule = Agent<{ tenants: TenantsModule<any>; x509: X509Module }>

export async function createTenantForAgent(
  // FIXME: we need to make some improvements on the agent typing. It'a quite hard
  // to get it right at the moment
  // biome-ignore lint/suspicious/noExplicitAny: no explanation
  agent: AgentWithTenantsModule & any,
  label: string
) {
  const tenantRecord = await agent.modules.tenants.createTenant({
    config: {
      label,
    },
  })

  const tenant = await agent.modules.tenants.getTenantAgent({ tenantId: tenantRecord.id })
  const data = await createDidKidVerificationMethod(tenant)
  await tenant.endSession()

  return {
    ...data,
    tenantId: tenantRecord.id,
  }
}

export type TenantType = Awaited<ReturnType<typeof createTenantForAgent>>

export function waitForCredentialIssuanceSessionRecordSubject(
  subject: ReplaySubject<BaseEvent> | Observable<BaseEvent>,
  {
    state,
    previousState,
    timeoutMs = 10000,
    count = 1,
    contextCorrelationId,
    issuanceSessionId,
  }: {
    state?: OpenId4VcIssuanceSessionState
    previousState?: OpenId4VcIssuanceSessionState | null
    timeoutMs?: number
    count?: number
    contextCorrelationId?: string
    issuanceSessionId?: string
  }
) {
  const observable: Observable<BaseEvent> = subject instanceof ReplaySubject ? subject.asObservable() : subject
  return lastValueFrom(
    observable.pipe(
      filter((e) => contextCorrelationId === undefined || e.metadata.contextCorrelationId === contextCorrelationId),
      filter(
        (event): event is OpenId4VcIssuanceSessionStateChangedEvent =>
          event.type === OpenId4VcIssuerEvents.IssuanceSessionStateChanged
      ),
      filter((e) => previousState === undefined || e.payload.previousState === previousState),
      filter((e) => state === undefined || e.payload.issuanceSession.state === state),
      filter((e) => issuanceSessionId === undefined || e.payload.issuanceSession.id === issuanceSessionId),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(
          `OpenId4VcIssuanceSessionStateChangedEvent event not emitted within specified timeout: ${timeoutMs}
          contextCorrelationId: ${contextCorrelationId},
          issuanceSessionId: ${issuanceSessionId}
          previousState: ${previousState},
          state: ${state}
        }`
        )
      }),
      take(count),
      map((e) => e.payload.issuanceSession)
    )
  )
}

export function waitForVerificationSessionRecordSubject(
  subject: ReplaySubject<BaseEvent> | Observable<BaseEvent>,
  {
    state,
    previousState,
    timeoutMs = 10000,
    count = 1,
    contextCorrelationId,
    verificationSessionId,
  }: {
    state?: OpenId4VcVerificationSessionState
    previousState?: OpenId4VcVerificationSessionState | null
    timeoutMs?: number
    count?: number
    contextCorrelationId?: string
    verificationSessionId?: string
  }
) {
  const observable: Observable<BaseEvent> = subject instanceof ReplaySubject ? subject.asObservable() : subject
  return lastValueFrom(
    observable.pipe(
      filter((e) => contextCorrelationId === undefined || e.metadata.contextCorrelationId === contextCorrelationId),
      filter(
        (event): event is OpenId4VcVerificationSessionStateChangedEvent =>
          event.type === OpenId4VcVerifierEvents.VerificationSessionStateChanged
      ),
      filter((e) => previousState === undefined || e.payload.previousState === previousState),
      filter((e) => state === undefined || e.payload.verificationSession.state === state),
      filter((e) => verificationSessionId === undefined || e.payload.verificationSession.id === verificationSessionId),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(
          `OpenId4VcVerificationSessionStateChangedEvent event not emitted within specified timeout: ${timeoutMs}
          contextCorrelationId: ${contextCorrelationId},
          verificationSessionId: ${verificationSessionId}
          previousState: ${previousState},
          state: ${state}
        }`
        )
      }),
      take(count),
      map((e) => e.payload.verificationSession)
    )
  )
}
