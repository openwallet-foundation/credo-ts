import type { BaseEvent } from '@credo-ts/core'
import type { DidCommDidExchangeState } from './models'
import type { DidCommConnectionRecord } from './repository'

export enum DidCommConnectionEventTypes {
  DidCommConnectionStateChanged = 'ConnectionStateChanged',
  DidCommConnectionDidRotated = 'ConnectionDidRotated',
}

export interface DidCommConnectionStateChangedEvent extends BaseEvent {
  type: typeof DidCommConnectionEventTypes.DidCommConnectionStateChanged
  payload: {
    connectionRecord: DidCommConnectionRecord
    previousState: DidCommDidExchangeState | null
  }
}

export interface DidCommConnectionDidRotatedEvent extends BaseEvent {
  type: typeof DidCommConnectionEventTypes.DidCommConnectionDidRotated
  payload: {
    connectionRecord: DidCommConnectionRecord

    ourDid?: {
      from: string
      to: string
    }
    theirDid?: {
      from: string
      to: string
    }
  }
}
