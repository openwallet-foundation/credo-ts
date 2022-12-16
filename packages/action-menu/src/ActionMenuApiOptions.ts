import type { ActionMenuRole } from './ActionMenuRole'
import type { ActionMenu, ActionMenuSelection } from './models'

/**
 * @public
 */
export interface FindActiveMenuOptions {
  connectionId: string
  role: ActionMenuRole
}

/**
 * @public
 */
export interface ClearActiveMenuOptions {
  connectionId: string
  role: ActionMenuRole
}

/**
 * @public
 */
export interface RequestMenuOptions {
  connectionId: string
}

/**
 * @public
 */
export interface SendMenuOptions {
  connectionId: string
  menu: ActionMenu
}

/**
 * @public
 */
export interface PerformActionOptions {
  connectionId: string
  performedAction: ActionMenuSelection
}
