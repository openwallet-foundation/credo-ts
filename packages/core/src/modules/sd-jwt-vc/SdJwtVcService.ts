import type { SDJwt } from '@sd-jwt/core'
import { decodeSdJwtSync } from '@sd-jwt/decode'
import { selectDisclosures } from '@sd-jwt/present'
import { SDJwtVcInstance } from '@sd-jwt/sd-jwt-vc'
import type { DisclosureFrame, PresentationFrame } from '@sd-jwt/types'
import { injectable } from 'tsyringe'
import { AgentContext } from '../../agent'
import { Hasher, JwtPayload } from '../../crypto'
import { CredoError } from '../../error'
import { X509Service } from '../../modules/x509/X509Service'
import type { Query, QueryOptions } from '../../storage/StorageService'
import type { JsonObject } from '../../types'
import { dateToSeconds, IntegrityVerifier, nowInSeconds, TypedArrayEncoder } from '../../utils'
import { getDomainFromUrl } from '../../utils/domain'
import { fetchWithTimeout } from '../../utils/fetch'
import { getPublicJwkFromVerificationMethod, parseDid } from '../dids'
import { KeyManagementApi, PublicJwk } from '../kms'
import { ClaimFormat } from '../vc/index'
import { type EncodedX509Certificate, X509Certificate, X509ModuleConfig } from '../x509'
import { decodeSdJwtVc, sdJwtVcHasher } from './decodeSdJwtVc'
import { buildDisclosureFrameForPayload } from './disclosureFrame'
import { SdJwtVcRecord, SdJwtVcRepository } from './repository'
import { SdJwtVcError } from './SdJwtVcError'
import type {
  SdJwtVcHeader,
  SdJwtVcHolderBinding,
  SdJwtVcIssuer,
  SdJwtVcPayload,
  SdJwtVcPresentOptions,
  SdJwtVcSignOptions,
  SdJwtVcStoreOptions,
  SdJwtVcVerifyOptions,
} from './SdJwtVcOptions'
import type { SdJwtVcTypeMetadata } from './typeMetadata'
import {
  extractKeyFromHolderBinding,
  getSdJwtSigner,
  getSdJwtVerifier,
  parseHolderBindingFromCredential,
  resolveDidUrl,
  resolveSigningPublicJwkFromDidUrl,
} from './utils'

type SdJwtVcConfig = SDJwtVcInstance['userConfig']

export interface SdJwtVc<
  Header extends SdJwtVcHeader = SdJwtVcHeader,
  Payload extends SdJwtVcPayload = SdJwtVcPayload,
> {
  /**
   * claim format is convenience method added to all credential instances
   */
  claimFormat: ClaimFormat.SdJwtDc
  /**
   * encoded is convenience method added to all credential instances
   */
  encoded: string
  compact: string
  header: Header

  /**
   * The holder of the credential
   */
  holder: SdJwtVcHolderBinding | undefined

  // TODO: payload type here is a lie, as it is the signed payload (so fields replaced with _sd)
  payload: Payload
  prettyClaims: Payload

  kbJwt?: {
    header: Record<string, unknown>
    payload: Record<string, unknown>
  }

  /**
   * The key id in the KMS bound to this SD-JWT VC, used for presentations.
   *
   * This will only be set on the holder side if defined on the SdJwtVcRecord
   */
  kmsKeyId?: string

  typeMetadata?: SdJwtVcTypeMetadata
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

  public async sign<Payload extends SdJwtVcPayload>(
    agentContext: AgentContext,
    options: SdJwtVcSignOptions<Payload>
  ): Promise<SdJwtVc> {
    const { payload, disclosureFrame, hashingAlgorithm } = options

    // default is sha-256
    if (hashingAlgorithm && hashingAlgorithm !== 'sha-256') {
      throw new SdJwtVcError(`Unsupported hashing algorithm used: ${hashingAlgorithm}`)
    }

    const issuer = await this.extractKeyFromIssuer(agentContext, options.issuer, true)

    // holer binding is optional
    const holderBinding = options.holder ? await extractKeyFromHolderBinding(agentContext, options.holder) : undefined

    const header = {
      alg: issuer.alg,
      typ: options.headerType ?? 'dc+sd-jwt',
      kid: issuer.kid,
      x5c: issuer.x5c?.map((cert) => cert.toString('base64')),
    } as const

    const sdJwt = new SDJwtVcInstance({
      ...this.getBaseSdJwtConfig(agentContext),
      signer: getSdJwtSigner(agentContext, issuer.publicJwk),
      hashAlg: 'sha-256',
      signAlg: issuer.alg,
    })

    if (!payload.vct || typeof payload.vct !== 'string') {
      throw new SdJwtVcError("Missing required parameter 'vct'")
    }

    const compact = await sdJwt.issue(
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

    const prettyClaims = (await sdJwt.getClaims(compact)) as Payload
    const decoded = await sdJwt.decode(compact)
    const sdJwtPayload = decoded.jwt?.payload as Payload | undefined
    if (!sdJwtPayload) {
      throw new SdJwtVcError('Invalid sd-jwt-vc state.')
    }

    return {
      compact,
      prettyClaims,
      header: header,
      holder: options.holder,
      payload: sdJwtPayload,
      claimFormat: ClaimFormat.SdJwtDc,
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
    const disclosuresString =
      requiredDisclosures.length > 0 ? `${requiredDisclosures.map((d) => d.encoded).join('~')}~` : ''
    const sdJwt = `${jwt}~${disclosuresString}`
    const disclosedDecoded = decodeSdJwtVc(sdJwt)
    return disclosedDecoded
  }

  public async present<Payload extends SdJwtVcPayload = SdJwtVcPayload>(
    agentContext: AgentContext,
    { sdJwtVc, presentationFrame, verifierMetadata, additionalPayload }: SdJwtVcPresentOptions<Payload>
  ): Promise<string> {
    const sdjwt = new SDJwtVcInstance(this.getBaseSdJwtConfig(agentContext))
    const compactSdJwtVc = typeof sdJwtVc === 'string' ? sdJwtVc : sdJwtVc.compact
    const sdJwtVcInstance = await sdjwt.decode(compactSdJwtVc)

    const holderBinding = parseHolderBindingFromCredential(sdJwtVcInstance.jwt?.payload)
    if (!holderBinding && verifierMetadata) {
      throw new SdJwtVcError("Verifier metadata provided, but credential has no 'cnf' claim to create a KB-JWT from")
    }

    const holder = holderBinding
      ? await extractKeyFromHolderBinding(agentContext, holderBinding, {
          forSigning: true,
          jwkKeyId: typeof sdJwtVc !== 'string' ? sdJwtVc.kmsKeyId : undefined,
        })
      : undefined
    sdjwt.config({
      kbSigner: holder ? getSdJwtSigner(agentContext, holder.publicJwk) : undefined,
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

  private assertValidX5cJwtIssuer(
    agentContext: AgentContext,
    iss: string | undefined,
    leafCertificate: X509Certificate
  ) {
    // No 'iss' is allowed for X509
    if (!iss) return

    // If iss is present it MUST be an HTTPS url
    if (!iss.startsWith('https://') && !(iss.startsWith('http://') && agentContext.config.allowInsecureHttpUrls)) {
      throw new SdJwtVcError('The X509 certificate issuer must be a HTTPS URI.')
    }

    if (!leafCertificate.sanUriNames?.includes(iss) && !leafCertificate.sanDnsNames?.includes(getDomainFromUrl(iss))) {
      throw new SdJwtVcError(
        `The 'iss' claim in the payload does not match a 'SAN-URI' name and the domain extracted from the HTTPS URI does not match a 'SAN-DNS' name in the x5c certificate. Either remove the 'iss' claim or make it match with at least one SAN-URI or DNS-URI entry`
      )
    }
  }

  public async verify<Header extends SdJwtVcHeader = SdJwtVcHeader, Payload extends SdJwtVcPayload = SdJwtVcPayload>(
    agentContext: AgentContext,
    { compactSdJwtVc, keyBinding, requiredClaimKeys, fetchTypeMetadata, trustedCertificates, now }: SdJwtVcVerifyOptions
  ): Promise<
    | { isValid: true; sdJwtVc: SdJwtVc<Header, Payload> }
    | { isValid: false; sdJwtVc?: SdJwtVc<Header, Payload>; error: Error }
  > {
    const sdjwt = new SDJwtVcInstance(this.getBaseSdJwtConfig(agentContext))
    let sdJwtVc: SDJwt
    let holderBinding: SdJwtVcHolderBinding | undefined

    try {
      sdJwtVc = await sdjwt.decode(compactSdJwtVc)
      if (!sdJwtVc.jwt) throw new CredoError('Invalid sd-jwt-vc')
      holderBinding = parseHolderBindingFromCredential(sdJwtVc.jwt.payload) ?? undefined
    } catch (error) {
      return {
        isValid: false,
        error,
      }
    }

    const returnSdJwtVc: SdJwtVc<Header, Payload> = {
      payload: sdJwtVc.jwt.payload as Payload,
      header: sdJwtVc.jwt.header as Header,
      compact: compactSdJwtVc,
      prettyClaims: await sdJwtVc.getClaims(sdJwtVcHasher),
      holder: holderBinding,

      kbJwt: sdJwtVc.kbJwt
        ? {
            payload: sdJwtVc.kbJwt.payload as Record<string, unknown>,
            header: sdJwtVc.kbJwt.header as Record<string, unknown>,
          }
        : undefined,
      claimFormat: ClaimFormat.SdJwtDc,
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
      const holder = returnSdJwtVc.holder
        ? await extractKeyFromHolderBinding(agentContext, returnSdJwtVc.holder)
        : undefined

      sdjwt.config({
        verifier: getSdJwtVerifier(agentContext, issuer.publicJwk),
        kbVerifier: holder ? getSdJwtVerifier(agentContext, holder.publicJwk) : undefined,
      })

      try {
        await sdjwt.verify(compactSdJwtVc, {
          requiredClaimKeys: requiredClaimKeys ? [...requiredClaimKeys, 'vct'] : ['vct'],
          keyBindingNonce: keyBinding?.nonce,
          currentDate: dateToSeconds(now ?? new Date()),
          skewSeconds: agentContext.config.validitySkewSeconds,
        })
      } catch (error) {
        return {
          error,
          isValid: false,
          sdJwtVc: returnSdJwtVc,
        }
      }

      if (sdJwtVc.jwt.header?.typ !== 'vc+sd-jwt' && sdJwtVc.jwt.header?.typ !== 'dc+sd-jwt') {
        return {
          error: new SdJwtVcError(`SD-JWT VC header 'typ' must be 'dc+sd-jwt' or 'vc+sd-jwt'`),
          isValid: false,
          sdJwtVc: returnSdJwtVc,
        }
      }

      try {
        JwtPayload.fromJson(returnSdJwtVc.payload).validate({
          now: dateToSeconds(now ?? new Date()),
          skewSeconds: agentContext.config.validitySkewSeconds,
        })
      } catch (error) {
        return {
          error,
          isValid: false,
          sdJwtVc: returnSdJwtVc,
        }
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
        }
      } catch (error) {
        return {
          error,
          isValid: false,
          sdJwtVc: returnSdJwtVc,
        }
      }

      if (fetchTypeMetadata) {
        // We allow vct without type metadata for now (and don't fail if the retrieval fails)
        // Integrity check must pass though.
        returnSdJwtVc.typeMetadata = await this.fetchTypeMetadata(agentContext, returnSdJwtVc, {
          throwErrorOnFetchError: false,
          throwErrorOnUnsupportedVctValue: false,
        })
      }
    } catch (error) {
      return {
        isValid: false,
        error,
        sdJwtVc: returnSdJwtVc,
      }
    }

    return {
      isValid: true,
      sdJwtVc: returnSdJwtVc,
    }
  }

  public async fetchTypeMetadata(
    agentContext: AgentContext,
    sdJwtVc: SdJwtVc,
    {
      throwErrorOnFetchError = true,
      throwErrorOnUnsupportedVctValue = true,
    }: { throwErrorOnFetchError?: boolean; throwErrorOnUnsupportedVctValue?: boolean } = {}
  ) {
    const vct = sdJwtVc.payload.vct
    const vctIntegrity = sdJwtVc.payload['vct#integrity']
    if (!vct || typeof vct !== 'string' || !vct.startsWith('https://')) {
      if (!throwErrorOnUnsupportedVctValue) return undefined
      throw new SdJwtVcError(`Unable to resolve type metadata for vct '${vct}'. Only https supported`)
    }

    let firstError: Error | undefined

    // Fist try the new type metadata URL
    // We add a catch, so that if e.g. the request fails due to CORS (which throws an error
    // we will still continue trying the legacy url)
    const firstResponse = await agentContext.config.agentDependencies.fetch(vct).catch((error) => {
      firstError = error
      return undefined
    })
    let response = firstResponse

    // If the response is not ok, try the legacy URL (will be removed in 0.7)
    if (!response || !response?.ok) {
      // modify the uri based on https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc-04.html#section-6.3.1
      const vctElements = vct.split('/')
      vctElements.splice(3, 0, '.well-known/vct')
      const legacyVctUrl = vctElements.join('/')

      response = await agentContext.config.agentDependencies.fetch(legacyVctUrl).catch(() => undefined)
    }

    if (!response?.ok) {
      if (!throwErrorOnFetchError) return undefined

      if (firstResponse) {
        throw new SdJwtVcError(
          `Unable to resolve type metadata vct '${vct}'. Fetch returned a non-successful ${firstResponse.status} response. ${await firstResponse.text()}.`,
          { cause: firstError }
        )
      } else {
        throw new SdJwtVcError(
          `Unable to resolve type metadata vct '${vct}'. Fetch returned a non-successful response.`,
          { cause: firstError }
        )
      }
    }

    const typeMetadata = (await response.clone().json()) as SdJwtVcTypeMetadata
    if (vctIntegrity) {
      if (typeof vctIntegrity !== 'string') {
        throw new SdJwtVcError(`Found 'vct#integrity' with value '${vctIntegrity}' but value was not of type 'string'.`)
      }

      IntegrityVerifier.verifyIntegrity(new Uint8Array(await response.arrayBuffer()), vctIntegrity)
    }

    return typeMetadata
  }

  public async store(agentContext: AgentContext, options: SdJwtVcStoreOptions) {
    await this.sdJwtVcRepository.save(agentContext, options.record)
    return options.record
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
        publicJwk = await resolveSigningPublicJwkFromDidUrl(agentContext, issuer.didUrl)
      } else {
        const { verificationMethod } = await resolveDidUrl(agentContext, issuer.didUrl)
        publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
      }

      const supportedSignatureAlgorithms = publicJwk.supportedSignatureAlgorithms
      if (supportedSignatureAlgorithms.length === 0) {
        throw new SdJwtVcError(
          `No supported JWA signature algorithms found for key ${publicJwk.jwkTypeHumanDescription}`
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

    if (issuer.method === 'x5c') {
      const leafCertificate = issuer.x5c[0]
      if (!leafCertificate) {
        throw new SdJwtVcError("Empty 'x5c' array provided")
      }

      if (forSigning && !leafCertificate.publicJwk.hasKeyId) {
        throw new SdJwtVcError("Expected leaf certificate in 'x5c' array to have a key id configured.")
      }

      const publicJwk = leafCertificate.publicJwk
      const supportedSignatureAlgorithms = publicJwk.supportedSignatureAlgorithms
      if (supportedSignatureAlgorithms.length === 0) {
        throw new SdJwtVcError(
          `No supported JWA signature algorithms found for key ${publicJwk.jwkTypeHumanDescription}`
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

    const iss = sdJwtVc.jwt.payload.iss as string | undefined

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

    if (iss?.startsWith('did:')) {
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

    throw new SdJwtVcError('Unsupported signing method for SD-JWT VC. Only did and x5c are supported at the moment.')
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
