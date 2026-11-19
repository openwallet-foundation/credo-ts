import { z } from 'zod'
import type { zBaseSchema } from '../../../utils/zod'
import type { KeyManagementService } from '../KeyManagementService'

/**
 * The names of the backends, which hints the registered backends and accepts backends that are registered later.
 */
export type KmsBackendName<Backends extends KeyManagementService[]> = Backends[number]['backend'] | (string & {})

/**
 * The `backendOptions` a backend accepts when creating a key: the type of `backendOptions` in the options of its
 * `createKey` method, or `never` when it doesn't declare any.
 */
export type KmsCreateKeyBackendOptionsOf<Service extends KeyManagementService> =
  'backendOptions' extends keyof Parameters<Service['createKey']>[1]
    ? NonNullable<Parameters<Service['createKey']>[1]['backendOptions']>
    : never

export const zWithBackend = <Schema extends zBaseSchema>(schema: Schema) =>
  schema.and(z.object({ backend: z.optional(z.string()) }))

export type WithBackend<T, Backends extends KeyManagementService[] = KeyManagementService[]> = T & {
  /**
   * The backend to use for creating the key. If not provided the
   * default backend for key operations will be used.
   */
  backend?: KmsBackendName<Backends>
}

/**
 * A key in the KMS and the backend that holds it. Records store keys in this shape.
 */
export interface KmsKeyReference {
  keyId: string
  kmsBackend?: string
}

/**
 * The result of an operation, with the backend that ran it. Pass the backend to the operations that follow on the
 * same key, so the key is not looked up again to find its backend.
 */
export type WithReturnedBackend<T, Backends extends KeyManagementService[] = KeyManagementService[]> = T & {
  backend: Backends[number]['backend']
}

export const zWithCreateKeyBackend = <Schema extends zBaseSchema>(schema: Schema) =>
  schema
    .and(z.object({ backend: z.optional(z.string()), backendOptions: z.optional(z.unknown()) }))
    .refine((options) => options.backendOptions === undefined || options.backend !== undefined, {
      message: "'backendOptions' can only be provided together with 'backend'",
      path: ['backendOptions'],
    })

export type WithCreateKeyBackend<T, Backends extends KeyManagementService[] = KeyManagementService[]> = T &
  (
    | {
        /**
         * The backend to use for creating the key. If not provided the
         * default backend for key operations will be used.
         */
        backend?: KmsBackendName<Backends>
        backendOptions?: never
      }
    | {
        [Service in Backends[number] as Service['backend']]: {
          backend: Service['backend']

          /**
           * Options for the key that are specific to the backend, declared by the backend in its `createKey`.
           */
          backendOptions?: KmsCreateKeyBackendOptionsOf<Service>
        }
      }[Backends[number]['backend']]
  )
