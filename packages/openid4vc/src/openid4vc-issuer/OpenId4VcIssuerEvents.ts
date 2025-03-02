import type { BaseEvent } from '@credo-ts/core'
import type { OpenId4VcIssuanceSessionState } from './OpenId4VcIssuanceSessionState'
import type { OpenId4VcIssuanceSessionRecord } from './repository'

export enum OpenId4VcIssuerEvents {
  IssuanceSessionStateChanged = 'OpenId4VcIssuer.IssuanceSessionStateChanged',
}

export interface OpenId4VcIssuanceSessionStateChangedEvent extends BaseEvent {
  type: typeof OpenId4VcIssuerEvents.IssuanceSessionStateChanged
  payload: {
    issuanceSession: OpenId4VcIssuanceSessionRecord
    previousState: OpenId4VcIssuanceSessionState | null
  }
}
