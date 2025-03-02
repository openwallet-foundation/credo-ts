// This file polyfills the allSettled method introduced in ESNext

export type AllSettledFulfilled<T> = {
  status: 'fulfilled'
  value: T
}

export type AllSettledRejected = {
  status: 'rejected'
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  reason: any
}

export function allSettled<T>(promises: Promise<T>[]) {
  return Promise.all(
    promises.map((p) =>
      p
        .then(
          (value) =>
            ({
              status: 'fulfilled',
              value,
            }) as AllSettledFulfilled<T>
        )
        .catch(
          (reason) =>
            ({
              status: 'rejected',
              reason,
            }) as AllSettledRejected
        )
    )
  )
}

export function onlyFulfilled<T>(entries: Array<AllSettledFulfilled<T> | AllSettledRejected>) {
  // We filter for only the rejected values, so we can safely cast the type
  return entries.filter((e) => e.status === 'fulfilled') as AllSettledFulfilled<T>[]
}

export function onlyRejected<T>(entries: Array<AllSettledFulfilled<T> | AllSettledRejected>) {
  // We filter for only the rejected values, so we can safely cast the type
  return entries.filter((e) => e.status === 'rejected') as AllSettledRejected[]
}
