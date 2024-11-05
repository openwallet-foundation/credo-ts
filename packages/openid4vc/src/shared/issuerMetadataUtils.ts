

import { OpenId4VciCredentialConfigurationsSupported } from './models'

/**
 * Returns all entries from the credential offer with the associated metadata resolved.
 */
export function getOfferedCredentials(
  offeredCredentialConfigurationIds: Array<string>,
  credentialConfigurationsSupported: OpenId4VciCredentialConfigurationsSupported
): OpenId4VciCredentialConfigurationsSupported {
  const offeredCredentialConfigurations: OpenId4VciCredentialConfigurationsSupported = {}

  for (const offeredCredentialConfigurationId of offeredCredentialConfigurationIds) {
    const foundCredentialConfiguration = credentialConfigurationsSupported[offeredCredentialConfigurationId]

    // Make sure the issuer metadata includes the offered credential.
    if (!foundCredentialConfiguration) {
      throw new Error(
        `Offered credential configuration id '${offeredCredentialConfigurationId}' is not part of credential_configurations_supported of the issuer metadata.`
      )
    }

    offeredCredentialConfigurations[offeredCredentialConfigurationId] = foundCredentialConfiguration
  }

  return offeredCredentialConfigurations
}
