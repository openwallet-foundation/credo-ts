import type { AgentContext, JsonObject } from '@credo-ts/core'
import type { DidCommCredentialExchangeRecord } from '../../repository/DidCommCredentialExchangeRecord'
import type {
  AnonCredsLinkSecretBindingMethod,
  AnonCredsLinkSecretDataIntegrityBindingProof,
} from './dataIntegrityExchange'

/**
 * Injection token for a {@link DidCommDataIntegrityLinkSecretBindingProvider}.
 *
 * The provider is optional. When it is not registered, the data integrity credential format simply
 * does not support the `anoncreds_link_secret` binding method, and the remaining binding methods
 * keep working.
 */
export const DidCommDataIntegrityLinkSecretBindingProviderToken = Symbol(
  'DidCommDataIntegrityLinkSecretBindingProvider'
)

export interface DidCommDataIntegrityLinkSecretCreateOfferBindingMethodOptions {
  credentialExchangeRecord: DidCommCredentialExchangeRecord
  credentialDefinitionId: string
  revocationRegistryDefinitionId?: string
  revocationRegistryIndex?: number

  /** The credential being offered, so the provider can assert it matches the credential definition schema */
  offeredCredential: JsonObject
}

export interface DidCommDataIntegrityLinkSecretCreateBindingProofOptions {
  credentialExchangeRecord: DidCommCredentialExchangeRecord
  bindingMethod: AnonCredsLinkSecretBindingMethod
  linkSecretId?: string
}

export interface DidCommDataIntegrityLinkSecretIssueCredentialOptions {
  credentialExchangeRecord: DidCommCredentialExchangeRecord
  bindingMethod: AnonCredsLinkSecretBindingMethod
  bindingProof: AnonCredsLinkSecretDataIntegrityBindingProof
  credentialSubjectId?: string
}

export interface DidCommDataIntegrityLinkSecretStoreCredentialOptions {
  credentialExchangeRecord: DidCommCredentialExchangeRecord

  /** The received, signed credential */
  credentialJson: JsonObject

  /** The credential as it was offered, used to assert only integrity protected fields were offered */
  offeredCredentialJson: JsonObject
}

/**
 * Implements the `anoncreds_link_secret` binding method of the W3C Data Integrity credential
 * attachment format (Aries RFC 0809).
 *
 * The binding method itself is defined by the RFC and therefore lives here, but binding a credential
 * to an anoncreds link secret requires anoncreds. An implementation is provided by
 * `@credo-ts/anoncreds` and registered by the `AnonCredsModule`, which keeps this package free of an
 * anoncreds dependency.
 */
export interface DidCommDataIntegrityLinkSecretBindingProvider {
  /** Issuer: create the `binding_method.anoncreds_link_secret` entry of the credential offer */
  createOfferBindingMethod(
    agentContext: AgentContext,
    options: DidCommDataIntegrityLinkSecretCreateOfferBindingMethodOptions
  ): Promise<AnonCredsLinkSecretBindingMethod>

  /** Holder: create the `binding_proof.anoncreds_link_secret` entry of the credential request */
  createBindingProof(
    agentContext: AgentContext,
    options: DidCommDataIntegrityLinkSecretCreateBindingProofOptions
  ): Promise<AnonCredsLinkSecretDataIntegrityBindingProof>

  /** Issuer: issue a credential bound to the holder's link secret */
  issueBoundCredential(
    agentContext: AgentContext,
    options: DidCommDataIntegrityLinkSecretIssueCredentialOptions
  ): Promise<JsonObject>

  /** Holder: process and store a received credential bound to the link secret, returning its record id */
  storeBoundCredential(
    agentContext: AgentContext,
    options: DidCommDataIntegrityLinkSecretStoreCredentialOptions
  ): Promise<string>

  /**
   * Holder: whether the credential record was stored by {@link storeBoundCredential}, and therefore
   * has to be deleted through {@link deleteCredentialById} rather than as a plain w3c credential
   * record, so that its anoncreds state is cleaned up as well.
   */
  ownsCredentialRecord(agentContext: AgentContext, credentialRecordId: string): Promise<boolean>

  /** Holder: delete a credential that was stored by {@link storeBoundCredential} */
  deleteCredentialById(agentContext: AgentContext, credentialRecordId: string): Promise<void>
}
