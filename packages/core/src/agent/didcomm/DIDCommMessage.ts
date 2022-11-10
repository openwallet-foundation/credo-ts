import type { ServiceDecorator } from '../../decorators/service/ServiceDecorator'
import type { ReturnRouteTypes, TransportDecorator } from '../../decorators/transport/TransportDecorator'
import type { DIDCommMessageVersion } from './types'

export interface DIDCommMessage {
  readonly type: string
  readonly transport?: TransportDecorator | undefined

  get version(): DIDCommMessageVersion
  get id(): string
  get threadId(): string | undefined
  get sender(): string | undefined

  serviceDecorator(): ServiceDecorator | undefined

  toJSON(params?: { useLegacyDidSovPrefix?: boolean }): Record<string, unknown>

  hasAnyReturnRoute(): boolean

  hasReturnRouting(threadId?: string): boolean

  setReturnRouting(type: ReturnRouteTypes, thread?: string): void

  setThread(options: { threadId: string | undefined }): void
}
