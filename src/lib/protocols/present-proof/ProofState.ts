/**
 * Present Proof protocol states as defined in RFC 0037
 *
 * @see https://github.com/hyperledger/aries-rfcs/tree/master/features/0037-present-proof#states
 */
export enum ProofState {
  RequestSent = 'request-sent',
  RequestReceived = 'request-received',
  ProposalSent = 'proposal-sent',
  ProposalReceived = 'proposal-received',
  PresentationSent = 'presentation-sent',
  PresentationReceived = 'presentation-received',
  RejectSent = 'reject-sent',
  Done = 'done',
}
