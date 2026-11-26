import { asArray, CredoError, type SingleOrArray } from '@credo-ts/core'
import type { CredentialConfigurationsSupported } from '@openid4vc/openid4vci'
import type {
  OpenId4VciCredentialConfigurationSupportedWithFormats,
  OpenId4VciCredentialConfigurationsSupported,
  OpenId4VciCredentialConfigurationsSupportedWithFormats,
} from './models'
import { OpenId4VciCredentialFormatProfile } from './models'

/**
 * Throws when the `type` of a W3C credential does not include each type of the `credential_definition` of the
 * credential configuration it is issued for (OpenID4VCI 1.0 Appendix A.1). Extra types are allowed.
 */
export function assertW3cCredentialTypeMatchesConfiguration(
  credentialType: SingleOrArray<string>,
  credentialConfiguration: OpenId4VciCredentialConfigurationSupportedWithFormats
) {
  const expectedType =
    credentialConfiguration.format === OpenId4VciCredentialFormatProfile.JwtVcJson ||
    credentialConfiguration.format === OpenId4VciCredentialFormatProfile.JwtVcJsonLd ||
    credentialConfiguration.format === OpenId4VciCredentialFormatProfile.LdpVc ||
    credentialConfiguration.format === OpenId4VciCredentialFormatProfile.SdJwtVc
      ? credentialConfiguration.credential_definition?.type
      : undefined
  const type = asArray(credentialType)

  if (!expectedType?.every((value) => type.includes(value))) {
    throw new CredoError(
      `Expected the credential type to include each type of the credential configuration, '${expectedType?.join("', '")}', received '${type.join("', '")}'.`
    )
  }
}

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

/**
 * Given all credential configurations supported by an issuer and a requested `scope` parameter
 * value (space-separated), returns the scopes and credential configurations that were requested
 * and are also supported by the issuer.
 */
export function getRequestedCredentialConfigurationsForScope(options: {
  credentialConfigurationsSupported: CredentialConfigurationsSupported
  requestedScope: string
}): { requestedScopes: string[]; requestedCredentialConfigurations: CredentialConfigurationsSupported } {
  const allowedScopes = getScopesFromCredentialConfigurationsSupported(options.credentialConfigurationsSupported)
  const requestedScopes = getAllowedAndRequestedScopeValues({
    allowedScopes,
    requestedScope: options.requestedScope,
  })
  const requestedCredentialConfigurations = getCredentialConfigurationsSupportedForScopes(
    options.credentialConfigurationsSupported,
    requestedScopes
  )

  return { requestedScopes, requestedCredentialConfigurations }
}
