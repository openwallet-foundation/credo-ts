import type { SdJwtCreateOptions, SdJwtPresentOptions, SdJwtReceiveOptions, SdJwtVerifyOptions } from './SdJwtOptions'
import type { AgentContext, Key } from '@aries-framework/core'
import type { Signer } from 'jwt-sd'
import type { Verifier } from 'jwt-sd/build/sdJwt'

import {
  getJwkFromKey,
  Hasher,
  inject,
  injectable,
  InjectionSymbols,
  Logger,
  TypedArrayEncoder,
  Buffer,
  getJwaFromKeyType,
} from '@aries-framework/core'
import { SdJwtVc, HasherAlgorithm, SdJwt } from 'jwt-sd'

export { SdJwt }

import { SdJwtError } from './SdJwtError'
import { SdJwtRecord } from './repository/SdJwtRecord'

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
    payload: Payload,
    { issuerKey, disclosureFrame, hashingAlgorithm = 'sha2-256', holderBinding, issuerDid }: SdJwtCreateOptions<Payload>
  ): Promise<{ sdJwtRecord: SdJwtRecord; compact: string }> {
    if (hashingAlgorithm !== 'sha2-256') {
      throw new SdJwtError(`Unsupported hashing algorithm used: ${hashingAlgorithm}`)
    }

    // TODO: change getJwaFromKeyType to be according to the comments
    const header = {
      alg: getJwaFromKeyType(issuerKey.keyType).toString(),
      typ: 'vc+sd-jwt',
    }

    const sdJwtVc = new SdJwtVc<typeof header, Payload>({}, { disclosureFrame })
      .withHasher({ hasher: this.hasher, algorithm: HasherAlgorithm.Sha256 })
      .withSigner(this.signer(agentContext, issuerKey))
      .withSaltGenerator(agentContext.wallet.generateNonce)
      .withHeader(header)
      .withPayload({ ...payload })

    // Add the `cnf` claim for the holder key binding
    // TODO: deal with holderBinding being a `did`
    const confirmationClaim = getJwkFromKey(holderBinding as Key).toJson()
    sdJwtVc.addPayloadClaim('cnf', { jwk: confirmationClaim })

    // Add the issuer DID as the `iss` claim
    sdJwtVc.addPayloadClaim('iss', issuerDid)

    // Add the issued at (iat) claim
    sdJwtVc.addPayloadClaim('iat', Math.floor(new Date().getTime() / 1000))

    const compact = await sdJwtVc.toCompact()

    return {
      sdJwtRecord: new SdJwtRecord<typeof header, Payload>({
        sdJwt: {
          header: sdJwtVc.header,
          payload: sdJwtVc.payload,
          disclosures: sdJwtVc.disclosures?.map((d) => d.decoded),
        },
      }),
      compact,
    }
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
