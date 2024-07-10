import type {
  OpenId4VciCredentialConfigurationsSupported,
  OpenId4VciCredentialConfigurationSupported,
  OpenId4VciCredentialSupportedWithId,
} from './models'
import type { AgentContext } from '@credo-ts/core'
import type { CredentialOfferFormat, KeyProofType, ProofType } from '@sphereon/oid4vci-common'

import { CredoError } from '@credo-ts/core'

import { getSupportedJwaSignatureAlgorithms } from './utils'

/**
 * Get all `types` from a `CredentialSupported` object.
 *
 * Depending on the format, the types may be nested, or have different a different name/type
 */
export function getTypesFromCredentialSupported(credentialSupported: OpenId4VciCredentialConfigurationSupported) {
  if (
    credentialSupported.format === 'jwt_vc_json-ld' ||
    credentialSupported.format === 'ldp_vc' ||
    credentialSupported.format === 'jwt_vc_json' ||
    credentialSupported.format === 'jwt_vc'
  ) {
    return credentialSupported.credential_definition.type
  } else if (credentialSupported.format === 'vc+sd-jwt') {
    return credentialSupported.vct
  }

  throw Error(`Unable to extract types from credentials supported. Unknown format ${credentialSupported.format}`)
}

export function credentialConfigurationSupportedToCredentialSupported(
  id: string,
  config: OpenId4VciCredentialConfigurationSupported
): OpenId4VciCredentialSupportedWithId {
  const baseConfig = {
    id,
    scope: config.scope,
    cryptographic_binding_methods_supported: config.cryptographic_binding_methods_supported,
    cryptographic_suites_supported: config.credential_signing_alg_values_supported,
    // In theory credentials_supported should not have any proof_types we do this to allow back and forth conversion
    proof_types_supported: config.proof_types_supported,
    display: config.display,
    order: config.order as string[] | undefined,
  }

  if (config.format === 'jwt_vc_json' || config.format === 'jwt_vc') {
    return {
      ...baseConfig,
      format: config.format,
      credentialSubject: config.credential_definition.credentialSubject,
      types: config.credential_definition.type ?? [],
    }
  } else if (config.format === 'ldp_vc' || config.format === 'jwt_vc_json-ld') {
    return {
      ...baseConfig,
      format: config.format,
      // @ts-expect-error this should exist
      '@context': config.credential_definition['@context'],
      credentialSubject: config.credential_definition.credentialSubject,
      types: config.credential_definition.type ?? [],
    }
  } else if (config.format === 'vc+sd-jwt') {
    return {
      ...baseConfig,
      format: config.format,
      // @ts-expect-error keep this for now to allow back and forth conversion
      vct: config.vct,
      claims: config.claims,
    }
  }

  throw new CredoError(`Unsupported credential format ${config.format}`)
}

export function credentialSupportedToCredentialConfigurationSupported(
  credentialSupported: OpenId4VciCredentialSupportedWithId,
  options?: {
    proofTypesSupported?: Record<KeyProofType, ProofType>
  }
): OpenId4VciCredentialConfigurationSupported {
  const baseCredentialConfigurationSupported = {
    id: credentialSupported.id,
    scope: credentialSupported.scope,
    cryptographic_binding_methods_supported: credentialSupported.cryptographic_binding_methods_supported,
    credential_signing_alg_values_supported:
      'cryptographic_suites_supported' in credentialSupported
        ? (credentialSupported.cryptographic_suites_supported as string[] | undefined)
        : undefined,
    // In theory credentials_supported should not have any proof_types we do this to allow back and forth conversion
    proof_types_supported: credentialSupported.proof_types_supported ?? options?.proofTypesSupported,
    display: credentialSupported.display,
    order: credentialSupported.order,
  }

  if (credentialSupported.format === 'jwt_vc_json' || credentialSupported.format === 'jwt_vc') {
    return {
      ...baseCredentialConfigurationSupported,
      format: credentialSupported.format,
      credential_definition: {
        credentialSubject: credentialSupported.credentialSubject,
        type: credentialSupported.types,
      },
    }
  } else if (credentialSupported.format === 'ldp_vc' || credentialSupported.format === 'jwt_vc_json-ld') {
    return {
      ...baseCredentialConfigurationSupported,
      format: credentialSupported.format,
      credential_definition: {
        // @ts-expect-error this should exist
        '@context': credentialSupported['@context'],
        credentialSubject: credentialSupported.credentialSubject,
        type: credentialSupported.types,
      },
    }
  } else if (credentialSupported.format === 'vc+sd-jwt') {
    return {
      ...baseCredentialConfigurationSupported,
      format: credentialSupported.format,
      vct: credentialSupported.vct,
      id: credentialSupported.id,
      claims: credentialSupported.format === 'vc+sd-jwt' ? credentialSupported.claims : undefined,
      credential_definition: {},
    }
  }

  throw new CredoError(`Unsupported credential format ${credentialSupported.format}`)
}

export function credentialsSupportedV13ToV11(
  credentialConfigurationSupported: OpenId4VciCredentialConfigurationsSupported
): OpenId4VciCredentialSupportedWithId[] {
  const credentialsSupportedWithId: OpenId4VciCredentialSupportedWithId[] = []

  for (const [id, credentialConfiguration] of Object.entries(credentialConfigurationSupported)) {
    credentialsSupportedWithId.push(credentialConfigurationSupportedToCredentialSupported(id, credentialConfiguration))
  }

  return credentialsSupportedWithId
}

export function credentialsSupportedV11ToV13(
  credentialsSupported: OpenId4VciCredentialSupportedWithId[],
  options?: {
    proofTypesSupported?: Record<KeyProofType, ProofType>
  }
): OpenId4VciCredentialConfigurationsSupported {
  const credentialConfigurationsSupported: OpenId4VciCredentialConfigurationsSupported = {}

  for (const credentialSupported of credentialsSupported) {
    credentialConfigurationsSupported[credentialSupported.id] = credentialSupportedToCredentialConfigurationSupported(
      credentialSupported,
      options
    )
  }

  return credentialConfigurationsSupported
}

/**
 * Returns all entries from the credential offer with the associated metadata resolved. For 'id' entries, the associated `credentials_supported` object is resolved from the issuer metadata.
 * For inline entries, an error is thrown.
 */
export function getOfferedCredentials(
  offeredCredentials: Array<string | CredentialOfferFormat>,
  allCredentialsSupported: OpenId4VciCredentialSupportedWithId[] | OpenId4VciCredentialConfigurationsSupported,
  options?: {
    proofTypesSupported?: Record<KeyProofType, ProofType>
  }
) {
  const credentialConfigurationsOffered: OpenId4VciCredentialConfigurationsSupported = {}

  const uniformCredentialsSupported = Array.isArray(allCredentialsSupported)
    ? credentialsSupportedV11ToV13(allCredentialsSupported, options)
    : allCredentialsSupported

  for (const offeredCredential of offeredCredentials) {
    // In draft 12 inline credential offers are removed. It's easier to already remove support now.
    if (typeof offeredCredential !== 'string') {
      throw new CredoError(
        'Only referenced credentials pointing to an id in credentials_supported issuer metadata are supported'
      )
    }

    // Make sure the issuer metadata includes the offered credential.
    const credentialConfigurationSupported = uniformCredentialsSupported[offeredCredential]
    if (!credentialConfigurationSupported) {
      throw new Error(
        `Offered credential '${offeredCredential}' is not part of credentials_supported of the issuer metadata.`
      )
    }
    credentialConfigurationsOffered[offeredCredential] = credentialConfigurationSupported
  }

  return credentialConfigurationsOffered
}

export const getProofTypesSupported = (agentContext: AgentContext) => {
  return {
    jwt: {
      proof_signing_alg_values_supported: getSupportedJwaSignatureAlgorithms(agentContext) as string[],
    },
    cwt: {
      proof_signing_alg_values_supported: [],
    },
    ldp_vp: {
      proof_signing_alg_values_supported: [],
    },
  }
}
