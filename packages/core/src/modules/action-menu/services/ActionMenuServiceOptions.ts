import type { ConnectionRecord } from '../../connections'
import type { ActionMenuRole } from '../ActionMenuRole'
import type { ActionMenuSelection } from '../models'
import type { ActionMenu } from '../models/ActionMenu'
import type { ActionMenuRecord } from '../repository'

export interface CreateRequestOptions {
  connection: ConnectionRecord
}

export interface CreateMenuOptions {
  connection: ConnectionRecord
  menu: ActionMenu
}

export interface CreateMenuAsResponseOptions {
  actionMenuRecord: ActionMenuRecord
  menu: ActionMenu
}

export interface CreatePerformOptions {
  actionMenuRecord: ActionMenuRecord
  performedAction: ActionMenuSelection
}

export interface FindMenuOptions {
  connectionId: string
  role: ActionMenuRole
  threadId?: string
}
