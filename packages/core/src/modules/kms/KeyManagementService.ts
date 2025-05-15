import type { AgentContext } from '../../agent'
import type { KmsJwkPrivate, KmsJwkPublic } from './jwk/knownJwk'
import type { KmsDecryptOptions, KmsDecryptReturn, KmsRandomBytesOptions, KmsRandomBytesReturn } from './options'
import type { KmsCreateKeyOptions, KmsCreateKeyReturn, KmsCreateKeyType } from './options/KmsCreateKeyOptions'
import type { KmsDeleteKeyOptions } from './options/KmsDeleteKeyOptions'
import type { KmsEncryptOptions, KmsEncryptReturn } from './options/KmsEncryptOptions'
import type { KmsImportKeyOptions, KmsImportKeyReturn } from './options/KmsImportKeyOptions'
import { KmsOperation } from './options/KmsOperation'
import type { KmsSignOptions, KmsSignReturn } from './options/KmsSignOptions'
import type { KmsVerifyOptions, KmsVerifyReturn } from './options/KmsVerifyOptions'

export interface KeyManagementService {
  /**
   * The 'backend' name of this key management service
   */
  readonly backend: string

  /**
   * Whether this backend supports an operation. Generally if no backend is provided
   * for an operation the first supported backend will be chosen. For operations based on
   * a key id, the first supported backed will be checked whether it can handle that specific
   * key id.
   */
  isOperationSupported(agentContext: AgentContext, operation: KmsOperation): boolean

  /**
   * Get the public representation of a key.
   *
   * In case of a symmetric key the returned JWK won't include
   * any cryptographic key material itself, but will include
   * all the key related metadata.
   */
  getPublicKey(agentContext: AgentContext, keyId: string): Promise<KmsJwkPublic | null>

  /**
   * Create a key
   */
  createKey<Type extends KmsCreateKeyType>(
    agentContext: AgentContext,
    options: KmsCreateKeyOptions<Type>
  ): Promise<KmsCreateKeyReturn<Type>>

  /**
   * Import a key
   */
  importKey<Jwk extends KmsJwkPrivate>(
    agentContext: AgentContext,
    options: KmsImportKeyOptions<Jwk>
  ): Promise<KmsImportKeyReturn<Jwk>>

  /**
   * Delete a key.
   *
   * @returns boolean whether the key was removed.
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

  /**
   * Encrypt data
   */
  encrypt(agentContext: AgentContext, options: KmsEncryptOptions): Promise<KmsEncryptReturn>

  /**
   * Decrypt data
   */
  decrypt(agentContext: AgentContext, options: KmsDecryptOptions): Promise<KmsDecryptReturn>

  /**
   * Generate secure random bytes
   */
  randomBytes(agentContext: AgentContext, options: KmsRandomBytesOptions): KmsRandomBytesReturn
}
