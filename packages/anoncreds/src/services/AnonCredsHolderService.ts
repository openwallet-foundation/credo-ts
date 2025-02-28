import type { AgentContext, W3cJsonLdVerifiableCredential, W3cJsonLdVerifiablePresentation } from '@credo-ts/core'
import type { AnonCredsCredentialInfo } from '../models'
import type { AnonCredsCredential, AnonCredsProof } from '../models/exchange'
import type {
  CreateCredentialRequestOptions,
  CreateCredentialRequestReturn,
  CreateLinkSecretOptions,
  CreateLinkSecretReturn,
  CreateProofOptions,
  CreateW3cPresentationOptions,
  GetCredentialOptions,
  GetCredentialsForProofRequestOptions,
  GetCredentialsForProofRequestReturn,
  GetCredentialsOptions,
  LegacyToW3cCredentialOptions,
  StoreCredentialOptions,
  W3cToLegacyCredentialOptions,
} from './AnonCredsHolderServiceOptions'

export const AnonCredsHolderServiceSymbol = Symbol('AnonCredsHolderService')

export interface AnonCredsHolderService {
  createLinkSecret(agentContext: AgentContext, options: CreateLinkSecretOptions): Promise<CreateLinkSecretReturn>

  createProof(agentContext: AgentContext, options: CreateProofOptions): Promise<AnonCredsProof>
  storeCredential(
    agentContext: AgentContext,
    options: StoreCredentialOptions,
    metadata?: Record<string, unknown>
  ): Promise<string>

  // TODO: this doesn't actually return the credential, as the indy-sdk doesn't support that
  // We could come up with a hack (as we've received the credential at one point), but for
  // now I think it's not that much of an issue
  getCredential(agentContext: AgentContext, options: GetCredentialOptions): Promise<AnonCredsCredentialInfo>
  getCredentials(agentContext: AgentContext, options: GetCredentialsOptions): Promise<AnonCredsCredentialInfo[]>

  createCredentialRequest(
    agentContext: AgentContext,
    options: CreateCredentialRequestOptions
  ): Promise<CreateCredentialRequestReturn>

  deleteCredential(agentContext: AgentContext, credentialId: string): Promise<void>
  getCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetCredentialsForProofRequestOptions
  ): Promise<GetCredentialsForProofRequestReturn>

  createW3cPresentation(
    agentContext: AgentContext,
    options: CreateW3cPresentationOptions
  ): Promise<W3cJsonLdVerifiablePresentation>

  w3cToLegacyCredential(agentContext: AgentContext, options: W3cToLegacyCredentialOptions): Promise<AnonCredsCredential>

  legacyToW3cCredential(
    agentContext: AgentContext,
    options: LegacyToW3cCredentialOptions
  ): Promise<W3cJsonLdVerifiableCredential>
}
