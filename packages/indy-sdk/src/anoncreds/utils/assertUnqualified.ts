import type {
  AnonCredsCredentialOffer,
  AnonCredsCredentialRequest,
  AnonCredsProofRequest,
} from '@aries-framework/anoncreds'

import {
  unqualifiedRevocationRegistryIdRegex,
  unqualifiedCredentialDefinitionIdRegex,
  unqualifiedIndyDidRegex,
  unqualifiedSchemaIdRegex,
} from '@aries-framework/anoncreds'
import { AriesFrameworkError } from '@aries-framework/core'

/**
 * Assert that a credential definition id is unqualified.
 */
export function assertUnqualifiedCredentialDefinitionId(credentialDefinitionId: string) {
  if (!unqualifiedCredentialDefinitionIdRegex.test(credentialDefinitionId)) {
    throw new AriesFrameworkError(
      `Credential definition id '${credentialDefinitionId}' is not an unqualified credential definition id. Indy SDK only supports unqualified identifiers.`
    )
  }
}

/**
 * Assert that a schema id is unqualified.
 */
export function assertUnqualifiedSchemaId(schemaId: string) {
  if (!unqualifiedSchemaIdRegex.test(schemaId)) {
    throw new AriesFrameworkError(
      `Schema id '${schemaId}' is not an unqualified schema id. Indy SDK only supports unqualified identifiers.`
    )
  }
}

/**
 * Assert that a revocation registry id is unqualified.
 */
export function assertUnqualifiedRevocationRegistryId(revocationRegistryId: string) {
  if (!unqualifiedRevocationRegistryIdRegex.test(revocationRegistryId)) {
    throw new AriesFrameworkError(
      `Revocation registry id '${revocationRegistryId}' is not an unqualified revocation registry id. Indy SDK only supports unqualified identifiers.`
    )
  }
}

/**
 * Assert that an issuer id is unqualified.
 */
export function assertUnqualifiedIssuerId(issuerId: string) {
  if (!unqualifiedIndyDidRegex.test(issuerId)) {
    throw new AriesFrameworkError(
      `Issuer id '${issuerId}' is not an unqualified issuer id. Indy SDK only supports unqualified identifiers.`
    )
  }
}

/**
 * Assert that a credential offer only contains unqualified identifiers.
 */
export function assertUnqualifiedCredentialOffer(credentialOffer: AnonCredsCredentialOffer) {
  assertUnqualifiedCredentialDefinitionId(credentialOffer.cred_def_id)
  assertUnqualifiedSchemaId(credentialOffer.schema_id)
}

/**
 * Assert that a credential request only contains unqualified identifiers.
 */
export function assertUnqualifiedCredentialRequest(credentialRequest: AnonCredsCredentialRequest) {
  assertUnqualifiedCredentialDefinitionId(credentialRequest.cred_def_id)
}

/**
 * Assert that a proof request only contains unqualified identifiers.
 */
export function assertUnqualifiedProofRequest(proofRequest: AnonCredsProofRequest) {
  const allRequested = [
    ...Object.values(proofRequest.requested_attributes),
    ...Object.values(proofRequest.requested_predicates),
  ]

  for (const requested of allRequested) {
    for (const restriction of requested.restrictions ?? []) {
      assertAllUnqualified({
        credentialDefinitionIds: [restriction.cred_def_id],
        schemaIds: [restriction.schema_id],
        revocationRegistryIds: [restriction.rev_reg_id],
        issuerIds: [restriction.issuer_did, restriction.schema_issuer_did],
      })
    }
  }
}

export function assertAllUnqualified({
  schemaIds = [],
  credentialDefinitionIds = [],
  revocationRegistryIds = [],
  issuerIds = [],
}: {
  schemaIds?: Array<string | undefined>
  credentialDefinitionIds?: Array<string | undefined>
  revocationRegistryIds?: Array<string | undefined>
  issuerIds?: Array<string | undefined>
}) {
  for (const schemaId of schemaIds) {
    // We don't validate undefined values
    if (!schemaId) continue

    assertUnqualifiedSchemaId(schemaId)
  }

  for (const credentialDefinitionId of credentialDefinitionIds) {
    // We don't validate undefined values
    if (!credentialDefinitionId) continue

    assertUnqualifiedCredentialDefinitionId(credentialDefinitionId)
  }

  for (const revocationRegistryId of revocationRegistryIds) {
    // We don't validate undefined values
    if (!revocationRegistryId) continue

    assertUnqualifiedRevocationRegistryId(revocationRegistryId)
  }

  for (const issuerId of issuerIds) {
    // We don't validate undefined values
    if (!issuerId) continue

    assertUnqualifiedIssuerId(issuerId)
  }
}
