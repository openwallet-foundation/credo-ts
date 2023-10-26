import type { SdJwtCreateOptions, SdJwtPresentOptions, SdJwtReceiveOptions, SdJwtVerifyOptions } from './SdJwtOptions'
import type { AgentContext, JwkJson } from '@aries-framework/core'
import type { Signer, SdJwtVcVerificationResult, Verifier, HasherAndAlgorithm } from 'jwt-sd'

import {
  getJwkFromJson,
  Key,
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
import { KeyBinding, SdJwtVc, HasherAlgorithm, SdJwt, Disclosure } from 'jwt-sd'

export { SdJwt, SdJwtVcVerificationResult }

import { SdJwtError } from './SdJwtError'
import { SdJwtRepository, SdJwtRecord } from './repository'

/**
 * @internal
 */
@injectable()
export class SdJwtService {
  private logger: Logger
  private sdJwtRepository: SdJwtRepository

  public constructor(sdJwtRepository: SdJwtRepository, @inject(InjectionSymbols.Logger) logger: Logger) {
    this.sdJwtRepository = sdJwtRepository
    this.logger = logger
  }

  private get hasher(): HasherAndAlgorithm {
    return {
      algorithm: HasherAlgorithm.Sha256,
      hasher: (input: string) => {
        const serializedInput = TypedArrayEncoder.fromString(input)
        const hash = Hasher.hash(serializedInput, 'sha2-256')

        return TypedArrayEncoder.toBase64URL(hash)
      },
    }
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
    signerKey: Key
  ): Verifier<Header> {
    return async ({ message, signature, publicKeyJwk }) => {
      let key = signerKey

      if (publicKeyJwk) {
        const jwk = getJwkFromJson(publicKeyJwk as JwkJson)
        key = Key.fromPublicKey(jwk.publicKey, jwk.keyType)
      }

      return await agentContext.wallet.verify({
        signature: Buffer.from(signature),
        key: key,
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
      .withHasher(this.hasher)
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

    if (!sdJwtVc.signature) {
      throw new SdJwtError('Invalid sd-jwt state. Signature should have been set when calling `toCompact`.')
    }

    const sdJwtRecord = new SdJwtRecord<typeof header, Payload>({
      sdJwt: {
        header: sdJwtVc.header,
        payload: sdJwtVc.payload,
        signature: sdJwtVc.signature,
        disclosures: sdJwtVc.disclosures?.map((d) => d.decoded),
      },
    })

    await this.sdJwtRepository.save(agentContext, sdJwtRecord)

    return {
      sdJwtRecord,
      compact,
    }
  }

  public async receive<
    Header extends Record<string, unknown> = Record<string, unknown>,
    Payload extends Record<string, unknown> = Record<string, unknown>
  >(
    agentContext: AgentContext,
    sdJwtCompact: string,
    { issuerKey, holderKey }: SdJwtReceiveOptions
  ): Promise<SdJwtRecord> {
    const sdJwt = SdJwtVc.fromCompact<Header, Payload>(sdJwtCompact)

    if (!sdJwt.signature) {
      throw new SdJwtError('A signature must be included for an sd-jwt')
    }

    const isSignatureValid = await sdJwt.verifySignature(this.verifier(agentContext, issuerKey))

    if (!isSignatureValid) {
      throw new SdJwtError('sd-jwt has an invalid signature from the issuer')
    }

    const holderJwk = getJwkFromKey(holderKey).toJson()

    sdJwt.assertClaimInPayload('cnf', { jwk: holderJwk })

    const sdJwtRecord = new SdJwtRecord<Header, Payload>({
      sdJwt: {
        header: sdJwt.header,
        payload: sdJwt.payload,
        signature: sdJwt.signature,
        disclosures: sdJwt.disclosures?.map((d) => d.decoded),
      },
    })

    await this.sdJwtRepository.save(agentContext, sdJwtRecord)

    return sdJwtRecord
  }

  public async present(
    agentContext: AgentContext,
    sdJwtRecord: SdJwtRecord,
    { includedDisclosureIndices, holderKey, verifierMetadata }: SdJwtPresentOptions
  ): Promise<string> {
    // TODO: change getJwaFromKeyType to be according to the comments
    const header = {
      alg: getJwaFromKeyType(holderKey.keyType).toString(),
      typ: 'kb+jwt',
    } as const

    const payload = {
      iat: verifierMetadata.issuedAt,
      nonce: verifierMetadata.nonce,
      aud: verifierMetadata.audienceDid,
    }

    const keyBinding = new KeyBinding({ header, payload }).withSigner(this.signer(agentContext, holderKey))

    const sdJwt = new SdJwtVc({
      header: sdJwtRecord.sdJwt.header,
      payload: sdJwtRecord.sdJwt.payload,
      signature: sdJwtRecord.sdJwt.signature,
      disclosures: sdJwtRecord.sdJwt.disclosures?.map(Disclosure.fromArray),
    }).withKeyBinding(keyBinding)

    return await sdJwt.present(includedDisclosureIndices)
  }

  public async verify<
    Header extends Record<string, unknown> = Record<string, unknown>,
    Payload extends Record<string, unknown> = Record<string, unknown>
  >(
    agentContext: AgentContext,
    sdJwtCompact: string,
    { holderKey, verifierDid, issuerKey, requiredClaimKeys }: SdJwtVerifyOptions
  ): Promise<{ sdJwtRecord: SdJwtRecord<Header, Payload>; validation: SdJwtVcVerificationResult }> {
    const sdJwt = SdJwtVc.fromCompact<Header, Payload>(sdJwtCompact)

    if (!sdJwt.signature) {
      throw new SdJwtError('A signature is required for verification of the sd-jwt')
    }

    if (!sdJwt.keyBinding || !sdJwt.keyBinding.payload) {
      throw new SdJwtError('Keybinding is required for verification of the sd-jwt-vc')
    }

    sdJwt.keyBinding.assertClaimInPayload('aud', verifierDid)

    const verificationResult = await sdJwt.verify(this.verifier(agentContext, issuerKey), requiredClaimKeys)

    const sdJwtRecord = new SdJwtRecord({
      sdJwt: {
        signature: sdJwt.signature,
        payload: sdJwt.payload,
        disclosures: sdJwt.disclosures?.map((d) => d.decoded),
        header: sdJwt.header,
      },
    })

    await this.sdJwtRepository.save(agentContext, sdJwtRecord)

    return {
      sdJwtRecord,
      validation: verificationResult,
    }
  }
}
