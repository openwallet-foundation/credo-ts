import type {
  AuthenticationPrompt,
  GenerateKeypairOptions,
  UserAuthenticationSession,
  WithUserAuthenticationOptions,
} from '@animo-id/expo-secure-environment'
import type { AgentContext } from '@credo-ts/core'

import { Kms, utils } from '@credo-ts/core'

import { importSecureEnvironment } from './secureEnvironment'

/**
 * Options for a key in the secure environment, the `generateKeypair` options of `@animo-id/expo-secure-environment`:
 * the user authentication the key requires, the minimum key storage on Android and a key attestation challenge.
 * Without options the key requires biometrics for every signature, and on Android StrongBox.
 */
export type SecureEnvironmentCreateKeyOptions = GenerateKeypairOptions

export interface SecureEnvironmentKeyManagementServiceOptions {
  /**
   * The texts of the prompt where the user authenticates to sign, also for `withUserAuthentication` without a
   * `prompt`. A function is called for every prompt, so the texts can follow the language of the app.
   *
   * Without it the library's defaults are used, which are in English.
   */
  prompt?: AuthenticationPrompt | (() => AuthenticationPrompt)
}

export interface SecureEnvironmentUserAuthenticationOptions extends WithUserAuthenticationOptions {
  /**
   * The keys that sign with the authentication. Other keys ask the user to authenticate for every signature, as
   * outside `withUserAuthentication`. Default: all keys.
   */
  keyIds?: string[]
}

export class SecureEnvironmentKeyManagementService implements Kms.KeyManagementService {
  public readonly backend = 'secureEnvironment'
  private readonly secureEnvironment = importSecureEnvironment()
  private readonly options: SecureEnvironmentKeyManagementServiceOptions

  public constructor(options: SecureEnvironmentKeyManagementServiceOptions = {}) {
    this.options = options
  }

  private getPrompt() {
    return typeof this.options.prompt === 'function' ? this.options.prompt() : this.options.prompt
  }

  // The user authentication of a running `withUserAuthentication`, by context correlation id
  private readonly userAuthentications = new Map<string, { session: UserAuthenticationSession; keyIds?: string[] }>()

  /**
   * Asks the user to authenticate once, and then runs `callback`. While it runs, signatures of this agent context
   * with keys in this backend use the authentication instead of asking the user again, for example to present
   * multiple credentials with one authentication. Limit it to the keys of the presentation with `keyIds`.
   *
   * This uses `withUserAuthentication` of `@animo-id/expo-secure-environment`, which on iOS works for all keys
   * generated with the same `methods`. On Android it only works for keys with a validity above `0`: keys with a
   * validity of `0` still ask for every signature, after the prompt of this method itself.
   *
   * ```ts
   * // The instance configured as backend of the KeyManagementModule
   * const secureEnvironment = new SecureEnvironmentKeyManagementService()
   *
   * await secureEnvironment.withUserAuthentication(agent.context, () => presentCredentials(), {
   *   keyIds: credentialKeyIds,
   *   prompt: { title: 'Share 2 credentials' },
   * })
   * ```
   */
  public async withUserAuthentication<Result>(
    agentContext: AgentContext,
    callback: () => Promise<Result>,
    { keyIds, ...options }: SecureEnvironmentUserAuthenticationOptions = {}
  ): Promise<Result> {
    const { contextCorrelationId } = agentContext
    if (this.userAuthentications.has(contextCorrelationId)) {
      throw new Kms.KeyManagementError(
        `A user authentication of backend '${this.backend}' is already running for agent context '${contextCorrelationId}'`
      )
    }

    const secureEnvironment = await this.secureEnvironment
    return secureEnvironment.withUserAuthentication(
      async (session) => {
        this.userAuthentications.set(contextCorrelationId, { session, keyIds })
        try {
          return await callback()
        } finally {
          this.userAuthentications.delete(contextCorrelationId)
        }
      },
      { ...options, prompt: options.prompt ?? this.getPrompt() }
    )
  }

  public isOperationSupported(_agentContext: AgentContext, operation: Kms.KmsOperation): boolean {
    if (operation.operation === 'createKey') {
      return operation.type.kty === 'EC' && operation.type.crv === 'P-256'
    }

    if (operation.operation === 'sign') {
      return operation.algorithm === 'ES256'
    }

    if (operation.operation === 'deleteKey') {
      return true
    }

    return false
  }

  public randomBytes(_agentContext: AgentContext, _options: Kms.KmsRandomBytesOptions): Kms.KmsRandomBytesReturn {
    throw new Kms.KeyManagementError(`Generating random bytes is not supported for backend '${this.backend}'`)
  }

  public async getPublicKey(_agentContext: AgentContext, keyId: string): Promise<Kms.KmsJwkPublic | null> {
    try {
      return await this.getKeyAsserted(keyId)
    } catch (error) {
      if (error instanceof Kms.KeyManagementKeyNotFoundError) return null
      throw error
    }
  }

  public async importKey(): Promise<Kms.KmsImportKeyReturn<Kms.KmsJwkPrivate>> {
    throw new Kms.KeyManagementError(`Importing a key is not supported for backend '${this.backend}'`)
  }

  public async deleteKey(_agentContext: AgentContext, options: Kms.KmsDeleteKeyOptions): Promise<boolean> {
    const secureEnvironment = await this.secureEnvironment
    try {
      await secureEnvironment.deleteKey(options.keyId)
      return true
    } catch (error) {
      if (error instanceof secureEnvironment.KeyNotFoundError) {
        return false
      }

      throw new Kms.KeyManagementError(`Error deleting key with id '${options.keyId}' in backend '${this.backend}'`, {
        cause: error,
      })
    }
  }

  public async encrypt(): Promise<Kms.KmsEncryptReturn> {
    throw new Kms.KeyManagementError(`Encryption is not supported for backend '${this.backend}'`)
  }

  public async decrypt(): Promise<Kms.KmsDecryptReturn> {
    throw new Kms.KeyManagementError(`Decryption is not supported for backend '${this.backend}'`)
  }

  // The `backendOptions` type here is what `createKey` of the agent accepts for this backend
  public async createKey<Type extends Kms.KmsCreateKeyType>(
    _agentContext: AgentContext,
    options: Kms.KmsCreateKeyOptions<Type> & { backendOptions?: SecureEnvironmentCreateKeyOptions }
  ): Promise<Kms.KmsCreateKeyReturn<Type>> {
    if (options.type.kty !== 'EC') {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(
        `kty ${options.type.kty}. Only EC P-256 supported.`,
        this.backend
      )
    }
    if (options.type.crv !== 'P-256') {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(
        `kty ${options.type.kty} with crv ${options.type.crv}. Only EC P-256 supported.`,
        this.backend
      )
    }

    const keyId = options.keyId ?? utils.uuid()
    const secureEnvironment = await this.secureEnvironment

    try {
      await secureEnvironment.generateKeypair(keyId, options.backendOptions)

      const publicJwk = (await this.getKeyAsserted(keyId)) as Kms.KmsJwkPublic
      return { keyId, publicJwk: publicJwk as Kms.KmsCreateKeyReturn<Type>['publicJwk'] }
    } catch (error) {
      if (error instanceof Kms.KeyManagementError) throw error
      if (error instanceof secureEnvironment.KeyAlreadyExistsError) {
        throw new Kms.KeyManagementKeyExistsError(keyId, this.backend)
      }

      throw new Kms.KeyManagementError('Error creating key', { cause: error })
    }
  }

  public async sign(agentContext: AgentContext, options: Kms.KmsSignOptions): Promise<Kms.KmsSignReturn> {
    if (options.algorithm !== 'ES256') {
      throw new Kms.KeyManagementAlgorithmNotSupportedError(
        `algorithm '${options.algorithm}'. Only 'ES256' supported.`,
        this.backend
      )
    }

    const secureEnvironment = await this.secureEnvironment

    try {
      // TODO: can we store something like 'use' for the key in secure environment?
      // Kms.assertKeyAllowsSign(publicJwk)

      // Perform the signing operation, with the user authentication of `withUserAuthentication` if it covers the key
      const userAuthentication = this.userAuthentications.get(agentContext.contextCorrelationId)
      const signature =
        userAuthentication && (!userAuthentication.keyIds || userAuthentication.keyIds.includes(options.keyId))
          ? await userAuthentication.session.sign(options.keyId, options.data, { prompt: this.getPrompt() })
          : await secureEnvironment.sign(options.keyId, options.data, { prompt: this.getPrompt() })

      return {
        signature,
      }
    } catch (error) {
      if (error instanceof secureEnvironment.KeyNotFoundError) {
        throw new Kms.KeyManagementKeyNotFoundError(options.keyId, [this.backend])
      }

      throw new Kms.KeyManagementError('Error signing with key', { cause: error })
    }
  }

  public async verify(): Promise<Kms.KmsVerifyReturn> {
    throw new Kms.KeyManagementError(`verification of signatures is not supported for backend '${this.backend}'`)
  }

  private publicJwkFromPublicKeyBytes(key: Uint8Array, keyId: string) {
    const publicJwk = Kms.PublicJwk.fromPublicKey<Kms.P256PublicJwk['publicKey']>({
      kty: 'EC',
      crv: 'P-256',
      publicKey: key,
    }).toJson()

    return {
      ...publicJwk,
      kid: keyId,
    } satisfies Kms.KmsJwkPublicEc
  }

  private async getKeyAsserted(keyId: string) {
    const secureEnvironment = await this.secureEnvironment

    try {
      const publicKeyBytes = await secureEnvironment.getPublicBytesForKeyId(keyId)
      return this.publicJwkFromPublicKeyBytes(publicKeyBytes, keyId)
    } catch (error) {
      if (error instanceof secureEnvironment.KeyNotFoundError) {
        throw new Kms.KeyManagementKeyNotFoundError(keyId, [this.backend])
      }

      throw new Kms.KeyManagementError(`Error retrieving key with id '${keyId}' from backend ${this.backend}`, {
        cause: error,
      })
    }
  }
}
