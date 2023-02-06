import type {
  CreateCredentialRequestOptions,
  CreateCredentialRequestReturn,
  CreateProofOptions,
  GetCredentialOptions,
  StoreCredentialOptions,
  GetCredentialsForProofRequestOptions,
  GetCredentialsForProofRequestReturn,
  CreateLinkSecretReturn,
  CreateLinkSecretOptions,
} from './AnonCredsHolderServiceOptions'
import type { AnonCredsCredentialInfo } from '../models'
import type { AnonCredsProof } from '../models/exchange'
import type { AgentContext } from '@aries-framework/core'

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

  createCredentialRequest(
    agentContext: AgentContext,
    options: CreateCredentialRequestOptions
  ): Promise<CreateCredentialRequestReturn>

  deleteCredential(agentContext: AgentContext, credentialId: string): Promise<void>
  getCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetCredentialsForProofRequestOptions
  ): Promise<GetCredentialsForProofRequestReturn>
}
