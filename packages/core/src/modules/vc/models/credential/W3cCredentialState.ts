/**
 * Issue Credential states as defined in RFC 0453
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0453-issue-credential-v2/README.md#states
 */
export enum W3cCredentialState {
  ProposalSent = 'proposal-sent',
  ProposalReceived = 'proposal-received',
  OfferSent = 'offer-sent',
  OfferReceived = 'offer-received',
  RequestSent = 'request-sent',
  RequestReceived = 'request-received',
  CredentialIssued = 'credential-issued',
  CredentialReceived = 'credential-received',
  Done = 'done',
}
