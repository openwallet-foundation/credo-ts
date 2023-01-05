import type { CredentialInfo } from '../models'
import type { AnonCredsProof } from '../models/exchange'
import type {
  CreateCredentialRequestOptions,
  CreateCredentialRequestReturn,
  CreateProofOptions,
  GetCredentialOptions,
  StoreCredentialOptions,
  GetCredentialsForProofRequestOptions,
  GetCredentialsForProofRequestReturn,
} from './AnonCredsHolderServiceOptions'
import type { AgentContext } from '@aries-framework/core'

export interface AnonCredsHolderService {
  createProof(
    agentContext: AgentContext,
    options: CreateProofOptions,
    metadata?: Record<string, unknown>
  ): Promise<AnonCredsProof>
  storeCredential(
    agentContext: AgentContext,
    options: StoreCredentialOptions,
    metadata?: Record<string, unknown>
  ): Promise<string>

  // TODO: indy has different return types for the credential
  getCredential(agentContext: AgentContext, options: GetCredentialOptions): Promise<CredentialInfo>

  createCredentialRequest(
    agentContext: AgentContext,
    options: CreateCredentialRequestOptions,
    metadata?: Record<string, unknown>
  ): Promise<CreateCredentialRequestReturn>

  deleteCredential(agentContext: AgentContext, credentialId: string): Promise<void>
  getCredentialsForProofRequest(
    agentContext: AgentContext,
    options: GetCredentialsForProofRequestOptions
  ): Promise<GetCredentialsForProofRequestReturn[]>
}
