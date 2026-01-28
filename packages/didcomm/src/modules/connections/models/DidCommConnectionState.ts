import { DidCommDidExchangeState } from './DidCommDidExchangeState'

/**
 * Connection states as defined in RFC 0160.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0160-connection-protocol/README.md#states
 */
export enum DidCommConnectionState {
  Null = 'null',
  Invited = 'invited',
  Requested = 'requested',
  Responded = 'responded',
  Complete = 'complete',
}

export function rfc0160StateFromDidExchangeState(didExchangeState: DidCommDidExchangeState) {
  const stateMapping = {
    [DidCommDidExchangeState.Start]: DidCommConnectionState.Null,
    [DidCommDidExchangeState.Abandoned]: DidCommConnectionState.Null,
    [DidCommDidExchangeState.InvitationReceived]: DidCommConnectionState.Invited,
    [DidCommDidExchangeState.InvitationSent]: DidCommConnectionState.Invited,
    [DidCommDidExchangeState.RequestReceived]: DidCommConnectionState.Requested,
    [DidCommDidExchangeState.RequestSent]: DidCommConnectionState.Requested,
    [DidCommDidExchangeState.ResponseReceived]: DidCommConnectionState.Responded,
    [DidCommDidExchangeState.ResponseSent]: DidCommConnectionState.Responded,
    [DidCommDidExchangeState.Completed]: DidCommConnectionState.Complete,
  }

  return stateMapping[didExchangeState]
}
