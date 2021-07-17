/**
 * Connection states as defined in RFC 0160.
 *
 * State 'null' from RFC is changed to 'init'
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0160-connection-protocol/README.md#states
 */
export enum ConnectionState {
  Invited = 'invited',
  Requested = 'requested',
  Responded = 'responded',
  Complete = 'complete',
}
