import type {
  SdJwtVcSignOptions,
  SdJwtVcPresentOptions,
  SdJwtVcVerifyOptions,
  SdJwtVcPayload,
  SdJwtVcHeader,
  SdJwtVcHolderBinding,
  SdJwtVcIssuer,
} from './SdJwtVcOptions'
import type { AgentContext } from '../../agent'
import type { JwkJson, Key } from '../../crypto'
import type { Query } from '../../storage/StorageService'
import type { Signer, SdJwtVcVerificationResult, Verifier, HasherAndAlgorithm, DisclosureItem } from '@sd-jwt/core'

import { KeyBinding, SdJwtVc as _SdJwtVc, HasherAlgorithm } from '@sd-jwt/core'
import { decodeSdJwtVc } from '@sd-jwt/decode'
import { injectable } from 'tsyringe'

import { Jwk, getJwkFromJson, getJwkFromKey } from '../../crypto'
import { TypedArrayEncoder, Hasher, Buffer } from '../../utils'
import { DidResolverService, parseDid, getKeyFromVerificationMethod } from '../dids'

import { SdJwtVcError } from './SdJwtVcError'
import { SdJwtVcRecord, SdJwtVcRepository } from './repository'

export { SdJwtVcVerificationResult, DisclosureItem }

export interface SdJwtVc<
  Header extends SdJwtVcHeader = SdJwtVcHeader,
  Payload extends SdJwtVcPayload = SdJwtVcPayload
> {
  compact: string
  header: Header

  // TODO: payload type here is a lie, as it is the signed payload (so fields replaced with _sd)
  payload: Payload
  prettyClaims: Payload
}

/**
 * @internal
 */
@injectable()
export class SdJwtVcService {
  private sdJwtVcRepository: SdJwtVcRepository

  public constructor(sdJwtVcRepository: SdJwtVcRepository) {
    this.sdJwtVcRepository = sdJwtVcRepository
  }

  public async sign<Payload extends SdJwtVcPayload>(agentContext: AgentContext, options: SdJwtVcSignOptions<Payload>) {
    const { payload, disclosureFrame, hashingAlgorithm } = options

    // default is sha-256
    if (hashingAlgorithm && hashingAlgorithm !== 'sha-256') {
      throw new SdJwtVcError(`Unsupported hashing algorithm used: ${hashingAlgorithm}`)
    }

    const issuer = await this.extractKeyFromIssuer(agentContext, options.issuer)
    const holderBinding = await this.extractKeyFromHolderBinding(agentContext, options.holder)

    const header = {
      alg: issuer.alg,
      typ: 'vc+sd-jwt',
      kid: issuer.kid,
    } as const

    const sdJwtVc = new _SdJwtVc<typeof header, Payload>({}, { disclosureFrame })
      .withHasher(this.hasher)
      .withSigner(this.signer(agentContext, issuer.key))
      .withSaltGenerator(agentContext.wallet.generateNonce)
      .withHeader(header)
      .withPayload({ ...payload })

    // Add the `cnf` claim for the holder key binding
    sdJwtVc.addPayloadClaim('cnf', holderBinding.cnf)

    // Add `iss` claim
    sdJwtVc.addPayloadClaim('iss', issuer.iss)

    // Add the issued at (iat) claim
    sdJwtVc.addPayloadClaim('iat', Math.floor(new Date().getTime() / 1000))

    const compact = await sdJwtVc.toCompact()
    if (!sdJwtVc.signature) {
      throw new SdJwtVcError('Invalid sd-jwt-vc state. Signature should have been set when calling `toCompact`.')
    }

    return {
      compact,
      prettyClaims: await sdJwtVc.getPrettyClaims(),
      header: sdJwtVc.header,
      payload: sdJwtVc.payload,
    } satisfies SdJwtVc<typeof header, Payload>
  }

  public fromCompact<Header extends SdJwtVcHeader = SdJwtVcHeader, Payload extends SdJwtVcPayload = SdJwtVcPayload>(
    compactSdJwtVc: string
  ): SdJwtVc<Header, Payload> {
    // NOTE: we use decodeSdJwtVc so we can make this method sync
    const { decodedPayload, header, signedPayload } = decodeSdJwtVc(compactSdJwtVc, Hasher.hash)

    return {
      compact: compactSdJwtVc,
      header: header as Header,
      payload: signedPayload as Payload,
      prettyClaims: decodedPayload as Payload,
    }
  }

  public async present<Header extends SdJwtVcHeader = SdJwtVcHeader, Payload extends SdJwtVcPayload = SdJwtVcPayload>(
    agentContext: AgentContext,
    { compactSdJwtVc, presentationFrame, verifierMetadata }: SdJwtVcPresentOptions<Payload>
  ): Promise<string> {
    const sdJwtVc = _SdJwtVc.fromCompact<Header>(compactSdJwtVc).withHasher(this.hasher)
    const holder = await this.extractKeyFromHolderBinding(agentContext, this.parseHolderBindingFromCredential(sdJwtVc))

    const compactDerivedSdJwtVc = await sdJwtVc
      .withKeyBinding(
        new KeyBinding({
          header: {
            alg: holder.alg,
            typ: 'kb+jwt',
          },
          payload: {
            iat: verifierMetadata.issuedAt,
            nonce: verifierMetadata.nonce,
            aud: verifierMetadata.audience,
          },
        }).withSigner(this.signer(agentContext, holder.key))
      )
      .present(presentationFrame === true ? undefined : presentationFrame)

    return compactDerivedSdJwtVc
  }

  public async verify<Header extends SdJwtVcHeader = SdJwtVcHeader, Payload extends SdJwtVcPayload = SdJwtVcPayload>(
    agentContext: AgentContext,
    { compactSdJwtVc, keyBinding, requiredClaimKeys }: SdJwtVcVerifyOptions
  ) {
    const sdJwtVc = _SdJwtVc.fromCompact<Header, Payload>(compactSdJwtVc).withHasher(this.hasher)

    const issuer = await this.extractKeyFromIssuer(agentContext, this.parseIssuerFromCredential(sdJwtVc))
    const holder = await this.extractKeyFromHolderBinding(agentContext, this.parseHolderBindingFromCredential(sdJwtVc))

    const verificationResult = await sdJwtVc.verify(
      this.verifier(agentContext),
      requiredClaimKeys,
      holder.cnf,
      getJwkFromKey(holder.key).toJson(),
      getJwkFromKey(issuer.key).toJson()
    )

    // If keyBinding is present, verify the key binding
    try {
      if (keyBinding) {
        if (!sdJwtVc.keyBinding || !sdJwtVc.keyBinding.payload) {
          throw new SdJwtVcError('Keybinding is required for verification of the sd-jwt-vc')
        }

        // Assert `aud` and `nonce` claims
        sdJwtVc.keyBinding.assertClaimInPayload('aud', keyBinding.audience)
        sdJwtVc.keyBinding.assertClaimInPayload('nonce', keyBinding.nonce)
      }
    } catch (error) {
      verificationResult.isKeyBindingValid = false
      verificationResult.isValid = false
    }

    return {
      verification: verificationResult,
      sdJwtVc: {
        payload: sdJwtVc.payload,
        header: sdJwtVc.header,
        compact: compactSdJwtVc,
        prettyClaims: await sdJwtVc.getPrettyClaims(),
      } satisfies SdJwtVc<Header, Payload>,
    }
  }

  public async store(agentContext: AgentContext, compactSdJwtVc: string) {
    const sdJwtVcRecord = new SdJwtVcRecord({
      compactSdJwtVc,
    })
    await this.sdJwtVcRepository.save(agentContext, sdJwtVcRecord)

    return sdJwtVcRecord
  }

  public async getById(agentContext: AgentContext, id: string): Promise<SdJwtVcRecord> {
    return await this.sdJwtVcRepository.getById(agentContext, id)
  }

  public async getAll(agentContext: AgentContext): Promise<Array<SdJwtVcRecord>> {
    return await this.sdJwtVcRepository.getAll(agentContext)
  }

  public async findByQuery(agentContext: AgentContext, query: Query<SdJwtVcRecord>): Promise<Array<SdJwtVcRecord>> {
    return await this.sdJwtVcRepository.findByQuery(agentContext, query)
  }

  public async deleteById(agentContext: AgentContext, id: string) {
    await this.sdJwtVcRepository.deleteById(agentContext, id)
  }

  public async update(agentContext: AgentContext, sdJwtVcRecord: SdJwtVcRecord) {
    await this.sdJwtVcRepository.update(agentContext, sdJwtVcRecord)
  }

  private async resolveDidUrl(agentContext: AgentContext, didUrl: string) {
    const didResolver = agentContext.dependencyManager.resolve(DidResolverService)
    const didDocument = await didResolver.resolveDidDocument(agentContext, didUrl)

    return {
      verificationMethod: didDocument.dereferenceKey(didUrl, ['assertionMethod']),
      didDocument,
    }
  }

  private get hasher(): HasherAndAlgorithm {
    return {
      algorithm: HasherAlgorithm.Sha256,
      hasher: Hasher.hash,
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
  private verifier<Header extends SdJwtVcHeader = SdJwtVcHeader>(agentContext: AgentContext): Verifier<Header> {
    return async ({ message, signature, publicKeyJwk }) => {
      if (!publicKeyJwk) {
        throw new SdJwtVcError('The public key used to verify the signature is missing')
      }

      return await agentContext.wallet.verify({
        signature: Buffer.from(signature),
        key: getJwkFromJson(publicKeyJwk as JwkJson).key,
        data: TypedArrayEncoder.fromString(message),
      })
    }
  }

  private async extractKeyFromIssuer(agentContext: AgentContext, issuer: SdJwtVcIssuer) {
    if (issuer.method === 'did') {
      const parsedDid = parseDid(issuer.didUrl)
      if (!parsedDid.fragment) {
        throw new SdJwtVcError(
          `didUrl '${issuer.didUrl}' does not contain a '#'. Unable to derive key from did document`
        )
      }

      const { verificationMethod } = await this.resolveDidUrl(agentContext, issuer.didUrl)
      const key = getKeyFromVerificationMethod(verificationMethod)
      const alg = getJwkFromKey(key).supportedSignatureAlgorithms[0]

      return {
        alg,
        key,
        iss: parsedDid.did,
        kid: `#${parsedDid.fragment}`,
      }
    }

    throw new SdJwtVcError("Unsupported credential issuer. Only 'did' is supported at the moment.")
  }

  private parseIssuerFromCredential<Header extends SdJwtVcHeader, Payload extends SdJwtVcPayload>(
    sdJwtVc: _SdJwtVc<Header, Payload>
  ): SdJwtVcIssuer {
    const iss = sdJwtVc.getClaimInPayload<string>('iss')

    if (iss.startsWith('did:')) {
      // If `did` is used, we require a relative KID to be present to identify
      // the key used by issuer to sign the sd-jwt-vc
      sdJwtVc.assertClaimInHeader('kid')
      const issuerKid = sdJwtVc.getClaimInHeader<string>('kid')

      let didUrl: string
      if (issuerKid.startsWith('#')) {
        didUrl = `${iss}${issuerKid}`
      } else if (issuerKid.startsWith('did:')) {
        const didFromKid = parseDid(issuerKid)
        if (didFromKid.did !== iss) {
          throw new SdJwtVcError(
            `kid in header is an absolute DID URL, but the did (${didFromKid.did}) does not match with the 'iss' did (${iss})`
          )
        }

        didUrl = issuerKid
      } else {
        throw new SdJwtVcError(
          'Invalid issuer kid for did. Only absolute or relative (starting with #) did urls are supported.'
        )
      }

      return {
        method: 'did',
        didUrl,
      }
    }
    throw new SdJwtVcError("Unsupported 'iss' value. Only did is supported at the moment.")
  }

  private parseHolderBindingFromCredential<Header extends SdJwtVcHeader, Payload extends SdJwtVcPayload>(
    sdJwtVc: _SdJwtVc<Header, Payload>
  ): SdJwtVcHolderBinding {
    const cnf = sdJwtVc.getClaimInPayload<{ jwk?: JwkJson; kid?: string }>('cnf')

    if (cnf.jwk) {
      return {
        method: 'jwk',
        jwk: cnf.jwk,
      }
    } else if (cnf.kid) {
      if (!cnf.kid.startsWith('did:') || !cnf.kid.includes('#')) {
        throw new SdJwtVcError('Invalid holder kid for did. Only absolute KIDs for cnf are supported')
      }
      return {
        method: 'did',
        didUrl: cnf.kid,
      }
    }

    throw new SdJwtVcError("Unsupported credential holder binding. Only 'did' and 'jwk' are supported at the moment.")
  }

  private async extractKeyFromHolderBinding(agentContext: AgentContext, holder: SdJwtVcHolderBinding) {
    if (holder.method === 'did') {
      const parsedDid = parseDid(holder.didUrl)
      if (!parsedDid.fragment) {
        throw new SdJwtVcError(
          `didUrl '${holder.didUrl}' does not contain a '#'. Unable to derive key from did document`
        )
      }

      const { verificationMethod } = await this.resolveDidUrl(agentContext, holder.didUrl)
      const key = getKeyFromVerificationMethod(verificationMethod)
      const alg = getJwkFromKey(key).supportedSignatureAlgorithms[0]

      return {
        alg,
        key,
        cnf: {
          // We need to include the whole didUrl here, otherwise the verifier
          // won't know which did it is associated with
          kid: holder.didUrl,
        },
      }
    } else if (holder.method === 'jwk') {
      const jwk = holder.jwk instanceof Jwk ? holder.jwk : getJwkFromJson(holder.jwk)
      const key = jwk.key
      const alg = jwk.supportedSignatureAlgorithms[0]

      return {
        alg,
        key,
        cnf: {
          jwk: jwk.toJson(),
        },
      }
    }

    throw new SdJwtVcError("Unsupported credential holder binding. Only 'did' and 'jwk' are supported at the moment.")
  }
}
