import type { Jws, JwsGeneralFormat, JwsProtectedHeader, JwsProtectedHeaderOptions } from './JwsTypes'
import type { Key } from './Key'
import type { Jwk } from './jose/jwk'
import type { AgentContext } from '../agent'
import type { Buffer } from '../utils'

import { AriesFrameworkError } from '../error'
import { getKeyFromVerificationMethod } from '../modules/dids/domain/key-type/keyDidMapping'
import { DidKey } from '../modules/dids/methods/key/DidKey'
import { DidResolverService } from '../modules/dids/services/DidResolverService'
import { injectable } from '../plugins'
import { isDid, JsonEncoder, TypedArrayEncoder } from '../utils'
import { WalletError } from '../wallet/error'

import { getJwkFromJson, getJwkFromKey } from './jose/jwk'

@injectable()
export class JwsService {
  private async createJwsBase(agentContext: AgentContext, options: CreateJwsBaseOptions) {
    const { jwk, alg } = options.protectedHeaderOptions
    const keyJwk = getJwkFromKey(options.key)

    // Make sure the options.key and jwk from protectedHeader are the same.
    if (jwk && (jwk.key.keyType !== options.key.keyType || !jwk.key.publicKey.equals(options.key.publicKey))) {
      throw new AriesFrameworkError(`Protected header JWK does not match key for signing.`)
    }

    // Validate the options.key used for signing against the jws options
    // We use keyJwk instead of jwk, as the user could also use kid instead of jwk
    if (keyJwk && !keyJwk.supportsSignatureAlgorithm(alg)) {
      throw new AriesFrameworkError(
        `alg '${alg}' is not a valid JWA signature algorithm for this jwk. Supported algorithms are ${keyJwk.supportedSignatureAlgorithms.join(
          ', '
        )}`
      )
    }

    const base64Payload = TypedArrayEncoder.toBase64URL(options.payload)
    const base64UrlProtectedHeader = JsonEncoder.toBase64URL(this.buildProtected(options.protectedHeaderOptions))

    const signature = TypedArrayEncoder.toBase64URL(
      await agentContext.wallet.sign({
        data: TypedArrayEncoder.fromString(`${base64UrlProtectedHeader}.${base64Payload}`),
        key: options.key,
      })
    )

    return {
      base64Payload,
      base64UrlProtectedHeader,
      signature,
    }
  }

  public async createJws(
    agentContext: AgentContext,
    { payload, key, header, protectedHeaderOptions }: CreateJwsOptions
  ): Promise<JwsGeneralFormat> {
    const { base64UrlProtectedHeader, signature } = await this.createJwsBase(agentContext, {
      payload,
      key,
      protectedHeaderOptions,
    })

    return {
      protected: base64UrlProtectedHeader,
      signature,
      header,
    }
  }

  /**
   *  @see {@link https://www.rfc-editor.org/rfc/rfc7515#section-3.1}
   * */
  public async createJwsCompact(
    agentContext: AgentContext,
    { payload, key, protectedHeaderOptions }: CreateCompactJwsOptions
  ): Promise<string> {
    const { base64Payload, base64UrlProtectedHeader, signature } = await this.createJwsBase(agentContext, {
      payload,
      key,
      protectedHeaderOptions,
    })
    return `${base64UrlProtectedHeader}.${base64Payload}.${signature}`
  }

  /**
   * Verify a JWS
   */
  public async verifyJws(agentContext: AgentContext, { jws, payload }: VerifyJwsOptions): Promise<VerifyJwsResult> {
    const base64Payload = TypedArrayEncoder.toBase64URL(payload)
    const signatures = 'signatures' in jws ? jws.signatures : [jws]

    if (signatures.length === 0) {
      throw new AriesFrameworkError('Unable to verify JWS: No entries in JWS signatures array.')
    }

    const signerKeys: Key[] = []
    for (const jws of signatures) {
      const protectedJson: JwsProtectedHeader = JsonEncoder.fromBase64(jws.protected)

      const jwk = await this.jwkFromProtectedHeader(agentContext, protectedJson)
      if (!jwk.supportsSignatureAlgorithm(protectedJson.alg)) {
        throw new AriesFrameworkError(
          `alg '${
            protectedJson.alg
          }' is not a valid JWA signature algorithm for this jwk. Supported algorithms are ${jwk.supportedSignatureAlgorithms.join(
            ', '
          )}`
        )
      }

      const data = TypedArrayEncoder.fromString(`${jws.protected}.${base64Payload}`)
      const signature = TypedArrayEncoder.fromBase64(jws.signature)
      signerKeys.push(jwk.key)

      try {
        const isValid = await agentContext.wallet.verify({ key: jwk.key, data, signature })

        if (!isValid) {
          return {
            isValid: false,
            signerKeys: [],
          }
        }
      } catch (error) {
        // WalletError probably means signature verification failed. Would be useful to add
        // more specific error type in wallet.verify method
        if (error instanceof WalletError) {
          return {
            isValid: false,
            signerKeys: [],
          }
        }

        throw error
      }
    }

    return { isValid: true, signerKeys }
  }

  private buildProtected(options: JwsProtectedHeaderOptions) {
    if (!options.jwk && !options.kid) {
      throw new AriesFrameworkError('Both JWK and kid are undefined. Please provide one or the other.')
    }
    if (options.jwk && options.kid) {
      throw new AriesFrameworkError('Both JWK and kid are provided. Please only provide one of the two.')
    }

    return {
      ...options,
      alg: options.alg,
      jwk: options.jwk?.toJson(),
      kid: options.kid,
    }
  }

  private async jwkFromProtectedHeader(agentContext: AgentContext, protectedHeader: JwsProtectedHeader): Promise<Jwk> {
    if (protectedHeader.jwk && protectedHeader.kid) {
      throw new AriesFrameworkError(
        'Both JWK and kid are defined in the protected header. Only one of the two is allowed.'
      )
    }

    // Jwk
    if (protectedHeader.jwk) {
      return getJwkFromJson(protectedHeader.jwk)
    }

    // Kid
    if (protectedHeader.kid) {
      if (!isDid(protectedHeader.kid)) {
        throw new AriesFrameworkError(
          `Only DIDs are supported as the 'kid' parameter for JWS. '${protectedHeader.kid}' is not a did.`
        )
      }

      const didResolver = agentContext.dependencyManager.resolve(DidResolverService)
      const didDocument = await didResolver.resolveDidDocument(agentContext, protectedHeader.kid)

      // This is a special case for Aries RFC 0017 signed attachments. It allows a did:key without a keyId to be used kid
      // https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0017-attachments/README.md#signing-attachments
      if (isDid(protectedHeader.kid, 'key') && !protectedHeader.kid.includes('#')) {
        return getJwkFromKey(DidKey.fromDid(protectedHeader.kid).key)
      }

      return getJwkFromKey(
        getKeyFromVerificationMethod(didDocument.dereferenceKey(protectedHeader.kid, ['authentication']))
      )
    }

    throw new AriesFrameworkError('Both JWK and kid are undefined. Protected header must contain one of the two.')
  }
}

export interface CreateJwsOptions {
  key: Key
  payload: Buffer
  header: Record<string, unknown>
  protectedHeaderOptions: JwsProtectedHeaderOptions
}

type CreateJwsBaseOptions = Omit<CreateJwsOptions, 'header'>
type CreateCompactJwsOptions = Omit<CreateJwsOptions, 'header'>

export interface VerifyJwsOptions {
  jws: Jws
  payload: Buffer
}

export interface VerifyJwsResult {
  isValid: boolean
  signerKeys: Key[]
}
