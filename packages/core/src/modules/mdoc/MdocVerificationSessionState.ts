export enum MdocVerificationSessionState {
  /**
   * A request has been created, but no response has been verified yet.
   */
  RequestCreated = 'RequestCreated',

  /**
   * A response was received, decrypted and verified.
   */
  ResponseVerified = 'ResponseVerified',

  /**
   * Verification of a received response failed.
   */
  Error = 'Error',
}
