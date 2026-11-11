import type { BaseEvent } from '@credo-ts/core'
import type { OpenId4VcIssuanceSessionState } from './OpenId4VcIssuanceSessionState'
import type { OpenId4VcIssuanceSessionNotification, OpenId4VcIssuanceSessionRecord } from './repository'

export enum OpenId4VcIssuerEvents {
  IssuanceSessionStateChanged = 'OpenId4VcIssuer.IssuanceSessionStateChanged',
  IssuanceSessionNotificationReceived = 'OpenId4VcIssuer.IssuanceSessionNotificationReceived',
}

export interface OpenId4VcIssuanceSessionStateChangedEvent extends BaseEvent {
  type: typeof OpenId4VcIssuerEvents.IssuanceSessionStateChanged
  payload: {
    issuanceSession: OpenId4VcIssuanceSessionRecord
    previousState: OpenId4VcIssuanceSessionState | null
  }
}

export interface OpenId4VcIssuanceSessionNotificationReceivedEvent extends BaseEvent {
  type: typeof OpenId4VcIssuerEvents.IssuanceSessionNotificationReceived
  payload: {
    issuanceSession: OpenId4VcIssuanceSessionRecord
    notification: OpenId4VcIssuanceSessionNotification
  }
}
