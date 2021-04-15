/**
 * Connection states as defined in RFC XXXX - TODO - add this to the RFC
 *
 * State 'null' from RFC is changed to 'init'
 *
 * @see TODO - Add URL to RFC
 */
export enum MediationState {
  Init = 'init',
  Invited = 'invited',
  Requested = 'requested',
  Responded = 'responded',
  Complete = 'complete',
}
