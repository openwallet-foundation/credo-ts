import type { OfferedCredentialWithMetadata } from './utils/IssuerMetadataUtils'
import type {
  AgentContext,
  JwaSignatureAlgorithm,
  VerificationMethod,
  W3cVerifiableCredential,
  W3cVerifyCredentialResult,
} from '@aries-framework/core'
import type {
  AccessTokenResponse,
  CredentialOfferPayloadV1_0_11,
  CredentialResponse,
  EndpointMetadataResult,
  Jwt,
  OpenIDResponse,
  PushedAuthorizationResponse,
  UniformCredentialOfferPayload,
  AuthorizationDetails,
} from '@sphereon/oid4vci-common'

import {
  AriesFrameworkError,
  Hasher,
  InjectionSymbols,
  JsonEncoder,
  JsonTransformer,
  JwsService,
  Logger,
  SignatureSuiteRegistry,
  TypedArrayEncoder,
  W3cCredentialRecord,
  W3cCredentialService,
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
  getJwkClassFromJwaSignatureAlgorithm,
  getJwkFromKey,
  getKeyFromVerificationMethod,
  getSupportedVerificationMethodTypesFromKeyType,
  inject,
  injectable,
  parseDid,
  equalsIgnoreOrder,
  getJwkClassFromKeyType,
} from '@aries-framework/core'
import { SdJwtVcService, type SdJwtVcRecord } from '@aries-framework/sd-jwt-vc'
import {
  AccessTokenClient,
  CredentialOfferClient,
  CredentialRequestClientBuilder,
  ProofOfPossessionBuilder,
  formPost,
} from '@sphereon/oid4vci-client'
import {
  OpenId4VCIVersion,
  CodeChallengeMethod,
  assertedUniformCredentialOffer,
  ResponseType,
  convertJsonToURI,
  JsonURIMode,
} from '@sphereon/oid4vci-common'

import {
  type AuthCodeFlowOptions,
  type AcceptCredentialOfferOptions,
  type ProofOfPossessionRequirements,
  type ProofOfPossessionVerificationMethodResolver,
  type ResolvedCredentialOffer,
  type ResolvedAuthorizationRequest,
  type ResolvedAuthorizationRequestWithCode,
  type SupportedCredentialFormats,
  supportedCredentialFormats,
} from './OpenId4VciHolderServiceOptions'
import { OpenIdCredentialFormatProfile } from './utils'
import { getFormatForVersion, getUniformFormat } from './utils/Formats'
import {
  getMetadataFromCredentialOffer,
  getOfferedCredentialsWithMetadata,
  getSupportedCredentials,
  handleAuthorizationDetails,
  OfferedCredentialType,
} from './utils/IssuerMetadataUtils'

// TODO: duplicate
/**
 * Returns the JWA Signature Algorithms that are supported by the wallet.
 *
 * This is an approximation based on the supported key types of the wallet.
 * This is not 100% correct as a supporting a key type does not mean you support
 * all the algorithms for that key type. However, this needs refactoring of the wallet
 * that is planned for the 0.5.0 release.
 */
export function getSupportedJwaSignatureAlgorithms(agentContext: AgentContext): JwaSignatureAlgorithm[] {
  const supportedKeyTypes = agentContext.wallet.supportedKeyTypes

  // Extract the supported JWS algs based on the key types the wallet support.
  const supportedJwaSignatureAlgorithms = supportedKeyTypes
    // Map the supported key types to the supported JWK class
    .map(getJwkClassFromKeyType)
    // Filter out the undefined values
    .filter((jwkClass): jwkClass is Exclude<typeof jwkClass, undefined> => jwkClass !== undefined)
    // Extract the supported JWA signature algorithms from the JWK class
    .flatMap((jwkClass) => jwkClass.supportedSignatureAlgorithms)

  return supportedJwaSignatureAlgorithms
}

function getV8CredentialType(offeredCredentialWithMetadata: OfferedCredentialWithMetadata, version: OpenId4VCIVersion) {
  if (offeredCredentialWithMetadata.offerType === OfferedCredentialType.InlineCredentialOffer) {
    throw new AriesFrameworkError(`Inline credential offers not supported for version < 11`)
  }

  if (!offeredCredentialWithMetadata.credentialSupported.id) {
    throw new AriesFrameworkError( // This should not happen
      `No id provided for a credential supported entry in combination with the OpenId4VCI v8 draft`
    )
  }

  const originalFormat = getFormatForVersion(offeredCredentialWithMetadata.format, version)
  const credentialType = offeredCredentialWithMetadata.credentialSupported.id.split(`-${originalFormat}`)[0]
  return credentialType
}

async function createAuthorizationRequestUri(options: {
  credentialOffer: CredentialOfferPayloadV1_0_11
  metadata: EndpointMetadataResult
  clientId: string
  codeChallenge: string
  codeChallengeMethod: CodeChallengeMethod
  authDetails?: AuthorizationDetails | AuthorizationDetails[]
  redirectUri: string
  scope?: string[]
}) {
  const { scope, authDetails, metadata, clientId, codeChallenge, codeChallengeMethod, redirectUri } = options
  let nonEmptyScope = !scope || scope.length === 0 ? undefined : scope
  const nonEmptyAuthDetails = !authDetails || authDetails.length === 0 ? undefined : authDetails

  // Scope and authorization_details can be used in the same authorization request
  // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-rar-23#name-relationship-to-scope-param
  if (!nonEmptyScope && !nonEmptyAuthDetails) {
    throw new AriesFrameworkError(`Please provide a 'scope' or 'authDetails' via the options.`)
  }

  // Authorization servers supporting PAR SHOULD include the URL of their pushed authorization request endpoint in their authorization server metadata document
  // Note that the presence of pushed_authorization_request_endpoint is sufficient for a client to determine that it may use the PAR flow.
  const parEndpoint = metadata.credentialIssuerMetadata?.pushed_authorization_request_endpoint

  const authorizationEndpoint = metadata.credentialIssuerMetadata?.authorization_endpoint

  if (!authorizationEndpoint && !parEndpoint) {
    throw new AriesFrameworkError(
      "Server metadata does not contain an 'authorization_endpoint' which is required for the 'Authorization Code Flow'"
    )
  }

  // add 'openid' scope if not present
  if (nonEmptyScope && !nonEmptyScope?.includes('openid')) {
    nonEmptyScope = ['openid', ...nonEmptyScope]
  }

  const queryObj: Record<string, string> = {
    client_id: clientId,
    response_type: ResponseType.AUTH_CODE,
    code_challenge_method: codeChallengeMethod,
    code_challenge: codeChallenge,
    redirect_uri: redirectUri,
  }

  if (nonEmptyScope) queryObj['scope'] = nonEmptyScope.join(' ')

  if (nonEmptyAuthDetails)
    queryObj['authorization_details'] = JSON.stringify(handleAuthorizationDetails(nonEmptyAuthDetails, metadata))

  const issuerState = options.credentialOffer.grants?.authorization_code?.issuer_state
  if (issuerState) queryObj['issuer_state'] = issuerState

  if (parEndpoint) {
    const body = new URLSearchParams(queryObj)
    const response = await formPost<PushedAuthorizationResponse>(parEndpoint, body)
    if (!response.successBody) {
      throw new AriesFrameworkError(`Could not acquire the authorization request uri from '${parEndpoint}'`)
    }
    return convertJsonToURI(
      { request_uri: response.successBody.request_uri, client_id: clientId, response_type: ResponseType.AUTH_CODE },
      {
        baseUrl: authorizationEndpoint,
        uriTypeProperties: ['request_uri', 'client_id', 'response_type'],
        mode: JsonURIMode.X_FORM_WWW_URLENCODED,
      }
    )
  } else {
    return convertJsonToURI(queryObj, {
      baseUrl: authorizationEndpoint,
      uriTypeProperties: ['redirect_uri', 'scope', 'authorization_details', 'issuer_state'],
      mode: JsonURIMode.X_FORM_WWW_URLENCODED,
    })
  }
}

@injectable()
export class OpenId4VciHolderService {
  private logger: Logger
  private w3cCredentialService: W3cCredentialService
  private jwsService: JwsService

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    w3cCredentialService: W3cCredentialService,
    jwsService: JwsService
  ) {
    this.w3cCredentialService = w3cCredentialService
    this.jwsService = jwsService
    this.logger = logger
  }

  public async resolveCredentialOffer(
    credentialOffer: UniformCredentialOfferPayload | string,
    opts?: { version?: OpenId4VCIVersion }
  ): Promise<ResolvedCredentialOffer> {
    let version = opts?.version ?? OpenId4VCIVersion.VER_1_0_11

    if (typeof credentialOffer === 'string' && URL.canParse(credentialOffer)) {
      const credentialOfferWithBaseUrl = await CredentialOfferClient.fromURI(credentialOffer)
      credentialOffer = credentialOfferWithBaseUrl.credential_offer
      version = credentialOfferWithBaseUrl.version
    }

    const uniformCredentialOffer = {
      credential_offer: typeof credentialOffer === 'string' ? undefined : credentialOffer,
      credential_offer_uri: typeof credentialOffer === 'string' ? credentialOffer : undefined,
    }

    const credentialOfferPayload = (await assertedUniformCredentialOffer(uniformCredentialOffer)).credential_offer
    const { metadata, issuerMetadata } = await getMetadataFromCredentialOffer(credentialOfferPayload)

    this.logger.info('Fetched server metadata', {
      issuer: metadata.issuer,
      credentialEndpoint: metadata.credential_endpoint,
      tokenEndpoint: metadata.token_endpoint,
    })

    this.logger.debug('Full server metadata', metadata)

    const credentialsSupported = getSupportedCredentials({ issuerMetadata, version })
    const offeredCredentialsWithMetadata = getOfferedCredentialsWithMetadata(
      credentialOfferPayload.credentials,
      credentialsSupported
    )

    return {
      metadata,
      credentialOfferPayload,
      offeredCredentials: offeredCredentialsWithMetadata,
      version,
    }
  }

  private getScopeForOfferedCredential(
    credentialWithMetadata: OfferedCredentialWithMetadata,
    version: OpenId4VCIVersion
  ): string | undefined {
    const { format, offerType } = credentialWithMetadata

    // TODO: sdjwt
    if (version <= OpenId4VCIVersion.VER_1_0_11) {
      return undefined
    }

    // TODO: sdjwt
    if (offerType === OfferedCredentialType.CredentialSupported) {
      const scope =
        'scope' in credentialWithMetadata.credentialSupported
          ? credentialWithMetadata.credentialSupported.scope
          : undefined
      if (format === OpenIdCredentialFormatProfile.SdJwtVc && !scope) {
        throw new AriesFrameworkError('Scope is required the request the issuance of a SdJwtVc')
      }

      return scope as string
    }

    return undefined
  }

  private getAuthDetailsFromOfferedCredential(
    credentialWithMetadata: OfferedCredentialWithMetadata,
    authDetailsLocation: string | undefined,
    version: OpenId4VCIVersion
  ): AuthorizationDetails | undefined {
    const { format, types, offerType } = credentialWithMetadata
    const type = 'openid_credential'

    if (version < OpenId4VCIVersion.VER_1_0_11) {
      // TODO: this is valid 08
      // const credentialType = getV8CredentialType(credentialWithMetadata, version)
      // return { type, credential_type: credentialType, format }
      return undefined
    }

    const locations = authDetailsLocation ? [authDetailsLocation] : undefined
    if (format === OpenIdCredentialFormatProfile.JwtVcJson) {
      return { type, format, types, locations }
    } else if (format === OpenIdCredentialFormatProfile.LdpVc || format === OpenIdCredentialFormatProfile.JwtVcJsonLd) {
      // Inline Credential Offers come with no context so we cannot create the authorization_details
      // This type of credentials can only be requested via scopes
      if (offerType === OfferedCredentialType.InlineCredentialOffer) return undefined

      const credential_definition = {
        '@context': credentialWithMetadata.credentialSupported['@context'],
        types,
        credentialSubject: credentialWithMetadata.credentialSupported.credentialSubject,
      }

      return { type, format, locations, credential_definition }
    } else if (format === OpenIdCredentialFormatProfile.SdJwtVc) {
      const credential_definition = {
        vct: types[0],
        claims:
          offerType === OfferedCredentialType.InlineCredentialOffer
            ? credentialWithMetadata.credentialOffer.credential_definition.claims
            : credentialWithMetadata.credentialSupported.credential_definition.claims,
      }

      return { type, format, locations, credential_definition }
    } else {
      throw new AriesFrameworkError(`Cannot create authorization_details. Unsupported credential format '${format}'.`)
    }
  }

  public async resolveAuthorizationRequest(
    agentContext: AgentContext,
    resolvedCredentialOffer: ResolvedCredentialOffer,
    authCodeFlowOptions: AuthCodeFlowOptions
  ): Promise<ResolvedAuthorizationRequest> {
    const { credentialOfferPayload, metadata: _metadata, version } = resolvedCredentialOffer
    const codeVerifier = (
      await Promise.all([agentContext.wallet.generateNonce(), agentContext.wallet.generateNonce()])
    ).join('')
    const codeVerifierSha256 = Hasher.hash(TypedArrayEncoder.fromString(codeVerifier), 'sha2-256')
    const codeChallenge = TypedArrayEncoder.toBase64URL(codeVerifierSha256)

    const { metadata, issuerMetadata } = await getMetadataFromCredentialOffer(credentialOfferPayload, _metadata)
    const credentialsSupported = getSupportedCredentials({ issuerMetadata, version })

    const offeredCredentialsWithMetadata = getOfferedCredentialsWithMetadata(
      credentialOfferPayload.credentials,
      credentialsSupported
    )

    this.logger.debug('Converted code_verifier to code_challenge', {
      codeVerifier: codeVerifier,
      sha256: codeVerifierSha256.toString(),
      base64Url: codeChallenge,
    })

    let authDetailsLocation: string | undefined
    if (issuerMetadata.authorization_server) {
      authDetailsLocation = metadata.issuer
    }

    const authDetails = offeredCredentialsWithMetadata
      .map((credential) => this.getAuthDetailsFromOfferedCredential(credential, authDetailsLocation, version))
      .filter((authDetail): authDetail is AuthorizationDetails => authDetail !== undefined)

    const scopes = offeredCredentialsWithMetadata
      .map((credential) => this.getScopeForOfferedCredential(credential, version))
      .filter((scope): scope is string => scope !== undefined)

    const { clientId, redirectUri, scope } = authCodeFlowOptions
    const authorizationRequestUri = await createAuthorizationRequestUri({
      clientId,
      codeChallenge,
      redirectUri,
      credentialOffer: credentialOfferPayload,
      codeChallengeMethod: CodeChallengeMethod.SHA256,
      // TODO: sdjwt don't pass scope, it is always obtained from the metadata now
      scope: [...(scope ?? []), ...scopes],
      // TODO: should we now always use scopes instead of authDetails? or both????
      authDetails,
      metadata,
    })

    return {
      ...authCodeFlowOptions,
      codeVerifier,
      authorizationRequestUri,
    }
  }

  public async acceptCredentialOffer(
    agentContext: AgentContext,
    options: {
      resolvedCredentialOffer: ResolvedCredentialOffer
      acceptCredentialOfferOptions: AcceptCredentialOfferOptions
      resolvedAuthorizationRequestWithCode?: ResolvedAuthorizationRequestWithCode
    }
  ) {
    const { resolvedCredentialOffer, acceptCredentialOfferOptions, resolvedAuthorizationRequestWithCode } = options
    const { credentialOfferPayload, metadata: _metadata, version } = resolvedCredentialOffer

    const { credentialsToRequest, userPin, proofOfPossessionVerificationMethodResolver, verifyCredentialStatus } =
      acceptCredentialOfferOptions

    if (credentialsToRequest?.length === 0) {
      this.logger.warn(`Accepting 0 credential offers. Returning`)
      return []
    }

    this.logger.info(`Accepting the following credential offers '${credentialsToRequest}'`)

    const { metadata, issuerMetadata } = await getMetadataFromCredentialOffer(credentialOfferPayload, _metadata)
    const supportedJwaSignatureAlgorithms = getSupportedJwaSignatureAlgorithms(agentContext)

    const allowedProofOfPossessionSigAlgs = acceptCredentialOfferOptions.allowedProofOfPossessionSignatureAlgorithms
    const possibleProofOfPossessionSigAlgs = allowedProofOfPossessionSigAlgs
      ? allowedProofOfPossessionSigAlgs.filter((algorithm) => supportedJwaSignatureAlgorithms.includes(algorithm))
      : supportedJwaSignatureAlgorithms

    if (possibleProofOfPossessionSigAlgs.length === 0) {
      throw new AriesFrameworkError(
        [
          `No possible proof of possession signature algorithm found.`,
          `Signature algorithms supported by the Agent '${supportedJwaSignatureAlgorithms.join(', ')}'`,
          `Allowed Signature algorithms '${allowedProofOfPossessionSigAlgs?.join(', ')}'`,
        ].join('\n')
      )
    }

    // acquire the access token
    let accessTokenResponse: OpenIDResponse<AccessTokenResponse>

    const accessTokenClient = new AccessTokenClient()
    if (resolvedAuthorizationRequestWithCode) {
      const { code, codeVerifier, redirectUri } = resolvedAuthorizationRequestWithCode
      accessTokenResponse = await accessTokenClient.acquireAccessToken({
        metadata,
        credentialOffer: { credential_offer: credentialOfferPayload },
        pin: userPin,
        code,
        codeVerifier,
        redirectUri,
      })
    } else {
      accessTokenResponse = await accessTokenClient.acquireAccessToken({
        metadata,
        credentialOffer: { credential_offer: credentialOfferPayload },
        pin: userPin,
      })
    }

    if (!accessTokenResponse.successBody) {
      throw new AriesFrameworkError(`could not acquire access token from '${metadata.issuer}'.`)
    }

    this.logger.debug('Requested OpenId4VCI Access Token.')

    const accessToken = accessTokenResponse.successBody

    const credentialsSupported = getSupportedCredentials({ issuerMetadata, version })

    const offeredCredentialsWithMetadata = getOfferedCredentialsWithMetadata(
      credentialOfferPayload.credentials,
      credentialsSupported
    )

    const credentialsToRequestWithMetadata = credentialsToRequest?.map((ctr) => {
      const credentialToRequest = offeredCredentialsWithMetadata.find((offeredCredentialWithMetadata) => {
        const { format, types } = offeredCredentialWithMetadata
        return ctr.format === format && equalsIgnoreOrder(ctr.types, types)
      })

      if (!credentialToRequest)
        throw new AriesFrameworkError(
          [
            `Could not find the the requested credential with format '${ctr.format}'`,
            `and types '${ctr.types.join()}' in the offered credentials.`,
          ].join(' ')
        )

      return credentialToRequest
    })

    const receivedCredentials: (W3cCredentialRecord | SdJwtVcRecord)[] = []

    let newCNonce: string | undefined

    for (const credentialWithMetadata of credentialsToRequestWithMetadata ?? offeredCredentialsWithMetadata) {
      // Get all options for the credential request (such as which kid to use, the signature algorithm, etc)
      const { verificationMethod, signatureAlgorithm } = await this.getCredentialRequestOptions(agentContext, {
        possibleProofOfPossessionSignatureAlgorithms: possibleProofOfPossessionSigAlgs,
        offeredCredentialWithMetadata: credentialWithMetadata,
        proofOfPossessionVerificationMethodResolver,
      })

      // Create the proof of possession
      const proofOfPossessionBuilder = ProofOfPossessionBuilder.fromAccessTokenResponse({
        accessTokenResponse: accessToken,
        callbacks: { signCallback: this.signCallback(agentContext, verificationMethod) },
        version,
      })
        .withEndpointMetadata(metadata)
        .withAlg(signatureAlgorithm)
        .withClientId(verificationMethod.controller)
        .withKid(verificationMethod.id)

      if (newCNonce) proofOfPossessionBuilder.withAccessTokenNonce(newCNonce)

      const proofOfPossession = await proofOfPossessionBuilder.build()
      this.logger.debug('Generated JWS', proofOfPossession)

      // Acquire the credential
      const credentialRequestBuilder = new CredentialRequestClientBuilder()
      credentialRequestBuilder
        .withVersion(version)
        .withCredentialEndpoint(metadata.credential_endpoint)
        .withTokenFromResponse(accessToken)

      const format = credentialWithMetadata.format

      let credentialTypes: string | string[]
      if (version < OpenId4VCIVersion.VER_1_0_11) {
        if (credentialWithMetadata.offerType === OfferedCredentialType.InlineCredentialOffer) {
          throw new AriesFrameworkError(`Inline credential offers not supported for version < 11`)
        }
        credentialTypes = getV8CredentialType(credentialWithMetadata, version)
      } else {
        credentialTypes = credentialWithMetadata.types
      }

      const credentialRequestClient = credentialRequestBuilder.build()
      const credentialResponse = await credentialRequestClient.acquireCredentialsUsingProof({
        proofInput: proofOfPossession,
        credentialTypes,
        format: getFormatForVersion(format, version),
      })

      newCNonce = credentialResponse.successBody?.c_nonce

      // Create credential record, but we don't store it yet (only after the user has accepted the credential)
      const credentialRecord = await this.handleCredentialResponse(agentContext, credentialResponse, {
        verifyCredentialStatus: verifyCredentialStatus ?? false,
        holderDidUrl: verificationMethod.id,
        issuerDidUrl: verificationMethod.controller, // TODO: how to figure this out?
      })

      this.logger.debug('Full credential', credentialRecord)
      receivedCredentials.push(credentialRecord)
    }

    return receivedCredentials
  }

  /**
   * Get the options for the credential request. Internally this will resolve the proof of possession
   * requirements, and based on that it will call the proofOfPossessionVerificationMethodResolver to
   * allow the caller to select the correct verification method based on the requirements for the proof
   * of possession.
   */
  private async getCredentialRequestOptions(
    agentContext: AgentContext,
    options: {
      proofOfPossessionVerificationMethodResolver: ProofOfPossessionVerificationMethodResolver
      possibleProofOfPossessionSignatureAlgorithms: JwaSignatureAlgorithm[]
      offeredCredentialWithMetadata: OfferedCredentialWithMetadata
    }
  ) {
    const { signatureAlgorithm, supportedDidMethods, supportsAllDidMethods } = this.getProofOfPossessionRequirements(
      agentContext,
      {
        credentialsToRequest: options.offeredCredentialWithMetadata,
        possibleProofOfPossessionSignatureAlgorithms: options.possibleProofOfPossessionSignatureAlgorithms,
      }
    )

    const JwkClass = getJwkClassFromJwaSignatureAlgorithm(signatureAlgorithm)
    if (!JwkClass) {
      throw new AriesFrameworkError(
        `Could not determine JWK key type of the JWA signature algorithm '${signatureAlgorithm}'`
      )
    }

    const supportedVerificationMethods = getSupportedVerificationMethodTypesFromKeyType(JwkClass.keyType)

    const format = options.offeredCredentialWithMetadata.format as SupportedCredentialFormats

    // Now we need to determine the did method and alg based on the cryptographic suite
    const verificationMethod = await options.proofOfPossessionVerificationMethodResolver({
      credentialFormat: format,
      proofOfPossessionSignatureAlgorithm: signatureAlgorithm,
      supportedVerificationMethods,
      keyType: JwkClass.keyType,
      supportedCredentialId: !(
        options.offeredCredentialWithMetadata.offerType === OfferedCredentialType.InlineCredentialOffer
      )
        ? options.offeredCredentialWithMetadata.credentialSupported.id
        : undefined,
      supportsAllDidMethods,
      supportedDidMethods,
    })

    // Make sure the verification method uses a supported did method
    if (
      !supportsAllDidMethods &&
      // If supportedDidMethods is undefined, it means the issuer didn't include the binding methods in the metadata
      // The user can still select a verification method, but we can't validate it
      supportedDidMethods !== undefined &&
      !supportedDidMethods.find((supportedDidMethod) => verificationMethod.id.startsWith(supportedDidMethod))
    ) {
      const { method } = parseDid(verificationMethod.id)
      const supportedDidMethodsString = supportedDidMethods.join(', ')
      throw new AriesFrameworkError(
        `Verification method uses did method '${method}', but issuer only supports '${supportedDidMethodsString}'`
      )
    }

    // Make sure the verification method uses a supported verification method type
    if (!supportedVerificationMethods.includes(verificationMethod.type)) {
      const supportedVerificationMethodsString = supportedVerificationMethods.join(', ')
      throw new AriesFrameworkError(
        `Verification method uses verification method type '${verificationMethod.type}', but only '${supportedVerificationMethodsString}' verification methods are supported for key type '${JwkClass.keyType}'`
      )
    }

    return { verificationMethod, signatureAlgorithm }
  }

  /**
   * Get the requirements for creating the proof of possession. Based on the allowed
   * credential formats, the allowed proof of possession signature algorithms, and the
   * credential type, this method will select the best credential format and signature
   * algorithm to use, based on the order of preference.
   */
  private getProofOfPossessionRequirements(
    agentContext: AgentContext,
    options: {
      credentialsToRequest: OfferedCredentialWithMetadata
      possibleProofOfPossessionSignatureAlgorithms: JwaSignatureAlgorithm[]
    }
  ): ProofOfPossessionRequirements {
    const { credentialsToRequest } = options

    if (credentialsToRequest.offerType === OfferedCredentialType.CredentialSupported) {
      if (!supportedCredentialFormats.includes(credentialsToRequest.format as SupportedCredentialFormats)) {
        throw new AriesFrameworkError(
          [
            `Requested credential with format '${credentialsToRequest.format}',`,
            `for the credential of type '${credentialsToRequest.types.join(', ')},`,
            `but the wallet only supports the following formats '${supportedCredentialFormats.join(', ')}'`,
          ].join('\n')
        )
      }
    }

    // For each of the supported algs, find the key types, then find the proof types
    const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

    let signatureAlgorithm: JwaSignatureAlgorithm | undefined

    const credentialSupported =
      credentialsToRequest.offerType === OfferedCredentialType.CredentialSupported
        ? credentialsToRequest.credentialSupported
        : undefined

    const issuerSupportedCryptographicSuites = credentialSupported?.cryptographic_suites_supported
    const issuerSupportedBindingMethods = credentialSupported?.cryptographic_binding_methods_supported

    // If undefined, it means the issuer didn't include the cryptographic suites in the metadata
    // We just guess that the first one is supported
    if (issuerSupportedCryptographicSuites === undefined) {
      signatureAlgorithm = options.possibleProofOfPossessionSignatureAlgorithms[0]
    } else {
      switch (credentialsToRequest.format) {
        case OpenIdCredentialFormatProfile.JwtVcJson:
        case OpenIdCredentialFormatProfile.JwtVcJsonLd:
        case OpenIdCredentialFormatProfile.SdJwtVc:
          signatureAlgorithm = options.possibleProofOfPossessionSignatureAlgorithms.find((signatureAlgorithm) =>
            issuerSupportedCryptographicSuites.includes(signatureAlgorithm)
          )
          break
        case OpenIdCredentialFormatProfile.LdpVc:
          signatureAlgorithm = options.possibleProofOfPossessionSignatureAlgorithms.find((signatureAlgorithm) => {
            const JwkClass = getJwkClassFromJwaSignatureAlgorithm(signatureAlgorithm)
            if (!JwkClass) return false

            const matchingSuite = signatureSuiteRegistry.getByKeyType(JwkClass.keyType)
            if (matchingSuite.length === 0) return false

            return issuerSupportedCryptographicSuites.includes(matchingSuite[0].proofType)
          })
          break
        default:
          throw new AriesFrameworkError(`Unsupported credential format.`)
      }
    }

    if (!signatureAlgorithm) {
      throw new AriesFrameworkError(
        `Could not establish signature algorithm for format ${credentialsToRequest.format} and id ${
          credentialSupported?.id ?? 'Inline credential offer'
        }`
      )
    }

    const supportsAllDidMethods = issuerSupportedBindingMethods?.includes('did') ?? false
    const supportedDidMethods = issuerSupportedBindingMethods?.filter((method) => method.startsWith('did:'))

    return {
      signatureAlgorithm,
      supportedDidMethods,
      supportsAllDidMethods,
    }
  }
  private async handleCredentialResponse(
    agentContext: AgentContext,
    credentialResponse: OpenIDResponse<CredentialResponse>,
    options: { verifyCredentialStatus: boolean; holderDidUrl: string; issuerDidUrl: string }
  ): Promise<W3cCredentialRecord | SdJwtVcRecord> {
    const { verifyCredentialStatus, holderDidUrl } = options
    this.logger.debug('Credential request response', credentialResponse)

    if (!credentialResponse.successBody) {
      throw new AriesFrameworkError('Did not receive a successful credential response.')
    }

    const format = getUniformFormat(credentialResponse.successBody.format)

    if (format === OpenIdCredentialFormatProfile.SdJwtVc) {
      const sdJwtVcService = agentContext.dependencyManager.resolve(SdJwtVcService)
      if (!sdJwtVcService)
        throw new AriesFrameworkError('Received an SdJwtVc but no SdJwtVc-Module available for the agent.')

      if (typeof credentialResponse.successBody.credential !== 'string')
        throw new AriesFrameworkError(
          `Received a credential of format ${
            OpenIdCredentialFormatProfile.SdJwtVc
          }, but the credential is not a string. ${JSON.stringify(credentialResponse.successBody.credential)}`
        )

      // TODO
      const sdJwtVcRecord = await sdJwtVcService.fromString(agentContext, credentialResponse.successBody.credential, {
        holderDidUrl,
        issuerDidUrl:
          'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9#z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
      })

      return sdJwtVcRecord
    }

    let credential: W3cVerifiableCredential
    let result: W3cVerifyCredentialResult
    if (format === OpenIdCredentialFormatProfile.JwtVcJson || format === OpenIdCredentialFormatProfile.JwtVcJsonLd) {
      // validate json-ld credentials
      credential = JsonTransformer.fromJSON(credentialResponse.successBody.credential, W3cJsonLdVerifiableCredential)
      result = await this.w3cCredentialService.verifyCredential(agentContext, { credential, verifyCredentialStatus })
    } else if (format === OpenIdCredentialFormatProfile.LdpVc) {
      // validate jwt credentials
      credential = W3cJwtVerifiableCredential.fromSerializedJwt(credentialResponse.successBody.credential as string)
      result = await this.w3cCredentialService.verifyCredential(agentContext, { credential, verifyCredentialStatus })
    } else {
      throw new AriesFrameworkError(`Unsupported credential format ${credentialResponse.successBody.format}`)
    }

    if (!result.isValid) {
      agentContext.config.logger.error('Failed to validate credential', { result })
      throw new AriesFrameworkError(`Failed to validate credential, error = ${result.error?.message ?? 'Unknown'}`)
    }

    return new W3cCredentialRecord({ credential, tags: { expandedTypes: [] } })
  }

  private signCallback(agentContext: AgentContext, verificationMethod: VerificationMethod) {
    return async (jwt: Jwt, kid?: string) => {
      if (!jwt.header) throw new AriesFrameworkError('No header present on JWT')
      if (!jwt.payload) throw new AriesFrameworkError('No payload present on JWT')
      if (!kid) throw new AriesFrameworkError('No KID is present in the callback')

      // We have determined the verification method before and already passed that when creating the callback,
      // however we just want to make sure that the kid matches the verification method id
      if (verificationMethod.id !== kid) {
        throw new AriesFrameworkError(`kid ${kid} does not match verification method id ${verificationMethod.id}`)
      }

      const key = getKeyFromVerificationMethod(verificationMethod)
      const jwk = getJwkFromKey(key)
      if (!jwk.supportsSignatureAlgorithm(jwt.header.alg)) {
        throw new AriesFrameworkError(
          `kid ${kid} refers to a key of type '${jwk.keyType}', which does not support the JWS signature alg '${jwt.header.alg}'`
        )
      }

      // We don't support these properties, remove them, so we can pass all other header properties to the JWS service
      if (jwt.header.x5c || jwt.header.jwk) throw new AriesFrameworkError('x5c and jwk are not supported')

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { x5c: _x5c, jwk: _jwk, ...supportedHeaderOptions } = jwt.header

      const jws = await this.jwsService.createJwsCompact(agentContext, {
        key,
        payload: JsonEncoder.toBuffer(jwt.payload),
        protectedHeaderOptions: supportedHeaderOptions,
      })

      return jws
    }
  }
}
