import type { BaseEvent } from '../../agent/Events'
import { ContactRecord } from './repository'

export enum ContactEventTypes {
  ContactStateChanged = 'ContactStateChanged',
}
export interface ContactStateChangedEvent extends BaseEvent {
  type: typeof ContactEventTypes.ContactStateChanged
  payload: {
    record: ContactRecord
  }
}
