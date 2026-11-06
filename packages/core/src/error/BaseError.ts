/**
 * Copyright 2015 Blake Embrey
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * `SEPARATOR_TEXT` and `fullStack` come from <https://github.com/blakeembrey/make-error-cause>.
 *
 * Changes to the original code:
 * - Use inspect from `object-inspect` instead of the Node.js `util` module.
 * - Change the `inspect()` method signature.
 * - `BaseError` extends the native `Error` class instead of the `make-error` base class.
 */

import inspect from 'object-inspect'

/**
 * @internal
 */
export const SEPARATOR_TEXT = '\n\nThe following exception was the direct cause of the above exception:\n\n'

// `Error.captureStackTrace` is a V8 and Hermes extension. The core package does not use the Node.js types.
const ErrorWithCaptureStackTrace = Error as ErrorConstructor & {
  captureStackTrace?: (target: object, constructorOpt?: (...args: never) => unknown) => void
}

/**
 * Base class for errors with a `cause`.
 *
 * It is a native subclass of `Error`. Engines and test runners therefore treat an instance as an error
 * (`Error.isError`, `util.types.isNativeError`), and compare its `message` in deep equality checks.
 *
 * - `name` is the class name.
 * - `cause` is a non-enumerable, read-only property.
 * - `inspect()` returns the error and its full cause chain.
 */
export class BaseError extends Error {
  declare public readonly cause?: Error

  protected constructor(message?: string, cause?: Error) {
    super(message)

    // The class name, not 'Error'. `new.target` is not used, because the React Native Babel preset
    // lowers classes and does not rewrite it.
    Object.defineProperty(this, 'name', {
      value: this.constructor.name,
      writable: true,
      enumerable: false,
      configurable: true,
    })

    Object.defineProperty(this, 'cause', {
      value: cause,
      writable: false,
      enumerable: false,
      configurable: false,
    })

    // Remove the constructor frames from the stack on engines that support it
    ErrorWithCaptureStackTrace.captureStackTrace?.(this, this.constructor)
  }

  public inspect() {
    return fullStack(this)
  }
}

/**
 * Capture the full stack trace of any error instance.
 */
export function fullStack(error: Error | BaseError) {
  const chain: Error[] = []
  let cause: Error | undefined = error

  while (cause) {
    chain.push(cause)
    cause = (cause as BaseError).cause
  }

  return chain.map((err) => inspect(err, { customInspect: false })).join(SEPARATOR_TEXT)
}
