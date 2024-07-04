import type {
  OpenId4VciCredentialConfigurationsSupported,
  OpenId4VciCredentialSupported,
  OpenId4VciCredentialSupportedWithId,
} from './models'
import type { CredentialConfigurationSupportedV1_0_13, CredentialOfferFormat } from '@sphereon/oid4vci-common'

import { CredoError } from '@credo-ts/core'

/**
 * Get all `types` from a `CredentialSupported` object.
 *
 * Depending on the format, the types may be nested, or have different a different name/type
 */
export function getTypesFromCredentialSupported(credentialSupported: OpenId4VciCredentialSupported) {
  if (
    credentialSupported.format === 'jwt_vc_json-ld' ||
    credentialSupported.format === 'ldp_vc' ||
    credentialSupported.format === 'jwt_vc_json' ||
    credentialSupported.format === 'jwt_vc'
  ) {
    return credentialSupported.types
  } else if (credentialSupported.format === 'vc+sd-jwt') {
    return [credentialSupported.vct]
  }

  throw Error(`Unable to extract types from credentials supported. Unknown format ${credentialSupported.format}`)
}

export function credentialConfigurationSupportedToCredentialSupported(
  config: CredentialConfigurationSupportedV1_0_13
): OpenId4VciCredentialSupportedWithId {
  return {
    id: config.id as string,
    format: config.format,
    scope: config.scope,
    cryptographic_binding_methods_supported: config.cryptographic_binding_methods_supported,
    // @ts-expect-error this property was removed for some reason
    cryptographic_suites_supported: config.credential_signing_alg_values_supported,
    proof_types_supported: config.proof_types_supported,
    display: config.display,
    ...(config.vct && { vct: config.vct }),
    claims: config.format === 'vc+sd-jwt' ? config.claims : undefined,
    credentialSubject: config.format !== 'vc+sd-jwt' ? config.credential_definition.credentialSubject : undefined,
    types: config.format !== 'vc+sd-jwt' ? config.credential_definition.type : undefined,
  }
}

export function credentialSupportedToCredentialConfigurationSupported(
  credentialSupported: OpenId4VciCredentialSupportedWithId
): CredentialConfigurationSupportedV1_0_13 {
  return {
    vct: credentialSupported.format === 'vc+sd-jwt' ? credentialSupported.vct : undefined,
    id: credentialSupported.id,
    claims: credentialSupported.format === 'vc+sd-jwt' ? credentialSupported.claims : undefined,
    format: credentialSupported.format,
    scope: credentialSupported.scope,
    cryptographic_binding_methods_supported: credentialSupported.cryptographic_binding_methods_supported,
    // @ts-expect-error this property was removed for some reason
    credential_signing_alg_values_supported: credentialSupported.cryptographic_suites_supported,
    proof_types_supported: credentialSupported.proof_types_supported,
    display: credentialSupported.display,
    credential_definition: {
      credentialSubject: credentialSupported.format !== 'vc+sd-jwt' ? credentialSupported.credentialSubject : undefined,
      type: credentialSupported.format !== 'vc+sd-jwt' ? credentialSupported.types : undefined,
    },
  }
}

export function credentialsSupportedV13ToV11(
  credentialConfigurationSupported: OpenId4VciCredentialConfigurationsSupported
): OpenId4VciCredentialSupportedWithId[] {
  const credentialsSupportedWithId: OpenId4VciCredentialSupportedWithId[] = []

  for (const [id, credentialConfiguration] of Object.entries(credentialConfigurationSupported)) {
    credentialsSupportedWithId.push({
      ...credentialConfigurationSupportedToCredentialSupported(credentialConfiguration),
      id,
    })
  }

  return credentialsSupportedWithId
}

export function credentialsSupportedV11ToV13(
  credentialsSupported: OpenId4VciCredentialSupportedWithId[]
): OpenId4VciCredentialConfigurationsSupported {
  const credentialConfigurationsSupported: OpenId4VciCredentialConfigurationsSupported = {}

  for (const credentialSupported of credentialsSupported) {
    credentialConfigurationsSupported[credentialSupported.id] =
      credentialSupportedToCredentialConfigurationSupported(credentialSupported)
  }

  return credentialConfigurationsSupported
}

/**
 * Returns all entries from the credential offer with the associated metadata resolved. For 'id' entries, the associated `credentials_supported` object is resolved from the issuer metadata.
 * For inline entries, an error is thrown.
 */
export function getOfferedCredentials(
  offeredCredentials: Array<string | CredentialOfferFormat>,
  allCredentialsSupported: OpenId4VciCredentialSupported[] | OpenId4VciCredentialConfigurationsSupported
): OpenId4VciCredentialSupportedWithId[] {
  const credentialsSupported: OpenId4VciCredentialSupportedWithId[] = []

  const uniformCredentialsSupported = Array.isArray(allCredentialsSupported)
    ? allCredentialsSupported
    : credentialsSupportedV13ToV11(allCredentialsSupported)

  for (const offeredCredential of offeredCredentials) {
    // In draft 12 inline credential offers are removed. It's easier to already remove support now.
    if (typeof offeredCredential !== 'string') {
      throw new CredoError(
        'Only referenced credentials pointing to an id in credentials_supported issuer metadata are supported'
      )
    }

    const foundSupportedCredential = uniformCredentialsSupported.find(
      (supportedCredential): supportedCredential is OpenId4VciCredentialSupportedWithId =>
        supportedCredential.id !== undefined && supportedCredential.id === offeredCredential
    )

    // Make sure the issuer metadata includes the offered credential.
    if (!foundSupportedCredential) {
      throw new Error(
        `Offered credential '${offeredCredential}' is not part of credentials_supported of the issuer metadata.`
      )
    }

    credentialsSupported.push(foundSupportedCredential)
  }

  return credentialsSupported
}
