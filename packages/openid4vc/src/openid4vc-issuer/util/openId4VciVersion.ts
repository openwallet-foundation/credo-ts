import type { OpenId4VciVersion } from '../OpenId4VcIssuerServiceOptions'
import type { OpenId4VcIssuanceSessionRecord } from '../repository'

/**
 * Older sessions have no version. Requests use `credential_configuration_id` from draft 15 on, and without a
 * request such a session counts as draft 11 to 14.
 */
export function getOpenId4VciVersion(
  issuanceSession: Pick<OpenId4VcIssuanceSessionRecord, 'openId4VciVersion'>,
  credentialRequest?: { credentialConfigurationId?: string }
): OpenId4VciVersion {
  return issuanceSession.openId4VciVersion ?? (credentialRequest?.credentialConfigurationId ? 'v1' : 'v1.draft11-14')
}
