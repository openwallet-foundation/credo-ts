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
import type { SDJwt } from '@sd-jwt/core'
import type { Signer, Verifier, HasherSync, PresentationFrame, DisclosureFrame } from '@sd-jwt/types'

import { SDJwtInstance } from '@sd-jwt/core'
import { decodeSdJwtSync, getClaimsSync } from '@sd-jwt/decode'
import { uint8ArrayToBase64Url } from '@sd-jwt/utils'
import { injectable } from 'tsyringe'

import { Jwk, getJwkFromJson, getJwkFromKey } from '../../crypto'
import { TypedArrayEncoder, Hasher } from '../../utils'
import { DidResolverService, parseDid, getKeyFromVerificationMethod } from '../dids'

import { SdJwtVcError } from './SdJwtVcError'
import { SdJwtVcRecord, SdJwtVcRepository } from './repository'

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

export interface CnfPayload {
  jwk?: JwkJson
  kid?: string
}

export interface VerificationResult {
  isValid: boolean
  isSignatureValid: boolean
  isNotBeforeValid?: boolean
  isExpiryTimeValid?: boolean
  areRequiredClaimsIncluded?: boolean
  isKeyBindingValid?: boolean
  containsExpectedKeyBinding?: boolean
  containsRequiredVcProperties?: boolean
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

    const sdjwt = new SDJwtInstance({
      hasher: this.hasher,
      signer: this.signer(agentContext, issuer.key),
      hashAlg: 'sha-256',
      signAlg: issuer.alg,
      saltGenerator: agentContext.wallet.generateNonce,
    })

    const compact = await sdjwt.issue(
      { ...payload, cnf: holderBinding.cnf, iss: issuer.iss, iat: Math.floor(new Date().getTime() / 1000) },
      disclosureFrame as DisclosureFrame<Payload>,
      { header }
    )

    const prettyClaims = (await sdjwt.getClaims(compact)) as Payload
    const a = await sdjwt.decode(compact)
    const sdjwtPayload = a.jwt?.payload as Payload | undefined
    if (!sdjwtPayload) {
      throw new SdJwtVcError('Invalid sd-jwt-vc state.')
    }

    return {
      compact,
      prettyClaims,
      header: header,
      payload: sdjwtPayload,
    } satisfies SdJwtVc<typeof header, Payload>
  }

  public fromCompact<Header extends SdJwtVcHeader = SdJwtVcHeader, Payload extends SdJwtVcPayload = SdJwtVcPayload>(
    compactSdJwtVc: string
  ): SdJwtVc<Header, Payload> {
    // NOTE: we use decodeSdJwtSync so we can make this method sync
    const { jwt, disclosures } = decodeSdJwtSync(compactSdJwtVc, this.hasher)
    const prettyClaims = getClaimsSync(jwt.payload, disclosures, this.hasher)

    return {
      compact: compactSdJwtVc,
      header: jwt.header as Header,
      payload: jwt.payload as Payload,
      prettyClaims: prettyClaims as Payload,
    }
  }

  public async present<Payload extends SdJwtVcPayload = SdJwtVcPayload>(
    agentContext: AgentContext,
    { compactSdJwtVc, presentationFrame, verifierMetadata }: SdJwtVcPresentOptions<Payload>
  ): Promise<string> {
    const sdjwt = new SDJwtInstance({
      hasher: this.hasher,
    })
    const sdJwtVc = await sdjwt.decode(compactSdJwtVc)

    const holder = await this.extractKeyFromHolderBinding(agentContext, this.parseHolderBindingFromCredential(sdJwtVc))
    sdjwt.config({
      kbSigner: this.signer(agentContext, holder.key),
      kbSignAlg: holder.alg,
    })

    const compactDerivedSdJwtVc = await sdjwt.present(compactSdJwtVc, presentationFrame as PresentationFrame<Payload>, {
      kb: {
        payload: {
          iat: verifierMetadata.issuedAt,
          nonce: verifierMetadata.nonce,
          aud: verifierMetadata.audience,
        },
      },
    })

    return compactDerivedSdJwtVc
  }

  public async verify<Header extends SdJwtVcHeader = SdJwtVcHeader, Payload extends SdJwtVcPayload = SdJwtVcPayload>(
    agentContext: AgentContext,
    { compactSdJwtVc, keyBinding, requiredClaimKeys }: SdJwtVcVerifyOptions
  ) {
    const sdjwt = new SDJwtInstance({
      hasher: this.hasher,
    })
    const sdJwtVc = await sdjwt.decode(compactSdJwtVc)
    if (!sdJwtVc.jwt) {
      throw new SdJwtVcError('Invalid sd-jwt-vc state.')
    }

    const issuer = await this.extractKeyFromIssuer(agentContext, this.parseIssuerFromCredential(sdJwtVc))
    const holder = await this.extractKeyFromHolderBinding(agentContext, this.parseHolderBindingFromCredential(sdJwtVc))

    sdjwt.config({
      verifier: this.verifier(agentContext, issuer.key),
      kbVerifier: this.verifier(agentContext, holder.key),
    })

    const verificationResult: VerificationResult = {
      isValid: false,
      isSignatureValid: false,
    }

    await sdjwt.verify(compactSdJwtVc, requiredClaimKeys, !!keyBinding)

    verificationResult.isValid = true
    verificationResult.isSignatureValid = true
    verificationResult.areRequiredClaimsIncluded = true

    // If keyBinding is present, verify the key binding
    try {
      if (keyBinding) {
        if (!sdJwtVc.kbJwt || !sdJwtVc.kbJwt.payload) {
          throw new SdJwtVcError('Keybinding is required for verification of the sd-jwt-vc')
        }

        // Assert `aud` and `nonce` claims
        if (sdJwtVc.kbJwt.payload.aud !== keyBinding.audience) {
          throw new SdJwtVcError('The key binding JWT does not contain the expected audience')
        }

        if (sdJwtVc.kbJwt.payload.nonce !== keyBinding.nonce) {
          throw new SdJwtVcError('The key binding JWT does not contain the expected nonce')
        }

        verificationResult.isKeyBindingValid = true
        verificationResult.containsExpectedKeyBinding = true
        verificationResult.containsRequiredVcProperties = true
      }
    } catch (error) {
      verificationResult.isKeyBindingValid = false
      verificationResult.isValid = false
    }

    return {
      verification: verificationResult,
      sdJwtVc: {
        payload: sdJwtVc.jwt.payload as Payload,
        header: sdJwtVc.jwt.header as Header,
        compact: compactSdJwtVc,
        prettyClaims: await sdJwtVc.getClaims(this.hasher),
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

  private get hasher(): HasherSync {
    return Hasher.hash
  }

  /**
   * @todo validate the JWT header (alg)
   */
  private signer(agentContext: AgentContext, key: Key): Signer {
    return async (input: string) => {
      const signedBuffer = await agentContext.wallet.sign({ key, data: TypedArrayEncoder.fromString(input) })
      return uint8ArrayToBase64Url(signedBuffer)
    }
  }

  /**
   * @todo validate the JWT header (alg)
   */
  private verifier(agentContext: AgentContext, key: Key): Verifier {
    return async (message: string, signatureBase64Url: string) => {
      if (!key) {
        throw new SdJwtVcError('The public key used to verify the signature is missing')
      }

      return await agentContext.wallet.verify({
        signature: TypedArrayEncoder.fromBase64(signatureBase64Url),
        key,
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
    sdJwtVc: SDJwt<Header, Payload>
  ): SdJwtVcIssuer {
    if (!sdJwtVc.jwt?.payload) {
      throw new SdJwtVcError('Credential not exist')
    }

    if (!sdJwtVc.jwt?.payload['iss']) {
      throw new SdJwtVcError('Credential does not contain an issuer')
    }

    const iss = sdJwtVc.jwt.payload['iss'] as string

    if (iss.startsWith('did:')) {
      // If `did` is used, we require a relative KID to be present to identify
      // the key used by issuer to sign the sd-jwt-vc

      if (!sdJwtVc.jwt?.header) {
        throw new SdJwtVcError('Credential does not contain a header')
      }

      if (!sdJwtVc.jwt.header['kid']) {
        throw new SdJwtVcError('Credential does not contain a kid in the header')
      }

      const issuerKid = sdJwtVc.jwt.header['kid'] as string

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
    sdJwtVc: SDJwt<Header, Payload>
  ): SdJwtVcHolderBinding {
    if (!sdJwtVc.jwt?.payload) {
      throw new SdJwtVcError('Credential not exist')
    }

    if (!sdJwtVc.jwt?.payload['cnf']) {
      throw new SdJwtVcError('Credential does not contain a holder binding')
    }
    const cnf: CnfPayload = sdJwtVc.jwt.payload['cnf']

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
