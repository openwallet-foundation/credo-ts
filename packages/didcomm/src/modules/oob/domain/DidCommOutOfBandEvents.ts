import type { BaseEvent } from '@credo-ts/core'
import type { DidCommConnectionRecord } from '../../connections'
import type { DidCommOutOfBandRecord } from '../repository'
import type { DidCommOutOfBandState } from './DidCommOutOfBandState'

export enum DidCommOutOfBandEventTypes {
  OutOfBandStateChanged = 'DidCommOutOfBandStateChanged',
  HandshakeReused = 'DidCommHandshakeReused',
}

export interface OutOfBandStateChangedEvent extends BaseEvent {
  type: typeof DidCommOutOfBandEventTypes.OutOfBandStateChanged
  payload: {
    outOfBandRecord: DidCommOutOfBandRecord
    previousState: DidCommOutOfBandState | null
  }
}

export interface HandshakeReusedEvent extends BaseEvent {
  type: typeof DidCommOutOfBandEventTypes.HandshakeReused
  payload: {
    // We need the thread id (can be multiple reuse happening at the same time)
    reuseThreadId: string
    outOfBandRecord: DidCommOutOfBandRecord
    connectionRecord: DidCommConnectionRecord
  }
}
