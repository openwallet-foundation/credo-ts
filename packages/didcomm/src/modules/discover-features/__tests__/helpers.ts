import type { Observable } from 'rxjs'
import type {
  DidCommDiscoverFeaturesDisclosureReceivedEvent,
  DidCommDiscoverFeaturesQueryReceivedEvent,
} from '../DidCommDiscoverFeaturesEvents'

import { ReplaySubject, catchError, firstValueFrom, map, timeout } from 'rxjs'

export function waitForDisclosureSubject(
  subject:
    | ReplaySubject<DidCommDiscoverFeaturesDisclosureReceivedEvent>
    | Observable<DidCommDiscoverFeaturesDisclosureReceivedEvent>,
  { timeoutMs = 10000 }: { timeoutMs: number }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject

  return firstValueFrom(
    observable.pipe(
      timeout(timeoutMs),
      catchError(() => {
        throw new Error('DiscoverFeaturesDisclosureReceivedEvent event not emitted within specified timeout')
      }),
      map((e) => e.payload)
    )
  )
}

export function waitForQuerySubject(
  subject:
    | ReplaySubject<DidCommDiscoverFeaturesQueryReceivedEvent>
    | Observable<DidCommDiscoverFeaturesQueryReceivedEvent>,
  { timeoutMs = 10000 }: { timeoutMs: number }
) {
  const observable = subject instanceof ReplaySubject ? subject.asObservable() : subject

  return firstValueFrom(
    observable.pipe(
      timeout(timeoutMs),
      catchError(() => {
        throw new Error('DiscoverFeaturesQueryReceivedEvent event not emitted within specified timeout')
      }),
      map((e) => e.payload)
    )
  )
}
