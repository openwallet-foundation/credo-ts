import type { CredentialConfigurationsSupported } from '@openid4vc/openid4vci'
import type {
  OpenId4VciCredentialConfigurationsSupported,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
} from './models'

/**
 * Returns all entries from the credential offer with the associated metadata resolved.
 */
export function getOfferedCredentials<
  Configurations extends
    | OpenId4VciCredentialConfigurationsSupported
    | OpenId4VciCredentialConfigurationsSupportedWithFormats,
>(
  offeredCredentialConfigurationIds: Array<string>,
  credentialConfigurationsSupported: Configurations,
  { ignoreNotFoundIds = false }: { ignoreNotFoundIds?: boolean } = {}
): Configurations extends OpenId4VciCredentialConfigurationsSupportedWithFormats
  ? OpenId4VciCredentialConfigurationsSupportedWithFormats
  : OpenId4VciCredentialConfigurationsSupported {
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

  return offeredCredentialConfigurations as Configurations extends OpenId4VciCredentialConfigurationsSupportedWithFormats
    ? OpenId4VciCredentialConfigurationsSupportedWithFormats
    : OpenId4VciCredentialConfigurationsSupported
}

export function getScopesFromCredentialConfigurationsSupported(
  credentialConfigurationsSupported: CredentialConfigurationsSupported
): string[] {
  return Array.from(
    new Set(
      Object.values(credentialConfigurationsSupported)
        .map((configuration) => configuration.scope)
        .filter((scope): scope is string => scope !== undefined)
    )
  )
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
): CredentialConfigurationsSupported {
  return Object.fromEntries(
    Object.entries(credentialConfigurationsSupported).filter(
      ([, configuration]) => configuration.scope && scopes.includes(configuration.scope)
    )
  )
}
