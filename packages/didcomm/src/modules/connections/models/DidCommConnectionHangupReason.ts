/** The `errorMessage` of a connection that is abandoned because one of the parties hung up. */
export enum DidCommConnectionHangupReason {
  ByUs = 'Connection hangup by us',
  ByOtherParty = 'Connection hangup by other party',
}
