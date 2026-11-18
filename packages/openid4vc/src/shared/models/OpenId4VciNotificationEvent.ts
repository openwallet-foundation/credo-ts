/**
 * 'credential_accepted' The Credential was successfully stored in the Wallet.
 * 'credential_deleted' when the unsuccessful Credential issuance was caused by a user action.
 * 'credential_failure' otherwise.
 */
export type OpenId4VciNotificationEvent = 'credential_accepted' | 'credential_failure' | 'credential_deleted'
