import type { SdJwtCreateOptions, SdJwtPresentOptions, SdJwtReceiveOptions, SdJwtVerifyOptions } from './SdJwtOptions'
import type { AgentContext, JwkJson } from '@aries-framework/core'
import type { Signer, SdJwtVcVerificationResult, Verifier, HasherAndAlgorithm } from 'jwt-sd'

import {
  DidResolverService,
  getJwaFromKey,
  getKeyFromVerificationMethod,
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
} from '@aries-framework/core'
import { KeyBinding, SdJwtVc, HasherAlgorithm, SdJwt, Disclosure } from 'jwt-sd'

import { SdJwtError } from './SdJwtError'
import { SdJwtRepository, SdJwtRecord } from './repository'

export { SdJwt, SdJwtVcVerificationResult }

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

  private async resolveDidUrl(agentContext: AgentContext, didUrl: string) {
    const didResolver = agentContext.dependencyManager.resolve(DidResolverService)
    const didDocument = await didResolver.resolveDidDocument(agentContext, didUrl)

    return { verificationMethod: didDocument.dereferenceKey(didUrl), didDocument }
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
        if (!('kty' in publicKeyJwk)) {
          throw new SdJwtError(
            'Key type (kty) claim could not be found in the JWK of the confirmation (cnf) claim. Only JWK is supported right now'
          )
        }

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
    {
      issuerDidUrl,
      holderDidUrl,
      disclosureFrame,
      hashingAlgorithm = 'sha2-256',
      issuerOverrideJsonWebAlgorithm,
    }: SdJwtCreateOptions<Payload>
  ): Promise<{ sdJwtRecord: SdJwtRecord; compact: string }> {
    if (hashingAlgorithm !== 'sha2-256') {
      throw new SdJwtError(`Unsupported hashing algorithm used: ${hashingAlgorithm}`)
    }

    const issuerKeyId = issuerDidUrl.split('#')[1]
    if (!issuerKeyId) {
      throw new SdJwtError(
        `issuer did url '${issuerDidUrl}' does not contain a '#'. Unable to derive key from did document`
      )
    }

    // TODO: here we retrieve the key instance from the DID, but this will only contain a reference to the public key.
    // Does askar automatically check if there is an associated private key locally?
    // This would fail in any other case.
    const { verificationMethod: issuerVerificationMethod, didDocument: issuerDidDocument } = await this.resolveDidUrl(
      agentContext,
      issuerDidUrl
    )
    const issuerKey = getKeyFromVerificationMethod(issuerVerificationMethod)
    const alg = getJwaFromKey(issuerKey, issuerOverrideJsonWebAlgorithm)

    const { verificationMethod: holderVerificationMethod } = await this.resolveDidUrl(agentContext, holderDidUrl)
    const holderKey = getKeyFromVerificationMethod(holderVerificationMethod)
    const holderKeyJwk = getJwkFromKey(holderKey).toJson()

    const header = {
      alg: alg.toString(),
      typ: 'vc+sd-jwt',
      kid: issuerKeyId,
    }

    const sdJwtVc = new SdJwtVc<typeof header, Payload>({}, { disclosureFrame })
      .withHasher(this.hasher)
      .withSigner(this.signer(agentContext, issuerKey))
      .withSaltGenerator(agentContext.wallet.generateNonce)
      .withHeader(header)
      .withPayload({ ...payload })

    // Add the `cnf` claim for the holder key binding
    sdJwtVc.addPayloadClaim('cnf', { jwk: holderKeyJwk })

    // Add the issuer DID as the `iss` claim
    sdJwtVc.addPayloadClaim('iss', issuerDidDocument.id)

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
    { issuerDidUrl, holderDidUrl }: SdJwtReceiveOptions
  ): Promise<SdJwtRecord> {
    const sdJwt = SdJwtVc.fromCompact<Header, Payload>(sdJwtCompact)

    if (!sdJwt.signature) {
      throw new SdJwtError('A signature must be included for an sd-jwt')
    }

    const { verificationMethod: issuerVerificationMethod } = await this.resolveDidUrl(agentContext, issuerDidUrl)
    const issuerKey = getKeyFromVerificationMethod(issuerVerificationMethod)

    const isSignatureValid = await sdJwt.verifySignature(this.verifier(agentContext, issuerKey))

    if (!isSignatureValid) {
      throw new SdJwtError('sd-jwt has an invalid signature from the issuer')
    }

    const { verificationMethod: holderVerificiationMethod } = await this.resolveDidUrl(agentContext, holderDidUrl)
    const holderKey = getKeyFromVerificationMethod(holderVerificiationMethod)
    const holderKeyJwk = getJwkFromKey(holderKey).toJson()

    sdJwt.assertClaimInPayload('cnf', { jwk: holderKeyJwk })

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
    { includedDisclosureIndices, holderDidUrl, verifierMetadata, holderOverrideJsonWebAlgorithm }: SdJwtPresentOptions
  ): Promise<string> {
    const { verificationMethod: holderVerificationMethod } = await this.resolveDidUrl(agentContext, holderDidUrl)
    const holderKey = getKeyFromVerificationMethod(holderVerificationMethod)
    const alg = getJwaFromKey(holderKey, holderOverrideJsonWebAlgorithm)

    const header = {
      alg: alg.toString(),
      typ: 'kb+jwt',
    } as const

    const payload = {
      iat: verifierMetadata.issuedAt,
      nonce: verifierMetadata.nonce,
      aud: verifierMetadata.verifierDid,
    }

    const keyBinding = new KeyBinding<Record<string, unknown>, Record<string, unknown>>({ header, payload }).withSigner(
      this.signer(agentContext, holderKey)
    )

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
    { verifierDid, requiredClaimKeys, holderDidUrl, issuerDidUrl }: SdJwtVerifyOptions
  ): Promise<{ sdJwtRecord: SdJwtRecord<Header, Payload>; validation: SdJwtVcVerificationResult }> {
    const sdJwt = SdJwtVc.fromCompact<Header, Payload>(sdJwtCompact)

    if (!sdJwt.signature) {
      throw new SdJwtError('A signature is required for verification of the sd-jwt-vc')
    }

    if (!sdJwt.keyBinding || !sdJwt.keyBinding.payload) {
      throw new SdJwtError('Keybinding is required for verification of the sd-jwt-vc')
    }

    const { verificationMethod: holderVerificationMethod } = await this.resolveDidUrl(agentContext, holderDidUrl)
    const holderKey = getKeyFromVerificationMethod(holderVerificationMethod)
    const holderKeyJwk = getJwkFromKey(holderKey).toJson()

    const { verificationMethod: issuerVerificationMethod } = await this.resolveDidUrl(agentContext, issuerDidUrl)
    const issuerKey = getKeyFromVerificationMethod(issuerVerificationMethod)

    sdJwt.keyBinding.assertClaimInPayload('aud', verifierDid)
    sdJwt.assertClaimInPayload('cnf', { jwk: holderKeyJwk })

    // TODO: is there a more AFJ way of doing this?
    const [did, keyId] = issuerDidUrl.split('#')
    sdJwt.assertClaimInHeader('kid', keyId)
    sdJwt.assertClaimInPayload('iss', did)

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
