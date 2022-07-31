import type { ActionMenuRole } from './ActionMenuRole'
import type { ActionMenu } from './models/ActionMenu'
import type { ActionMenuSelection } from './models/ActionMenuSelection'

export interface FindActiveMenuOptions {
  connectionId: string
  role: ActionMenuRole
}

export interface ClearActiveMenuOptions {
  connectionId: string
  role: ActionMenuRole
}

export interface RequestMenuOptions {
  connectionId: string
}

export interface SendMenuOptions {
  connectionId: string
  menu: ActionMenu
}

export interface PerformActionOptions {
  connectionId: string
  performedAction: ActionMenuSelection
}
