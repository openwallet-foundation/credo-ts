import type { Agent } from '@credo-ts/core'
import type { Observable } from 'rxjs'
import { catchError, filter, firstValueFrom, map, ReplaySubject, timeout } from 'rxjs'
import type { DummyState } from '../dummy/repository'
import type { DummyStateChangedEvent } from '../dummy/services'

import { DummyEventTypes } from '../dummy/services'

export async function waitForDummyRecord(
  agent: Agent,
  options: {
    threadId?: string
    state?: DummyState
    previousState?: DummyState | null
    timeoutMs?: number
  }
) {
  const observable = agent.events.observable<DummyStateChangedEvent>(DummyEventTypes.StateChanged)

  return waitForDummyRecordSubject(observable, options)
}

export function waitForDummyRecordSubject(
  subject: ReplaySubject<DummyStateChangedEvent> | Observable<DummyStateChangedEvent>,
  {
    threadId,
    state,
    previousState,
    timeoutMs = 10000,
  }: {
    threadId?: string
    state?: DummyState
    previousState?: DummyState | null
    timeoutMs?: number
  }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject
  return firstValueFrom(
    observable.pipe(
      filter((e) => previousState === undefined || e.payload.previousState === previousState),
      filter((e) => threadId === undefined || e.payload.dummyRecord.threadId === threadId),
      filter((e) => state === undefined || e.payload.dummyRecord.state === state),
      timeout(timeoutMs),
      catchError(() => {
        throw new Error(
          `DummyStateChangedEvent event not emitted within specified timeout: {
    previousState: ${previousState},
    threadId: ${threadId},
    state: ${state}
  }`
        )
      }),
      map((e) => e.payload.dummyRecord)
    )
  )
}
