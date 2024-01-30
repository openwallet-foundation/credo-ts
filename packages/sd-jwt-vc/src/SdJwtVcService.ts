import type {
  SdJwtVcCreateOptions,
  SdJwtVcPresentOptions,
  SdJwtVcReceiveOptions,
  SdJwtVcVerifyOptions,
} from './SdJwtVcOptions'
import type { AgentContext, JwkJson, Query } from '@credo-ts/core'
import type { Signer, SdJwtVcVerificationResult, Verifier, HasherAndAlgorithm } from 'jwt-sd'

import {
  parseDid,
  DidResolverService,
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
} from '@credo-ts/core'
import { KeyBinding, SdJwtVc, HasherAlgorithm, Disclosure } from 'jwt-sd'

import { SdJwtVcError } from './SdJwtVcError'
import { SdJwtVcRepository, SdJwtVcRecord } from './repository'

export { SdJwtVcVerificationResult }

/**
 * @internal
 */
@injectable()
export class SdJwtVcService {
  private logger: Logger
  private sdJwtVcRepository: SdJwtVcRepository

  public constructor(sdJwtVcRepository: SdJwtVcRepository, @inject(InjectionSymbols.Logger) logger: Logger) {
    this.sdJwtVcRepository = sdJwtVcRepository
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
        return Hasher.hash(serializedInput, 'sha2-256')
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
          throw new SdJwtVcError(
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
      jsonWebAlgorithm,
    }: SdJwtVcCreateOptions<Payload>
  ): Promise<{ sdJwtVcRecord: SdJwtVcRecord; compact: string }> {
    if (hashingAlgorithm !== 'sha2-256') {
      throw new SdJwtVcError(`Unsupported hashing algorithm used: ${hashingAlgorithm}`)
    }

    const parsedDid = parseDid(issuerDidUrl)
    if (!parsedDid.fragment) {
      throw new SdJwtVcError(
        `issuer did url '${issuerDidUrl}' does not contain a '#'. Unable to derive key from did document`
      )
    }

    const { verificationMethod: issuerVerificationMethod, didDocument: issuerDidDocument } = await this.resolveDidUrl(
      agentContext,
      issuerDidUrl
    )
    const issuerKey = getKeyFromVerificationMethod(issuerVerificationMethod)
    const alg = jsonWebAlgorithm ?? getJwkFromKey(issuerKey).supportedSignatureAlgorithms[0]

    const { verificationMethod: holderVerificationMethod } = await this.resolveDidUrl(agentContext, holderDidUrl)
    const holderKey = getKeyFromVerificationMethod(holderVerificationMethod)
    const holderKeyJwk = getJwkFromKey(holderKey).toJson()

    const header = {
      alg: alg.toString(),
      typ: 'vc+sd-jwt',
      kid: parsedDid.fragment,
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
      throw new SdJwtVcError('Invalid sd-jwt-vc state. Signature should have been set when calling `toCompact`.')
    }

    const sdJwtVcRecord = new SdJwtVcRecord<typeof header, Payload>({
      sdJwtVc: {
        header: sdJwtVc.header,
        payload: sdJwtVc.payload,
        signature: sdJwtVc.signature,
        disclosures: sdJwtVc.disclosures?.map((d) => d.decoded),
        holderDidUrl,
      },
    })

    await this.sdJwtVcRepository.save(agentContext, sdJwtVcRecord)

    return {
      sdJwtVcRecord,
      compact,
    }
  }

  public async storeCredential<
    Header extends Record<string, unknown> = Record<string, unknown>,
    Payload extends Record<string, unknown> = Record<string, unknown>
  >(
    agentContext: AgentContext,
    sdJwtVcCompact: string,
    { issuerDidUrl, holderDidUrl }: SdJwtVcReceiveOptions
  ): Promise<SdJwtVcRecord> {
    const sdJwtVc = SdJwtVc.fromCompact<Header, Payload>(sdJwtVcCompact)

    if (!sdJwtVc.signature) {
      throw new SdJwtVcError('A signature must be included for an sd-jwt-vc')
    }

    const { verificationMethod: issuerVerificationMethod } = await this.resolveDidUrl(agentContext, issuerDidUrl)
    const issuerKey = getKeyFromVerificationMethod(issuerVerificationMethod)

    const { isSignatureValid } = await sdJwtVc.verify(this.verifier(agentContext, issuerKey))

    if (!isSignatureValid) {
      throw new SdJwtVcError('sd-jwt-vc has an invalid signature from the issuer')
    }

    const { verificationMethod: holderVerificiationMethod } = await this.resolveDidUrl(agentContext, holderDidUrl)
    const holderKey = getKeyFromVerificationMethod(holderVerificiationMethod)
    const holderKeyJwk = getJwkFromKey(holderKey).toJson()

    sdJwtVc.assertClaimInPayload('cnf', { jwk: holderKeyJwk })

    const sdJwtVcRecord = new SdJwtVcRecord<Header, Payload>({
      sdJwtVc: {
        header: sdJwtVc.header,
        payload: sdJwtVc.payload,
        signature: sdJwtVc.signature,
        disclosures: sdJwtVc.disclosures?.map((d) => d.decoded),
        holderDidUrl,
      },
    })

    await this.sdJwtVcRepository.save(agentContext, sdJwtVcRecord)

    return sdJwtVcRecord
  }

  public async present(
    agentContext: AgentContext,
    sdJwtVcRecord: SdJwtVcRecord,
    { includedDisclosureIndices, verifierMetadata, jsonWebAlgorithm }: SdJwtVcPresentOptions
  ): Promise<string> {
    const { verificationMethod: holderVerificationMethod } = await this.resolveDidUrl(
      agentContext,
      sdJwtVcRecord.sdJwtVc.holderDidUrl
    )
    const holderKey = getKeyFromVerificationMethod(holderVerificationMethod)
    const alg = jsonWebAlgorithm ?? getJwkFromKey(holderKey).supportedSignatureAlgorithms[0]

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

    const sdJwtVc = new SdJwtVc({
      header: sdJwtVcRecord.sdJwtVc.header,
      payload: sdJwtVcRecord.sdJwtVc.payload,
      signature: sdJwtVcRecord.sdJwtVc.signature,
      disclosures: sdJwtVcRecord.sdJwtVc.disclosures?.map(Disclosure.fromArray),
    }).withKeyBinding(keyBinding)

    return await sdJwtVc.present(includedDisclosureIndices)
  }

  public async verify<
    Header extends Record<string, unknown> = Record<string, unknown>,
    Payload extends Record<string, unknown> = Record<string, unknown>
  >(
    agentContext: AgentContext,
    sdJwtVcCompact: string,
    { challenge: { verifierDid }, requiredClaimKeys, holderDidUrl }: SdJwtVcVerifyOptions
  ): Promise<{ sdJwtVcRecord: SdJwtVcRecord<Header, Payload>; validation: SdJwtVcVerificationResult }> {
    const sdJwtVc = SdJwtVc.fromCompact<Header, Payload>(sdJwtVcCompact)

    if (!sdJwtVc.signature) {
      throw new SdJwtVcError('A signature is required for verification of the sd-jwt-vc')
    }

    if (!sdJwtVc.keyBinding || !sdJwtVc.keyBinding.payload) {
      throw new SdJwtVcError('Keybinding is required for verification of the sd-jwt-vc')
    }

    sdJwtVc.keyBinding.assertClaimInPayload('aud', verifierDid)

    const { verificationMethod: holderVerificationMethod } = await this.resolveDidUrl(agentContext, holderDidUrl)
    const holderKey = getKeyFromVerificationMethod(holderVerificationMethod)
    const holderKeyJwk = getJwkFromKey(holderKey).toJson()

    sdJwtVc.assertClaimInPayload('cnf', { jwk: holderKeyJwk })

    sdJwtVc.assertClaimInHeader('kid')
    sdJwtVc.assertClaimInPayload('iss')

    const issuerKid = sdJwtVc.getClaimInHeader<string>('kid')
    const issuerDid = sdJwtVc.getClaimInPayload<string>('iss')

    // TODO: is there a more AFJ way of doing this?
    const issuerDidUrl = `${issuerDid}#${issuerKid}`

    const { verificationMethod: issuerVerificationMethod } = await this.resolveDidUrl(agentContext, issuerDidUrl)
    const issuerKey = getKeyFromVerificationMethod(issuerVerificationMethod)

    const verificationResult = await sdJwtVc.verify(this.verifier(agentContext, issuerKey), requiredClaimKeys)

    const sdJwtVcRecord = new SdJwtVcRecord({
      sdJwtVc: {
        signature: sdJwtVc.signature,
        payload: sdJwtVc.payload,
        disclosures: sdJwtVc.disclosures?.map((d) => d.decoded),
        header: sdJwtVc.header,
        holderDidUrl,
      },
    })

    await this.sdJwtVcRepository.save(agentContext, sdJwtVcRecord)

    return {
      sdJwtVcRecord,
      validation: verificationResult,
    }
  }

  public async getCredentialRecordById(agentContext: AgentContext, id: string): Promise<SdJwtVcRecord> {
    return await this.sdJwtVcRepository.getById(agentContext, id)
  }

  public async getAllCredentialRecords(agentContext: AgentContext): Promise<Array<SdJwtVcRecord>> {
    return await this.sdJwtVcRepository.getAll(agentContext)
  }

  public async findCredentialRecordsByQuery(
    agentContext: AgentContext,
    query: Query<SdJwtVcRecord>
  ): Promise<Array<SdJwtVcRecord>> {
    return await this.sdJwtVcRepository.findByQuery(agentContext, query)
  }

  public async removeCredentialRecord(agentContext: AgentContext, id: string) {
    await this.sdJwtVcRepository.deleteById(agentContext, id)
  }

  public async updateCredentialRecord(agentContext: AgentContext, sdJwtVcRecord: SdJwtVcRecord) {
    await this.sdJwtVcRepository.update(agentContext, sdJwtVcRecord)
  }
}
