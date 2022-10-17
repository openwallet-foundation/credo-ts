import { retryBackoff } from 'backoff-rxjs'
import {
  delayWhen,
  interval,
  map,
  merge,
  Observable,
  of,
  retry,
  sampleTime,
  startWith,
  Subject,
  switchMap,
  take,
  tap,
  throttle,
  throttleTime,
} from 'rxjs'
import { filter, takeUntil } from 'rxjs/operators'

import { LogContexts, OutboundWebSocketClosedEvent, TransportEventTypes } from '@aries-framework/core'

describe('rxjs', () => {
  test('case', async () => {
    const stop$ = new Subject()

    let iteration = 0
    const serviceCall = async () => {
      iteration++
      switch (iteration) {
        case 1:
          console.log('Service err')
          throw new Error('test async error')
        case 2:
          console.log('Service err')
          throw new Error('test async error')
        default:
          iteration = 0
          return 'success'
      }
    }
    // eslint-disable-next-line no-console
    console.log('Start')

    // merge(interval(200), interval(300))
    // merge(of([1]))
    //   .pipe(
    //     takeUntil(stop$),
    //     throttleTime(1000),
    //     tap(() => {
    //       // eslint-disable-next-line no-console
    //       console.log('pipe ticked')
    //     }),
    //     switchMap(() => serviceCall()),
    //     // eslint-disable-next-line no-console
    //     tap((value) => console.log('Got value', value)),
    //     retryBackoff({ initialInterval: 5000, maxInterval: 10000 })
    //   )
    //   .subscribe()

    merge(
      of({ mediatorDid: 'testDid' })
      // interval(300).pipe(
      //   take(2),
      //   map(() => ({ mediatorDid: 'testDid' }))
      // )
    )
      .pipe(
        // Stop when the agent shuts down
        filter(({ mediatorDid }) => mediatorDid === 'testDid'),
        //Start immediately
        startWith(),
        // Make sure we're not reconnecting multiple times
        throttleTime(1000),
        switchMap(async () => {
          // eslint-disable-next-line no-console
          console.log('Switch map')
          return await serviceCall()
          // throw new Error('Test error DV in AFJ source and build2222')
        }),
        retry(Infinity)
        // retryBackoff({
        //   initialInterval: 5000,
        //   maxInterval: 10000,
        //   resetOnSuccess: true,
        //   maxRetries: Infinity,
        //   shouldRetry: (error) => {
        //     // eslint-disable-next-line no-console
        //     console.info('Mediator connect error is. Retrying...', error)
        //     return true
        //   },
        // })
      )
      .subscribe()

    let myResolve: any
    const promise = new Promise((resolve, reject) => {
      myResolve = resolve
    })

    setTimeout(() => {
      stop$.next(null)
      myResolve()
    }, 30000)

    await promise
  })
})
