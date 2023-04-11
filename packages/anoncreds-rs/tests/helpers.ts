import type { Agent, RevocationNotificationReceivedEvent } from '@aries-framework/core'
import type { Observable } from 'rxjs'

import { CredentialEventTypes } from '@aries-framework/core'
import { catchError, filter, firstValueFrom, map, ReplaySubject, timeout } from 'rxjs'

export async function waitForRevocationNotification(
  agent: Agent,
  options: {
    threadId?: string
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<RevocationNotificationReceivedEvent>(
    CredentialEventTypes.RevocationNotificationReceived
  )

  return waitForRevocationNotificationSubject(observable, options)
}

export function waitForRevocationNotificationSubject(
  subject: ReplaySubject<RevocationNotificationReceivedEvent> | Observable<RevocationNotificationReceivedEvent>,
  {
    threadId,
    timeoutMs = 10000,
  }: {
    threadId?: string
    timeoutMs?: number
  }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject
  return firstValueFrom(
    observable.pipe(
      filter((e) => threadId === undefined || e.payload.credentialRecord.threadId === threadId),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(
          `RevocationNotificationReceivedEvent event not emitted within specified timeout: {
    threadId: ${threadId},
  }`
        )
      }),
      map((e) => e.payload.credentialRecord)
    )
  )
}
