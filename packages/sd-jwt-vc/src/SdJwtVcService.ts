import type { SdJwtCredential } from './SdJwtCredential'
import type {
  SdJwtVcCreateOptions,
  SdJwtVcPresentOptions,
  SdJwtVcFromSerializedJwtOptions,
  SdJwtVcVerifyOptions,
  SdJwtVcPayload,
  SdJwtVcHeader,
} from './SdJwtVcOptions'
import type { AgentContext, JwkJson, Query } from '@aries-framework/core'
import type { Signer, SdJwtVcVerificationResult, Verifier, HasherAndAlgorithm } from '@sd-jwt/core'

import {
  parseDid,
  DidResolverService,
  getKeyFromVerificationMethod,
  getJwkFromJson,
  Key,
  getJwkFromKey,
  Hasher,
  injectable,
  TypedArrayEncoder,
  Buffer,
} from '@aries-framework/core'
import { KeyBinding, SdJwtVc, HasherAlgorithm, Disclosure } from '@sd-jwt/core'

import { SdJwtVcError } from './SdJwtVcError'
import { SdJwtVcRepository, SdJwtVcRecord } from './repository'

export { SdJwtVcVerificationResult }

/**
 * @internal
 */
@injectable()
export class SdJwtVcService {
  private sdJwtVcRepository: SdJwtVcRepository

  public constructor(sdJwtVcRepository: SdJwtVcRepository) {
    this.sdJwtVcRepository = sdJwtVcRepository
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
  private signer<Header extends SdJwtVcHeader = SdJwtVcHeader>(agentContext: AgentContext, key: Key): Signer<Header> {
    return async (input: string) => agentContext.wallet.sign({ key, data: TypedArrayEncoder.fromString(input) })
  }

  /**
   * @todo validate the JWT header (alg)
   */
  private verifier<Header extends SdJwtVcHeader = SdJwtVcHeader>(
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

  public async signCredential<Payload extends SdJwtVcPayload>(
    agentContext: AgentContext,
    sdJwtCredential: SdJwtCredential<Payload>
  ): Promise<{ sdJwtVcRecord: SdJwtVcRecord; compact: string }> {
    const { holderDidUrl, issuerDidUrl, payload, disclosureFrame, hashingAlgorithm, jsonWebAlgorithm } = sdJwtCredential

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

    return {
      sdJwtVcRecord,
      compact,
    }
  }

  public async create<Payload extends SdJwtVcPayload>(
    agentContext: AgentContext,
    payload: Payload,
    {
      issuerDidUrl,
      holderDidUrl,
      disclosureFrame,
      hashingAlgorithm = 'sha2-256',
      jsonWebAlgorithm,
    }: SdJwtVcCreateOptions<Payload>
  ) {
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
    } as const

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

    return {
      sdJwtVcRecord,
      compact,
    }
  }

  public async fromSerializedJwt<
    Header extends SdJwtVcHeader = SdJwtVcHeader,
    Payload extends SdJwtVcPayload = SdJwtVcPayload
  >(
    agentContext: AgentContext,
    sdJwtVcCompact: string,
    { issuerDidUrl, holderDidUrl }: SdJwtVcFromSerializedJwtOptions
  ): Promise<SdJwtVcRecord<Header, Payload>> {
    const sdJwtVc = SdJwtVc.fromCompact<Header, Payload>(sdJwtVcCompact)

    let url: string | undefined
    if (issuerDidUrl) {
      url = issuerDidUrl
    } else {
      const iss = sdJwtVc.payload?.iss
      if (typeof iss === 'string' && iss.startsWith('did')) {
        const kid = sdJwtVc.header?.kid
        if (!kid || typeof kid !== 'string') throw new SdJwtVcError(`Missing 'kid' in header of SdJwtVc.`)
        if (kid.startsWith('did:')) url = kid
        else url = `${iss}#${kid}`
      } else if (typeof iss === 'string' && URL.canParse(iss)) {
        throw new SdJwtVcError(`Resolving the key material from the 'iss' claim is not supported yet.`)
      } else {
        throw new SdJwtVcError(`Invalid iss claim '${iss}' in SdJwtVc.`)
      }
    }

    if (!sdJwtVc.signature) {
      throw new SdJwtVcError('A signature must be included for an sd-jwt-vc')
    }

    const { verificationMethod: issuerVerificationMethod } = await this.resolveDidUrl(agentContext, url)
    const issuerKey = getKeyFromVerificationMethod(issuerVerificationMethod)

    const { isSignatureValid } = await sdJwtVc.verify(this.verifier(agentContext, issuerKey))

    if (!isSignatureValid) {
      throw new SdJwtVcError('sd-jwt-vc has an invalid signature from the issuer')
    }

    const { verificationMethod: holderVerificationMethod } = await this.resolveDidUrl(agentContext, holderDidUrl)
    const holderKey = getKeyFromVerificationMethod(holderVerificationMethod)
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

    return sdJwtVcRecord
  }

  public async storeCredential(agentContext: AgentContext, sdJwtVcRecord: SdJwtVcRecord) {
    await this.sdJwtVcRepository.save(agentContext, sdJwtVcRecord)

    return sdJwtVcRecord
  }

  public async present<
    Header extends SdJwtVcHeader = SdJwtVcHeader,
    Payload extends SdJwtVcPayload = SdJwtVcPayload,
    Record extends SdJwtVcRecord<Header, Payload> = SdJwtVcRecord<Header, Payload>
  >(
    agentContext: AgentContext,
    sdJwtVcRecord: Record,
    { presentationFrame, verifierMetadata, jsonWebAlgorithm }: SdJwtVcPresentOptions<Payload>
  ): Promise<string> {
    const { verificationMethod: holderVerificationMethod } = await this.resolveDidUrl(
      agentContext,
      sdJwtVcRecord.sdJwtVc.holderDidUrl
    )
    const holderKey = getKeyFromVerificationMethod(holderVerificationMethod)
    const alg = jsonWebAlgorithm ?? getJwkFromKey(holderKey).supportedSignatureAlgorithms[0]

    const header = {
      alg,
      typ: 'kb+jwt',
    } as const

    const payload = {
      iat: verifierMetadata.issuedAt,
      nonce: verifierMetadata.nonce,
      aud: verifierMetadata.verifierDid,
      // FIXME: _sd_hash is missing. See
      // https://github.com/berendsliedrecht/sd-jwt-ts/issues/8
    }

    const keyBinding = new KeyBinding({ header, payload }).withSigner(this.signer(agentContext, holderKey))

    const sdJwtVc = new SdJwtVc({
      header: sdJwtVcRecord.sdJwtVc.header,
      payload: sdJwtVcRecord.sdJwtVc.payload,
      signature: sdJwtVcRecord.sdJwtVc.signature,
      disclosures: sdJwtVcRecord.sdJwtVc.disclosures?.map(Disclosure.fromArray),
    })
      .withKeyBinding(keyBinding)
      .withHasher(this.hasher)

    return sdJwtVc.present(presentationFrame === true ? undefined : presentationFrame)
  }

  public async verify<Header extends SdJwtVcHeader = SdJwtVcHeader, Payload extends SdJwtVcPayload = SdJwtVcPayload>(
    agentContext: AgentContext,
    sdJwtVcCompact: string,
    { challenge: { verifierDid }, requiredClaimKeys, holderDidUrl }: SdJwtVcVerifyOptions
  ) {
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

    const sdJwtVcRecord = new SdJwtVcRecord<Header, Payload>({
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
