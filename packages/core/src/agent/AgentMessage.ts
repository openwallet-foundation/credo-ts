import type { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import type { DidCommMessageVersion } from '../didcomm/types'

export interface AgentMessage {
  readonly type: string

  get didCommVersion(): DidCommMessageVersion
  get id(): string
  get threadId(): string | undefined

  hasAnyReturnRoute(): boolean
  hasReturnRouting(threadId?: string): boolean
  setReturnRouting(type: ReturnRouteTypes, thread?: string): void

  toJSON(params?: { useLegacyDidSovPrefix?: boolean }): Record<string, unknown>
}
