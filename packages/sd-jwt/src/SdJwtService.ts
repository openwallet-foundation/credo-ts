import type { AgentContext, HashName, Key } from '@aries-framework/core'
import type { Signer } from 'jwt-sd'
import type { DisclosureFrame, Verifier } from 'jwt-sd/build/sdJwt/types'

import {
  getJwkFromKey,
  Jwt,
  Hasher,
  inject,
  injectable,
  InjectionSymbols,
  Logger,
  TypedArrayEncoder,
  Buffer,
  getJwaFromKeyType,
} from '@aries-framework/core'
import { HasherAlgorithm, SdJwt } from 'jwt-sd'

export { SdJwt }

import { SdJwtError } from './SdJwtError'
import { SdJwtRecord } from './repository/SdJwtRecord'

export type SdJwtCreateOptions<Payload extends Record<string, unknown> = Record<string, unknown>> = {
  disclosureFrame?: DisclosureFrame<Payload>
  issuerKey: Key
  holderKey?: Key
  hashingAlgorithm?: HashName
}

export type SdJwtReceiveOptions = {
  issuerKey: Key
  holderKey?: Key
}

export type SdJwtPresentOptions = {
  includedDisclosureIndices?: Array<number>
  includeHolderKey?: boolean
}

/**
 * @todo combine requiredClaims and requiredDisclosedClaims
 */
export type SdJwtVerifyOptions = {
  requiredClaims?: Array<string>
  holderKey?: Key
}

export type SdJwtVerificationResult = {
  isValid: boolean
  isSignatureValid: boolean
  areRequiredClaimsIncluded?: boolean
  areDisclosedClaimsIncluded?: boolean
}

/**
 * @internal
 */
@injectable()
export class SdJwtService {
  private logger: Logger

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger) {
    this.logger = logger
  }

  private hasher(input: string) {
    const serializedInput = TypedArrayEncoder.fromString(input)
    const hash = Hasher.hash(serializedInput, 'sha2-256')

    return TypedArrayEncoder.toBase64URL(hash)
  }

  /**
   * @todo validate the JWT header (alg)
   */
  private signer<Header extends Record<string, unknown> = Record<string, unknown>>(
    agentContext: AgentContext,
    key: Key
  ): Signer<Header> {
    return async (input: string) => agentContext.wallet.sign({ key, data: TypedArrayEncoder.fromString(input) })
  }

  /**
   * @todo validate the JWT header (alg)
   */
  private verifier<Header extends Record<string, unknown> = Record<string, unknown>>(
    agentContext: AgentContext,
    issuerKey: Key
  ): Verifier<Header> {
    return async ({ message, signature }) => {
      return await agentContext.wallet.verify({
        signature: Buffer.from(signature),
        key: issuerKey,
        data: TypedArrayEncoder.fromString(message),
      })
    }
  }

  public async create<Payload extends Record<string, unknown> = Record<string, unknown>>(
    agentContext: AgentContext,
    jwt: Jwt | Payload,
    { issuerKey, disclosureFrame, hashingAlgorithm = 'sha2-256', holderKey }: SdJwtCreateOptions<Payload>
  ): Promise<SdJwtRecord> {
    if (hashingAlgorithm !== 'sha2-256') {
      throw new SdJwtError(`Unsupported hashing algorithm used: ${hashingAlgorithm}`)
    }

    const { header, payload } =
      jwt instanceof Jwt
        ? { header: jwt.header, payload: jwt.payload.toJson() }
        : {
            header: { alg: getJwaFromKeyType(issuerKey.keyType).toString() },
            payload: jwt,
          }

    const confirmationClaim = holderKey ? getJwkFromKey(holderKey).toJson() : undefined

    let sdJwt = new SdJwt<typeof header, typeof payload>()
      .withHeader(header)
      .withPayload(payload)
      .withHasher({ hasher: this.hasher, algorithm: HasherAlgorithm.Sha256 })
      .withSigner(this.signer(agentContext, issuerKey))
      .withSaltGenerator(agentContext.wallet.generateNonce)

    sdJwt = confirmationClaim ? sdJwt.addPayloadClaim('cnf', confirmationClaim) : sdJwt
    sdJwt = disclosureFrame ? sdJwt.withDisclosureFrame(disclosureFrame) : sdJwt

    const compact = await sdJwt.toCompact()

    return new SdJwtRecord({
      sdJwt: compact,
    })
  }

  /**
   * @todo Name is not the best
   * @todo fix with the newer API
   */
  public async receive(
    agentContext: AgentContext,
    sdJwt: SdJwt,
    { holderKey, issuerKey }: SdJwtReceiveOptions
  ): Promise<SdJwtRecord> {
    const isValid = await sdJwt.verifySignature(this.verifier(agentContext, issuerKey))

    if (!isValid) {
      throw new SdJwtError(`sd-jwt is not valid.`)
    }

    // TODO: append holder key here
    const compact = await sdJwt.toCompact()

    return new SdJwtRecord({
      sdJwt: compact,
    })
  }

  public async present(
    agentContext: AgentContext,
    sdJwt: SdJwt,
    { includedDisclosureIndices }: SdJwtPresentOptions
  ): Promise<string> {
    return 'header.payload.signature~disclosure_0~disclosure_1~key_binding'
  }

  public async verify(
    agentContext: AgentContext,
    sdJwt: SdJwt | string,
    { holderKey, requiredClaims }: SdJwtVerifyOptions
  ): Promise<SdJwtVerificationResult> {
    return {
      isValid: true,
      isSignatureValid: true,
      areRequiredClaimsIncluded: true,
      areDisclosedClaimsIncluded: true,
    }
  }
}
