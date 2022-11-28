import AsyncLock from 'async-lock'

/* eslint-disable @typescript-eslint/no-explicit-any */
const functionLock = new AsyncLock()

export function lockDecorator(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value
  if (typeof original == 'function') {
    descriptor.value = function (...args: any[]) {
      return functionLock.acquire(propertyKey, async () => {
        return await original.apply(this, args)
      })
    }
  }
  return descriptor
}
