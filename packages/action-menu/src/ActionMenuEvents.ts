import type { ActionMenuState } from './ActionMenuState'
import type { ActionMenuRecord } from './repository'
import type { BaseEvent } from '@aries-framework/core'

export enum ActionMenuEventTypes {
  ActionMenuStateChanged = 'ActionMenuStateChanged',
}
export interface ActionMenuStateChangedEvent extends BaseEvent {
  type: typeof ActionMenuEventTypes.ActionMenuStateChanged
  payload: {
    actionMenuRecord: ActionMenuRecord
    previousState: ActionMenuState | null
  }
}
