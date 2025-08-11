export enum OpenId4VcIssuanceSessionState {
  OfferCreated = 'OfferCreated',
  OfferUriRetrieved = 'OfferUriRetrieved',

  // Used with authorization code flow where Credo is the auth server
  AuthorizationInitiated = 'AuthorizationInitiated',
  AuthorizationGranted = 'AuthorizationGranted',

  // Used with pre-auth and auth code flow where Credo is the auth server
  AccessTokenRequested = 'AccessTokenRequested',
  AccessTokenCreated = 'AccessTokenCreated',

  CredentialRequestReceived = 'CredentialRequestReceived',
  CredentialsPartiallyIssued = 'CredentialsPartiallyIssued',
  Completed = 'Completed',
  Error = 'Error',
}
