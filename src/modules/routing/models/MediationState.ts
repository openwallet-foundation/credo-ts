/**
 * Connection states as defined in RFC XXX.
 *
 * State 'null' from RFC is changed to 'init'
 *
 *
 */
export enum MediationState {
  Init = 'init',
  Invited = 'invited',
  Requested = 'requested',
  Responded = 'responded',
  Complete = 'complete',
}
