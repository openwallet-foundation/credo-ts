import type { ServiceDecorator } from '../../decorators/service/ServiceDecorator'
import type { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'

export enum DIDCommVersion {
  V1 = 'DIDCommV1',
  V2 = 'DIDCommV2',
}

export interface DIDCommMessage {
  readonly type: string

  get version(): DIDCommVersion
  get id(): string
  get threadId(): string | undefined

  serviceDecorator(): ServiceDecorator | undefined

  toJSON(params?: { useLegacyDidSovPrefix?: boolean }): Record<string, unknown>

  hasAnyReturnRoute(): boolean

  hasReturnRouting(threadId?: string): boolean

  setReturnRouting(type: ReturnRouteTypes, thread?: string): void

  setThread(options: { threadId: string | undefined }): void
}
