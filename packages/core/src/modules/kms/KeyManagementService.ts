import type { KmsJwkPublic } from './jwk/knownJwk'
import type { KmsCreateKeyOptions, KmsCreateKeyReturn } from './options/KmsCreateKeyOptions'
import type { KmsDeleteKeyOptions } from './options/KmsDeleteKeyOptions'
import type { KmsImportKeyOptions, KmsImportKeyReturn } from './options/KmsImportKeyOptions'
import type { KmsSignOptions, KmsSignReturn } from './options/KmsSignOptions'
import type { KmsVerifyOptions, KmsVerifyReturn } from './options/KmsVerifyOptions'
import type { AgentContext } from '../../agent'

export interface KeyManagementService {
  /**
   * The 'backend' name of this key management service
   */
  readonly backend: string

  /**
   * Get the public representation of a key.
   *
   * In case of a symmetric key the returned JWK won't include
   * any key cryptographic key material itself, but will include
   * all the key related metadata.
   */
  getPublicKey(agentContext: AgentContext, keyId: string): Promise<KmsJwkPublic | null>

  /**
   * Create a key
   */
  createKey(agentContext: AgentContext, options: KmsCreateKeyOptions): Promise<KmsCreateKeyReturn>

  /**
   * Import a key
   */
  importKey(agentContext: AgentContext, options: KmsImportKeyOptions): Promise<KmsImportKeyReturn>

  /**
   * Delete a key
   */
  deleteKey(agentContext: AgentContext, options: KmsDeleteKeyOptions): Promise<boolean>

  /**
   * Sign with a specific key
   */
  sign(agentContext: AgentContext, options: KmsSignOptions): Promise<KmsSignReturn>

  /**
   * Verify with a specific key
   */
  verify(agentContext: AgentContext, options: KmsVerifyOptions): Promise<KmsVerifyReturn>
}
