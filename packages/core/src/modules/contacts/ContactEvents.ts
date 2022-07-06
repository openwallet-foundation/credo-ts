import type { BaseEvent } from '../../agent/Events'
import { ContactRecord } from './repository'

export enum ContactEventTypes {
  ContactAdded = 'ContactAdded',
}
export interface ContactAddedEvent extends BaseEvent {
  type: typeof ContactEventTypes.ContactAdded
  payload: {
    record: ContactRecord
  }
}
