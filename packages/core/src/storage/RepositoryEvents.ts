import type { BaseRecord } from './BaseRecord'
import type { BaseEvent } from '../agent/Events'

export enum RepositoryEventTypes {
  RecordSaved = 'RecordSaved',
  RecordUpdated = 'RecordUpdated',
  RecordDeleted = 'RecordDeleted',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface RecordSavedEvent<T extends BaseRecord<any, any, any>> extends BaseEvent {
  type: typeof RepositoryEventTypes.RecordSaved
  payload: {
    record: T
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface RecordUpdatedEvent<T extends BaseRecord<any, any, any>> extends BaseEvent {
  type: typeof RepositoryEventTypes.RecordUpdated
  payload: {
    record: T
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface RecordDeletedEvent<T extends BaseRecord<any, any, any>> extends BaseEvent {
  type: typeof RepositoryEventTypes.RecordDeleted
  payload: {
    record: T | { id: string; type: string }
  }
}
