import { type Anoncreds, NativeAnoncreds, ObjectHandle } from '@hyperledger/anoncreds-shared'

/**
 * Wraps the registered native AnonCreds to keep track of the native objects that are created and not freed yet, so a
 * test can check that Credo frees every object it creates. A method creates an object when it returns an
 * `ObjectHandle`, or an object of them (e.g. `createCredentialDefinition`)
 */
export const trackNativeAnonCredsObjects = () => {
  // The creating method of each open object, by its handle
  const open = new Map<number, string>()
  const native = NativeAnoncreds.instance

  const track = (method: string, result: unknown) => {
    if (result instanceof ObjectHandle) {
      open.set(result.handle, method)
    } else if (result && typeof result === 'object') {
      for (const value of Object.values(result)) {
        if (value instanceof ObjectHandle) open.set(value.handle, method)
      }
    }
  }

  NativeAnoncreds.register(
    new Proxy(native, {
      get(target, property: keyof Anoncreds) {
        const value = target[property]
        if (typeof value !== 'function') return value

        return (options: unknown) => {
          if (property === 'objectFree') open.delete((options as { objectHandle: ObjectHandle }).objectHandle.handle)

          const result = (value as (options: unknown) => unknown).call(target, options)
          track(property, result)
          return result
        }
      },
    })
  )

  return {
    /**
     * The creating methods of the objects that are still open, and forgets them
     */
    takeOpen: () => {
      const methods = [...open.values()].sort()
      open.clear()
      return methods
    },
    /**
     * Registers the native AnonCreds without tracking again
     */
    stop: () => NativeAnoncreds.register(native),
  }
}
