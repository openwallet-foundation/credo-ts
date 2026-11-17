import type { BaseEvent } from '../agent/Events'
import type { BaseRecord } from './BaseRecord'
import type { Query } from './StorageService'

export enum RepositoryEventTypes {
  RecordSaved = 'RecordSaved',
  RecordUpdated = 'RecordUpdated',
  RecordDeleted = 'RecordDeleted',
  RecordsDeletedByQuery = 'RecordsDeletedByQuery',
}

// biome-ignore lint/suspicious/noExplicitAny: no explanation
export interface RecordSavedEvent<T extends BaseRecord<any, any, any>> extends BaseEvent {
  type: typeof RepositoryEventTypes.RecordSaved
  payload: {
    record: T
  }
}

// biome-ignore lint/suspicious/noExplicitAny: no explanation
export interface RecordUpdatedEvent<T extends BaseRecord<any, any, any>> extends BaseEvent {
  type: typeof RepositoryEventTypes.RecordUpdated
  payload: {
    record: T
  }
}

// biome-ignore lint/suspicious/noExplicitAny: no explanation
export interface RecordDeletedEvent<T extends BaseRecord<any, any, any>> extends BaseEvent {
  type: typeof RepositoryEventTypes.RecordDeleted
  payload: {
    record: T | { id: string; type: string }
  }
}

/**
 * Emitted once by `Repository.deleteByQuery`, instead of a {@link RecordDeletedEvent} per deleted record.
 */
// biome-ignore lint/suspicious/noExplicitAny: no explanation
export interface RecordsDeletedByQueryEvent<T extends BaseRecord<any, any, any>> extends BaseEvent {
  type: typeof RepositoryEventTypes.RecordsDeletedByQuery
  payload: {
    recordType: string
    query: Query<T>
    count: number
  }
}
