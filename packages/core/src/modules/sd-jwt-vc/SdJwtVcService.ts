import type { SDJwt } from '@sd-jwt/core'
import type { DisclosureFrame, PresentationFrame, Signer, Verifier } from '@sd-jwt/types'
import type { Query, QueryOptions } from '../../storage/StorageService'
import type {
  SdJwtVcHeader,
  SdJwtVcHolderBinding,
  SdJwtVcIssuer,
  SdJwtVcPayload,
  SdJwtVcPresentOptions,
  SdJwtVcSignOptions,
  SdJwtVcVerifyOptions,
} from './SdJwtVcOptions'

import { decodeSdJwtSync } from '@sd-jwt/decode'
import { selectDisclosures } from '@sd-jwt/present'
import { SDJwtVcInstance } from '@sd-jwt/sd-jwt-vc'
import { injectable } from 'tsyringe'

import { AgentContext } from '../../agent'
import { Hasher, JwtPayload } from '../../crypto'
import { CredoError } from '../../error'
import { X509Service } from '../../modules/x509/X509Service'
import { JsonObject } from '../../types'
import { TypedArrayEncoder, nowInSeconds } from '../../utils'
import { getDomainFromUrl } from '../../utils/domain'
import { fetchWithTimeout } from '../../utils/fetch'
import { DidResolverService, DidsApi, getPublicJwkFromVerificationMethod, parseDid } from '../dids'
import { ClaimFormat } from '../vc/index'
import { EncodedX509Certificate, X509Certificate, X509ModuleConfig } from '../x509'

import { Jwk, KeyManagementApi, PublicJwk } from '../kms'
import { SdJwtVcError } from './SdJwtVcError'
import { decodeSdJwtVc, sdJwtVcHasher } from './decodeSdJwtVc'
import { buildDisclosureFrameForPayload } from './disclosureFrame'
import { SdJwtVcRecord, SdJwtVcRepository } from './repository'
import { SdJwtVcTypeMetadata } from './typeMetadata'

type SdJwtVcConfig = SDJwtVcInstance['userConfig']

export interface SdJwtVc<
  Header extends SdJwtVcHeader = SdJwtVcHeader,
  Payload extends SdJwtVcPayload = SdJwtVcPayload,
> {
  /**
   * claim format is convenience method added to all credential instances
   */
  claimFormat: ClaimFormat.SdJwtVc
  /**
   * encoded is convenience method added to all credential instances
   */
  encoded: string
  compact: string
  header: Header

  // TODO: payload type here is a lie, as it is the signed payload (so fields replaced with _sd)
  payload: Payload
  prettyClaims: Payload

  kbJwt?: {
    header: Record<string, unknown>
    payload: Record<string, unknown>
  }

  typeMetadata?: SdJwtVcTypeMetadata
}

export interface CnfPayload {
  jwk?: Jwk
  kid?: string
}

export interface VerificationResult {
  isValid: boolean
  isValidJwtPayload?: boolean
  isSignatureValid?: boolean
  isStatusValid?: boolean
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

    const issuer = await this.extractKeyFromIssuer(agentContext, options.issuer, true)

    // holer binding is optional
    const holderBinding = options.holder
      ? await this.extractKeyFromHolderBinding(agentContext, options.holder)
      : undefined

    const header = {
      alg: issuer.alg,
      typ: options.headerType ?? 'dc+sd-jwt',
      kid: issuer.kid,
      x5c: issuer.x5c?.map((cert) => cert.toString('base64')),
    } as const

    const sdjwt = new SDJwtVcInstance({
      ...this.getBaseSdJwtConfig(agentContext),
      signer: this.signer(agentContext, issuer.publicJwk),
      hashAlg: 'sha-256',
      signAlg: issuer.alg,
    })

    if (!payload.vct || typeof payload.vct !== 'string') {
      throw new SdJwtVcError("Missing required parameter 'vct'")
    }

    const compact = await sdjwt.issue(
      {
        ...payload,
        cnf: holderBinding?.cnf,
        iss: issuer.iss,
        iat: nowInSeconds(),
        vct: payload.vct,
      },
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
      claimFormat: ClaimFormat.SdJwtVc,
      encoded: compact,
    } satisfies SdJwtVc<typeof header, Payload>
  }

  public fromCompact<Header extends SdJwtVcHeader = SdJwtVcHeader, Payload extends SdJwtVcPayload = SdJwtVcPayload>(
    compactSdJwtVc: string,
    typeMetadata?: SdJwtVcTypeMetadata
  ): SdJwtVc<Header, Payload> {
    return decodeSdJwtVc(compactSdJwtVc, typeMetadata)
  }

  public applyDisclosuresForPayload(compactSdJwtVc: string, requestedPayload: JsonObject): SdJwtVc {
    const decoded = decodeSdJwtSync(compactSdJwtVc, Hasher.hash)
    const presentationFrame = buildDisclosureFrameForPayload(requestedPayload) ?? {}

    if (decoded.kbJwt) {
      throw new SdJwtVcError('Cannot apply limit disclosure on an sd-jwt with key binding jwt')
    }

    const requiredDisclosures = selectDisclosures(
      decoded.jwt.payload,
      // Map to sd-jwt disclosure format
      decoded.disclosures.map((d) => ({
        digest: d.digestSync({ alg: 'sha-256', hasher: Hasher.hash }),
        encoded: d.encode(),
        key: d.key,
        salt: d.salt,
        value: d.value,
      })),
      presentationFrame as { [key: string]: boolean }
    )
    const [jwt] = compactSdJwtVc.split('~')
    const sdJwt = `${jwt}~${requiredDisclosures.map((d) => d.encoded).join('~')}~`
    const disclosedDecoded = decodeSdJwtVc(sdJwt)
    return disclosedDecoded
  }

  public async present<Payload extends SdJwtVcPayload = SdJwtVcPayload>(
    agentContext: AgentContext,
    { compactSdJwtVc, presentationFrame, verifierMetadata, additionalPayload }: SdJwtVcPresentOptions<Payload>
  ): Promise<string> {
    const sdjwt = new SDJwtVcInstance(this.getBaseSdJwtConfig(agentContext))

    const sdJwtVc = await sdjwt.decode(compactSdJwtVc)

    const holderBinding = this.parseHolderBindingFromCredential(sdJwtVc)
    if (!holderBinding && verifierMetadata) {
      throw new SdJwtVcError("Verifier metadata provided, but credential has no 'cnf' claim to create a KB-JWT from")
    }

    const holder = holderBinding ? await this.extractKeyFromHolderBinding(agentContext, holderBinding, true) : undefined
    sdjwt.config({
      kbSigner: holder ? this.signer(agentContext, holder.publicJwk) : undefined,
      kbSignAlg: holder?.alg,
    })

    const compactDerivedSdJwtVc = await sdjwt.present(compactSdJwtVc, presentationFrame as PresentationFrame<Payload>, {
      kb: verifierMetadata
        ? {
            payload: {
              iat: verifierMetadata.issuedAt,
              nonce: verifierMetadata.nonce,
              aud: verifierMetadata.audience,
              ...additionalPayload,
            },
          }
        : undefined,
    })

    return compactDerivedSdJwtVc
  }

  private assertValidX5cJwtIssuer(agentContext: AgentContext, iss: string, leafCertificate: X509Certificate) {
    if (!iss.startsWith('https://') && !(iss.startsWith('http://') && agentContext.config.allowInsecureHttpUrls)) {
      throw new SdJwtVcError('The X509 certificate issuer must be a HTTPS URI.')
    }

    if (!leafCertificate.sanUriNames?.includes(iss) && !leafCertificate.sanDnsNames?.includes(getDomainFromUrl(iss))) {
      throw new SdJwtVcError(
        `The 'iss' claim in the payload does not match a 'SAN-URI' name and the domain extracted from the HTTPS URI does not match a 'SAN-DNS' name in the x5c certificate.`
      )
    }
  }

  public async verify<Header extends SdJwtVcHeader = SdJwtVcHeader, Payload extends SdJwtVcPayload = SdJwtVcPayload>(
    agentContext: AgentContext,
    { compactSdJwtVc, keyBinding, requiredClaimKeys, fetchTypeMetadata, trustedCertificates }: SdJwtVcVerifyOptions
  ): Promise<
    | { isValid: true; verification: VerificationResult; sdJwtVc: SdJwtVc<Header, Payload> }
    | { isValid: false; verification: VerificationResult; sdJwtVc?: SdJwtVc<Header, Payload>; error: Error }
  > {
    const sdjwt = new SDJwtVcInstance({
      ...this.getBaseSdJwtConfig(agentContext),
      // FIXME: will break if using url but no type metadata
      // https://github.com/openwallet-foundation/sd-jwt-js/issues/258
      // loadTypeMetadataFormat: false,
    })

    const verificationResult: VerificationResult = {
      isValid: false,
    }

    let sdJwtVc: SDJwt
    let _error: Error | undefined = undefined

    try {
      sdJwtVc = await sdjwt.decode(compactSdJwtVc)
      if (!sdJwtVc.jwt) throw new CredoError('Invalid sd-jwt-vc')
    } catch (error) {
      return {
        isValid: false,
        verification: verificationResult,
        error,
      }
    }

    const returnSdJwtVc: SdJwtVc<Header, Payload> = {
      payload: sdJwtVc.jwt.payload as Payload,
      header: sdJwtVc.jwt.header as Header,
      compact: compactSdJwtVc,
      prettyClaims: await sdJwtVc.getClaims(sdJwtVcHasher),

      kbJwt: sdJwtVc.kbJwt
        ? {
            payload: sdJwtVc.kbJwt.payload as Record<string, unknown>,
            header: sdJwtVc.kbJwt.header as Record<string, unknown>,
          }
        : undefined,
      claimFormat: ClaimFormat.SdJwtVc,
      encoded: compactSdJwtVc,
    } satisfies SdJwtVc<Header, Payload>

    try {
      const credentialIssuer = await this.parseIssuerFromCredential(
        agentContext,
        sdJwtVc,
        returnSdJwtVc,
        trustedCertificates
      )
      const issuer = await this.extractKeyFromIssuer(agentContext, credentialIssuer)
      const holderBinding = this.parseHolderBindingFromCredential(sdJwtVc)
      const holder = holderBinding ? await this.extractKeyFromHolderBinding(agentContext, holderBinding) : undefined

      sdjwt.config({
        verifier: this.verifier(agentContext, issuer.publicJwk),
        kbVerifier: holder ? this.verifier(agentContext, holder.publicJwk) : undefined,
      })

      const requiredKeys = requiredClaimKeys ? [...requiredClaimKeys, 'vct'] : ['vct']

      try {
        await sdjwt.verify(compactSdJwtVc, requiredKeys, keyBinding !== undefined)

        verificationResult.isSignatureValid = true
        verificationResult.areRequiredClaimsIncluded = true
        verificationResult.isStatusValid = true
      } catch (error) {
        _error = error
        verificationResult.isSignatureValid = false
        verificationResult.areRequiredClaimsIncluded = false
        verificationResult.isStatusValid = false
      }

      if (sdJwtVc.jwt.header?.typ !== 'vc+sd-jwt' && sdJwtVc.jwt.header?.typ !== 'dc+sd-jwt') {
        verificationResult.areRequiredClaimsIncluded = false
        _error = new SdJwtVcError(`SD-JWT VC header 'typ' must be 'dc+sd-jwt' or 'vc+sd-jwt'`)
      }

      try {
        JwtPayload.fromJson(returnSdJwtVc.payload).validate()

        verificationResult.isValidJwtPayload = true
      } catch (error) {
        _error = error
        verificationResult.isValidJwtPayload = false
      }

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
        _error = error
        verificationResult.isKeyBindingValid = false
        verificationResult.containsExpectedKeyBinding = false
        verificationResult.containsRequiredVcProperties = false
      }

      try {
        const vct = returnSdJwtVc.payload?.vct
        if (fetchTypeMetadata && typeof vct === 'string' && vct.startsWith('https://')) {
          // modify the uri based on https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc-04.html#section-6.3.1
          const vctElements = vct.split('/')
          vctElements.splice(3, 0, '.well-known/vct')
          const vctUrl = vctElements.join('/')

          const response = await agentContext.config.agentDependencies.fetch(vctUrl)
          if (response.ok) {
            const typeMetadata = await response.json()
            returnSdJwtVc.typeMetadata = typeMetadata as SdJwtVcTypeMetadata
          }
        }
      } catch (_error) {
        // we allow vct without type metadata for now
      }
    } catch (error) {
      verificationResult.isValid = false
      return {
        isValid: false,
        error,
        verification: verificationResult,
        sdJwtVc: returnSdJwtVc,
      }
    }

    const { isValid: _, ...allVerifications } = verificationResult
    verificationResult.isValid = Object.values(allVerifications).every((verification) => verification === true)

    if (_error) {
      return {
        isValid: false,
        error: _error,
        sdJwtVc: returnSdJwtVc,
        verification: verificationResult,
      }
    }

    return {
      isValid: true,
      verification: verificationResult,
      sdJwtVc: returnSdJwtVc,
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

  public async findByQuery(
    agentContext: AgentContext,
    query: Query<SdJwtVcRecord>,
    queryOptions?: QueryOptions
  ): Promise<Array<SdJwtVcRecord>> {
    return await this.sdJwtVcRepository.findByQuery(agentContext, query, queryOptions)
  }

  public async deleteById(agentContext: AgentContext, id: string) {
    await this.sdJwtVcRepository.deleteById(agentContext, id)
  }

  public async update(agentContext: AgentContext, sdJwtVcRecord: SdJwtVcRecord) {
    await this.sdJwtVcRepository.update(agentContext, sdJwtVcRecord)
  }

  private async resolveSigningPublicJwkFromDidUrl(agentContext: AgentContext, didUrl: string) {
    const dids = agentContext.dependencyManager.resolve(DidsApi)

    const { publicJwk } = await dids.resolveVerificationMethodFromCreatedDidRecord(didUrl)
    return publicJwk
  }

  private async resolveDidUrl(agentContext: AgentContext, didUrl: string) {
    const didResolver = agentContext.dependencyManager.resolve(DidResolverService)
    const didDocument = await didResolver.resolveDidDocument(agentContext, didUrl)

    return {
      verificationMethod: didDocument.dereferenceKey(didUrl, ['assertionMethod']),
      didDocument,
    }
  }

  /**
   * @todo validate the JWT header (alg)
   */
  private signer(agentContext: AgentContext, key: PublicJwk): Signer {
    const kms = agentContext.resolve(KeyManagementApi)

    return async (input: string) => {
      const result = await kms.sign({
        keyId: key.keyId,
        data: TypedArrayEncoder.fromString(input),
        algorithm: key.signatureAlgorithm,
      })

      return TypedArrayEncoder.toBase64URL(result.signature)
    }
  }

  /**
   * @todo validate the JWT header (alg)
   */
  private verifier(agentContext: AgentContext, key: PublicJwk): Verifier {
    const kms = agentContext.resolve(KeyManagementApi)

    return async (message: string, signatureBase64Url: string) => {
      const result = await kms.verify({
        signature: TypedArrayEncoder.fromBase64(signatureBase64Url),
        key: {
          publicJwk: key.toJson(),
        },
        data: TypedArrayEncoder.fromString(message),
        algorithm: key.signatureAlgorithm,
      })

      return result.verified
    }
  }

  private async extractKeyFromIssuer(agentContext: AgentContext, issuer: SdJwtVcIssuer, forSigning = false) {
    if (issuer.method === 'did') {
      const parsedDid = parseDid(issuer.didUrl)
      if (!parsedDid.fragment) {
        throw new SdJwtVcError(
          `didUrl '${issuer.didUrl}' does not contain a '#'. Unable to derive key from did document`
        )
      }

      let publicJwk: PublicJwk
      if (forSigning) {
        publicJwk = await this.resolveSigningPublicJwkFromDidUrl(agentContext, issuer.didUrl)
      } else {
        const { verificationMethod } = await this.resolveDidUrl(agentContext, issuer.didUrl)
        publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
      }

      const supportedSignatureAlgorithms = publicJwk.supportedSignatureAlgorithms
      if (supportedSignatureAlgorithms.length === 0) {
        throw new SdJwtVcError(
          `No supported JWA signature algorithms found for key ${publicJwk.jwkTypehumanDescription}`
        )
      }
      const alg = supportedSignatureAlgorithms[0]

      return {
        alg,
        publicJwk,
        iss: parsedDid.did,
        kid: `#${parsedDid.fragment}`,
      }
    }

    // FIXME: probably need to make the input an x509 certificate so we can attach a key id
    if (issuer.method === 'x5c') {
      const leafCertificate = issuer.x5c[0]
      if (!leafCertificate) {
        throw new SdJwtVcError("Empty 'x5c' array provided")
      }

      // TODO: We don't have an x509 certificate record so we expect the key id to already be set
      if (forSigning && !leafCertificate.publicJwk.hasKeyId) {
        throw new SdJwtVcError("Expected leaf certificate in 'x5c' array to have a key id configured.")
      }

      const publicJwk = leafCertificate.publicJwk
      const supportedSignatureAlgorithms = publicJwk.supportedSignatureAlgorithms
      if (supportedSignatureAlgorithms.length === 0) {
        throw new SdJwtVcError(
          `No supported JWA signature algorithms found for key ${publicJwk.jwkTypehumanDescription}`
        )
      }
      const alg = supportedSignatureAlgorithms[0]

      this.assertValidX5cJwtIssuer(agentContext, issuer.issuer, leafCertificate)

      return {
        publicJwk,
        iss: issuer.issuer,
        x5c: issuer.x5c,
        alg,
      }
    }

    throw new SdJwtVcError("Unsupported credential issuer. Only 'did' and 'x5c' is supported at the moment.")
  }

  private async parseIssuerFromCredential<Header extends SdJwtVcHeader, Payload extends SdJwtVcPayload>(
    agentContext: AgentContext,
    sdJwtVc: SDJwt<Header, Payload>,
    credoSdJwtVc: SdJwtVc<Header, Payload>,
    _trustedCertificates?: EncodedX509Certificate[]
  ): Promise<SdJwtVcIssuer> {
    const x509Config = agentContext.dependencyManager.resolve(X509ModuleConfig)
    if (!sdJwtVc.jwt?.payload) {
      throw new SdJwtVcError('Credential not exist')
    }

    if (!sdJwtVc.jwt?.payload.iss) {
      throw new SdJwtVcError('Credential does not contain an issuer')
    }

    const iss = sdJwtVc.jwt.payload.iss as string

    if (sdJwtVc.jwt.header?.x5c) {
      if (!Array.isArray(sdJwtVc.jwt.header.x5c)) {
        throw new SdJwtVcError('Invalid x5c header in credential. Not an array.')
      }
      if (sdJwtVc.jwt.header.x5c.length === 0) {
        throw new SdJwtVcError('Invalid x5c header in credential. Empty array.')
      }
      if (sdJwtVc.jwt.header.x5c.some((x5c) => typeof x5c !== 'string')) {
        throw new SdJwtVcError('Invalid x5c header in credential. Not an array of strings.')
      }

      let trustedCertificates = _trustedCertificates
      const certificateChain = sdJwtVc.jwt.header.x5c.map((cert) => X509Certificate.fromEncodedCertificate(cert))

      if (!trustedCertificates) {
        trustedCertificates =
          (await x509Config.getTrustedCertificatesForVerification?.(agentContext, {
            certificateChain,
            verification: {
              type: 'credential',
              credential: credoSdJwtVc,
            },
          })) ?? x509Config.trustedCertificates
      }

      if (!trustedCertificates) {
        throw new SdJwtVcError(
          'No trusted certificates configured for X509 certificate chain validation. Issuer cannot be verified.'
        )
      }

      await X509Service.validateCertificateChain(agentContext, {
        certificateChain: sdJwtVc.jwt.header.x5c,
        trustedCertificates,
      })

      return {
        method: 'x5c',
        x5c: certificateChain,
        issuer: iss,
      }
    }

    if (iss.startsWith('did:')) {
      // If `did` is used, we require a relative KID to be present to identify
      // the key used by issuer to sign the sd-jwt-vc

      if (!sdJwtVc.jwt?.header) {
        throw new SdJwtVcError('Credential does not contain a header')
      }

      if (!sdJwtVc.jwt.header.kid) {
        throw new SdJwtVcError('Credential does not contain a kid in the header')
      }

      const issuerKid = sdJwtVc.jwt.header.kid as string

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
  ): SdJwtVcHolderBinding | null {
    if (!sdJwtVc.jwt?.payload) {
      throw new SdJwtVcError('Unable to extract payload from SD-JWT VC')
    }

    if (!sdJwtVc.jwt?.payload.cnf) {
      return null
    }
    const cnf: CnfPayload = sdJwtVc.jwt.payload.cnf

    if (cnf.jwk) {
      return {
        method: 'jwk',
        jwk: PublicJwk.fromUnknown(cnf.jwk),
      }
    }
    if (cnf.kid) {
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

  private async extractKeyFromHolderBinding(
    agentContext: AgentContext,
    holder: SdJwtVcHolderBinding,
    forSigning = false
  ) {
    if (holder.method === 'did') {
      const parsedDid = parseDid(holder.didUrl)
      if (!parsedDid.fragment) {
        throw new SdJwtVcError(
          `didUrl '${holder.didUrl}' does not contain a '#'. Unable to derive key from did document`
        )
      }

      let publicJwk: PublicJwk
      if (forSigning) {
        publicJwk = await this.resolveSigningPublicJwkFromDidUrl(agentContext, holder.didUrl)
      } else {
        const { verificationMethod } = await this.resolveDidUrl(agentContext, holder.didUrl)
        publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
      }

      const supportedSignatureAlgorithms = publicJwk.supportedSignatureAlgorithms
      if (supportedSignatureAlgorithms.length === 0) {
        throw new SdJwtVcError(
          `No supported JWA signature algorithms found for key ${publicJwk.jwkTypehumanDescription}`
        )
      }
      const alg = supportedSignatureAlgorithms[0]

      return {
        alg,
        publicJwk,
        cnf: {
          // We need to include the whole didUrl here, otherwise the verifier
          // won't know which did it is associated with
          kid: holder.didUrl,
        },
      }
    }
    if (holder.method === 'jwk') {
      const publicJwk = holder.jwk
      const alg = publicJwk.supportedSignatureAlgorithms[0]

      // If there is no key id configured when signing, we assume this credential was issued before we included key ids
      // and the we use the legacy key id.
      if (forSigning && !publicJwk.hasKeyId) {
        publicJwk.keyId = publicJwk.legacyKeyId
      }

      return {
        alg,
        publicJwk,
        cnf: {
          jwk: publicJwk.toJson(),
        },
      }
    }

    throw new SdJwtVcError("Unsupported credential holder binding. Only 'did' and 'jwk' are supported at the moment.")
  }

  private getBaseSdJwtConfig(agentContext: AgentContext): SdJwtVcConfig {
    const kms = agentContext.resolve(KeyManagementApi)

    return {
      hasher: sdJwtVcHasher,
      statusListFetcher: this.getStatusListFetcher(agentContext),
      saltGenerator: (length) => TypedArrayEncoder.toBase64URL(kms.randomBytes({ length })).slice(0, length),
    }
  }

  private getStatusListFetcher(agentContext: AgentContext) {
    return async (uri: string) => {
      const response = await fetchWithTimeout(agentContext.config.agentDependencies.fetch, uri, {
        headers: {
          Accept: 'application/statuslist+jwt',
        },
      })

      if (!response.ok) {
        throw new CredoError(
          `Received invalid response with status ${
            response.status
          } when fetching status list from ${uri}. ${await response.text()}`
        )
      }

      return await response.text()
    }
  }
}
