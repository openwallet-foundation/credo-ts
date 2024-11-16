import type { OpenId4VciCredentialConfigurationsSupported } from './models'
import type { CredentialConfigurationsSupported } from '@animo-id/oid4vci'

/**
 * Returns all entries from the credential offer with the associated metadata resolved.
 */
export function getOfferedCredentials(
  offeredCredentialConfigurationIds: Array<string>,
  credentialConfigurationsSupported: OpenId4VciCredentialConfigurationsSupported,
  { ignoreNotFoundIds = false }: { ignoreNotFoundIds?: boolean } = {}
): OpenId4VciCredentialConfigurationsSupported {
  const offeredCredentialConfigurations: OpenId4VciCredentialConfigurationsSupported = {}
  for (const offeredCredentialConfigurationId of offeredCredentialConfigurationIds) {
    const foundCredentialConfiguration = credentialConfigurationsSupported[offeredCredentialConfigurationId]

    // Make sure the issuer metadata includes the offered credential.
    if (!foundCredentialConfiguration) {
      if (!ignoreNotFoundIds) {
        throw new Error(
          `Offered credential configuration id '${offeredCredentialConfigurationId}' is not part of credential_configurations_supported of the issuer metadata.`
        )
      }

      continue
    }

    offeredCredentialConfigurations[offeredCredentialConfigurationId] = foundCredentialConfiguration
  }

  return offeredCredentialConfigurations
}

export function getScopesFromCredentialConfigurationsSupported(
  credentialConfigurationsSupported: CredentialConfigurationsSupported
): string[] {
  return Object.values(credentialConfigurationsSupported)
    .map((configuration) => configuration.scope)
    .filter((scope): scope is string => scope !== undefined)
}

export function getAllowedAndRequestedScopeValues(options: { requestedScope: string; allowedScopes: string[] }) {
  const requestedScopeValues = options.requestedScope.split(' ')
  const allowedAndRequestedScopeValues = options.allowedScopes.filter((allowedScope) =>
    requestedScopeValues.includes(allowedScope)
  )

  return allowedAndRequestedScopeValues
}

export function getCredentialConfigurationsSupportedForScopes(
  credentialConfigurationsSupported: CredentialConfigurationsSupported,
  scopes: string[]
) {
  return Object.fromEntries(
    Object.entries(credentialConfigurationsSupported).filter(
      ([, configuration]) => configuration.scope && scopes.includes(configuration.scope)
    )
  )
}
