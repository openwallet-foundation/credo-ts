import { ConnectionRecord, ConnectionState } from '.'

export interface ConnectionStateChangedEvent {
  type: 'ConnectionStateChanged'
  connectionRecord: ConnectionRecord
  previousState: ConnectionState | null
}
