import type { BaseEvent, ModulesMap, X509Module } from '@credo-ts/core'
import type { TenantsModule } from '@credo-ts/tenants'
import type { Observable } from 'rxjs'
import type {
  OpenId4VcIssuanceSessionState,
  OpenId4VcIssuanceSessionStateChangedEvent,
  OpenId4VcVerificationSessionState,
  OpenId4VcVerificationSessionStateChangedEvent,
} from '../src'

import { Agent, LogLevel, getDomainFromUrl } from '@credo-ts/core'
import { ReplaySubject, catchError, filter, lastValueFrom, map, take, timeout } from 'rxjs'

import {
  TestLogger,
  agentDependencies,
  createDidKidVerificationMethod,
  createX509Certificate,
  setupEventReplaySubjects,
} from '../../core/tests'
import { OpenId4VcIssuerEvents, OpenId4VcModule, OpenId4VcVerifierEvents } from '../src'

export async function createAgentFromModules<MM extends ModulesMap>(
  label: string,
  modulesMap: MM,
  secretKey?: string,
  customFetch?: typeof global.fetch
) {
  const agent = new Agent<MM>({
    config: {
      label,
      allowInsecureHttpUrls: true,
      logger: new TestLogger(LogLevel.off),
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

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type AgentWithTenantsModule = Agent<{ tenants: TenantsModule<any>; x509: X509Module }>

export async function createTenantForAgent(
  // FIXME: we need to make some improvements on the agent typing. It'a quite hard
  // to get it right at the moment
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
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
