import type { SupportedRouterTypes } from './context'

export interface RouterFactory<RouterType extends SupportedRouterTypes> {
  create(): RouterType
}
