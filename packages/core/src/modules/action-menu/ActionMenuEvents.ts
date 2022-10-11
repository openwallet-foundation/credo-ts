import type { BaseEvent } from '../../agent/Events'
import type { ActionMenuState } from './ActionMenuState'
import type { ActionMenuRecord } from './repository'

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
