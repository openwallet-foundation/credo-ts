import type {
  OpenId4VciCredentialConfigurationsSupported,
  OpenId4VciCredentialConfigurationSupported,
  OpenId4VciCredentialSupported,
  OpenId4VciCredentialSupportedWithId,
} from './models'
import type { AgentContext, JwaSignatureAlgorithm } from '@credo-ts/core'

import { CredoError } from '@credo-ts/core'

import { getSupportedJwaSignatureAlgorithms } from './utils'
import { CredentialConfigurationSupported } from '@animo-id/oid4vci'



export function credentialConfigurationSupportedToCredentialSupported(
  id: string,
  config: OpenId4VciCredentialConfigurationSupported
): OpenId4VciCredentialSupportedWithId {
  const baseConfig = {
    id,
    scope: config.scope,
    cryptographic_binding_methods_supported: config.cryptographic_binding_methods_supported,
    cryptographic_suites_supported: config.credential_signing_alg_values_supported,
    display: config.display,
    order: config.order,
  }

  if (config.format === 'jwt_vc_json' || config.format === 'jwt_vc') {
    return {
      ...baseConfig,
      format: config.format,
      credentialSubject: config.credential_definition?.credentialSubject,
      types: config.credential_definition?.type ?? [],
    }
  } else if (config.format === 'ldp_vc' || config.format === 'jwt_vc_json-ld') {
    if (!config.credential_definition?.['@context']) {
      throw new Error(
        `Unable to transform from draft 13 credential configuration to draft 11 credential supported for format ${config.format}. credential_definition.@context is not defined`
      )
    }

    return {
      ...baseConfig,
      format: config.format,
      '@context': config.credential_definition['@context'],
      credentialSubject: config.credential_definition.credentialSubject,
      types: config.credential_definition.type,
    }
  } else if (config.format === 'vc+sd-jwt') {
    if (!config.vct) {
      throw new Error(
        `Unable to transform from draft 13 credential configuration to draft 11 credential supported for format ${config.format}. vct is not defined`
      )
    }

    return {
      ...baseConfig,
      format: config.format,
      vct: config.vct,
      claims: config.claims,
    }
  }

  throw new CredoError(`Unsupported credential format ${config.format}`)
}

export function credentialSupportedToCredentialConfigurationSupported(
  agentContext: AgentContext,
  credentialSupported: OpenId4VciCredentialSupportedWithId
): OpenId4VciCredentialConfigurationSupported {
  const supportedJwaSignatureAlgorithms = getSupportedJwaSignatureAlgorithms(agentContext)

  // We assume the jwt proof_types_supported is the same as the cryptographic_suites_supported when converting from v11 to v13
  const proofSigningAlgValuesSupported =
    credentialSupported.cryptographic_suites_supported?.filter((alg) =>
      supportedJwaSignatureAlgorithms.includes(alg as JwaSignatureAlgorithm)
    ) ?? supportedJwaSignatureAlgorithms

  // proof_types_supported was not available in v11. We assume jwt proof type supported
  const proofTypesSupported = {
    jwt: {
      proof_signing_alg_values_supported: proofSigningAlgValuesSupported,
    },
  } as const

  const baseCredentialConfigurationSupported = {
    scope: credentialSupported.scope,
    cryptographic_binding_methods_supported: credentialSupported.cryptographic_binding_methods_supported,
    credential_signing_alg_values_supported: credentialSupported.cryptographic_suites_supported,
    // This is not necessarily true, but the best we can do for now
    proof_types_supported: proofTypesSupported,
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
        '@context': credentialSupported['@context'] as string[],
        credentialSubject: credentialSupported.credentialSubject,
        type: credentialSupported.types,
      },
    }
  } else if (credentialSupported.format === 'vc+sd-jwt') {
    return {
      ...baseCredentialConfigurationSupported,
      format: credentialSupported.format,
      vct: credentialSupported.vct,
      claims: credentialSupported.claims,
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
  agentContext: AgentContext,
  credentialsSupported: OpenId4VciCredentialSupportedWithId[]
): OpenId4VciCredentialConfigurationsSupported {
  const credentialConfigurationsSupported: OpenId4VciCredentialConfigurationsSupported = {}

  for (const credentialSupported of credentialsSupported) {
    credentialConfigurationsSupported[credentialSupported.id] = credentialSupportedToCredentialConfigurationSupported(
      agentContext,
      credentialSupported
    )
  }

  return credentialConfigurationsSupported
}

/**
 * Returns all entries from the credential offer with the associated metadata resolved.
 */
export function getOfferedCredentials(
  offeredCredentialConfigurationIds: Array<string>,
  credentialConfigurationsSupported: Record<string, CredentialConfigurationSupported>
): {
  credentialConfigurationsSupported: Record<string, CredentialConfigurationSupported>
} {
  const offeredCredentialConfigurations: Record<string, CredentialConfigurationSupported> = {}

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

  return {
    credentialConfigurationsSupported: offeredCredentialConfigurations,
  }
}
