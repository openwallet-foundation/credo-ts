import type {
  AuthCodeFlowOptions,
  AuthDetails,
  CredentialToRequest,
  AcceptCredentialOfferOptions,
  ProofOfPossessionRequirements,
  ProofOfPossessionVerificationMethodResolver,
  SupportedCredentialFormats,
  ResolvedCredentialOffer,
  ResolvedAuthorizationRequest,
} from './OpenId4VciHolderServiceOptions'
import type { OpenIdCredentialFormatProfile } from './utils'
import type {
  AgentContext,
  JwaSignatureAlgorithm,
  VerificationMethod,
  W3cVerifiableCredential,
  W3cVerifyCredentialResult,
} from '@aries-framework/core'
import type {
  AccessTokenResponse,
  CredentialOfferFormat,
  CredentialOfferPayloadV1_0_11,
  CredentialResponse,
  CredentialSupported,
  EndpointMetadataResult,
  Jwt,
  OpenIDResponse,
  ProofOfPossessionCallbacks,
  PushedAuthorizationResponse,
  UniformCredentialOfferPayload,
} from '@sphereon/oid4vci-common'

import {
  AriesFrameworkError,
  ClaimFormat,
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
  getJwkClassFromKeyType,
  getJwkFromKey,
  getKeyFromVerificationMethod,
  getSupportedVerificationMethodTypesFromKeyType,
  inject,
  injectable,
  parseDid,
} from '@aries-framework/core'
import {
  AccessTokenClient,
  CredentialOfferClient,
  CredentialRequestClientBuilder,
  MetadataClient,
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
import { randomStringForEntropy } from '@stablelib/random'

import { fromOpenIdCredentialFormatProfileToDifClaimFormat } from './utils'
import { getUniformFormat } from './utils/Formats'
import { getSupportedCredentials } from './utils/IssuerMetadataUtils'

import { supportedCredentialFormats } from './OpenId4VciHolderServiceOptions'

/**
 * The type of a credential offer entry. For each item in `credentials` array, the type MUST be one of the following:
 *  - CredentialSupported, when the value is a string and points to a credential from the `credentials_supported` array.
 *  - InlineCredentialOffer, when the value is a JSON object that represents an inline credential offer.
 */
export enum OfferedCredentialType {
  CredentialSupported = 'CredentialSupported',
  InlineCredentialOffer = 'InlineCredentialOffer',
}

export type OfferedCredentialsWithMetadata =
  | { credentialSupported: CredentialSupported; type: OfferedCredentialType.CredentialSupported }
  | { inlineCredentialOffer: CredentialOfferFormat; type: OfferedCredentialType.InlineCredentialOffer }

interface AuthRequestOpts {
  credentialOffer: CredentialOfferPayloadV1_0_11
  metadata: EndpointMetadataResult
  clientId: string
  codeChallenge: string
  codeChallengeMethod: CodeChallengeMethod
  authDetails?: AuthDetails | AuthDetails[]
  redirectUri: string
  scope?: string[]
}

/**
 * @internal
 */
@injectable()
export class OpenId4VcHolderService {
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

  // TODO: copied from sphereon
  private handleAuthorizationDetails(
    metadata: EndpointMetadataResult,
    authorizationDetails?: AuthDetails | AuthDetails[]
  ): AuthDetails | AuthDetails[] | undefined {
    if (authorizationDetails) {
      if (Array.isArray(authorizationDetails)) {
        return authorizationDetails.map((value) => this.handleLocations({ ...value }, metadata))
      } else {
        return this.handleLocations({ ...authorizationDetails }, metadata)
      }
    }
    return authorizationDetails
  }

  // TODO copied from sphereon
  private handleLocations(authorizationDetails: AuthDetails, metadata: EndpointMetadataResult) {
    if (
      authorizationDetails &&
      (metadata.credentialIssuerMetadata?.authorization_server || metadata.authorization_endpoint)
    ) {
      if (authorizationDetails.locations) {
        if (Array.isArray(authorizationDetails.locations)) {
          ;(authorizationDetails.locations as string[]).push(metadata.issuer)
        } else {
          authorizationDetails.locations = [authorizationDetails.locations as string, metadata.issuer]
        }
      } else {
        authorizationDetails.locations = metadata.issuer
      }
    }
    return authorizationDetails
  }

  // TODO: copied from sphereon
  public async acquireAuthorizationRequestCode({
    credentialOffer,
    metadata,
    clientId,
    codeChallengeMethod,
    codeChallenge,
    redirectUri,
    scope: _scope,
    authDetails: _authDetails,
  }: AuthRequestOpts) {
    let scope = !_scope || _scope.length === 0 ? undefined : _scope?.join(' ')
    const authDetails = !_authDetails || _authDetails.length === 0 ? undefined : _authDetails

    // Scope and authorization_details can be used in the same authorization request
    // https://datatracker.ietf.org/doc/html/draft-ietf-oauth-rar-23#name-relationship-to-scope-param
    if (!scope && !authDetails) {
      throw new AriesFrameworkError('Please provide a scope or authorization_details')
    }

    // Authorization servers supporting PAR SHOULD include the URL of their pushed authorization request endpoint in their authorization server metadata document
    // Note that the presence of pushed_authorization_request_endpoint is sufficient for a client to determine that it may use the PAR flow.
    // What happens if it doesn't ???
    let parEndpoint = metadata.credentialIssuerMetadata?.pushed_authorization_request_endpoint
    if (typeof parEndpoint !== 'string') parEndpoint = undefined

    let authorizationEndpoint = metadata.credentialIssuerMetadata?.authorization_endpoint
    if (typeof authorizationEndpoint !== 'string') authorizationEndpoint = undefined

    if (!authorizationEndpoint) {
      throw new AriesFrameworkError(
        "Server metadata does not contain 'authorization_endpoint'. Which is required for the Authorization Code Flow"
      )
    }

    // add 'openid' scope if not present
    if (!scope?.includes('openid')) {
      scope = ['openid', scope].filter((s) => !!s).join(' ')
    }

    const queryObj: { [key: string]: string } = {
      client_id: clientId,
      response_type: ResponseType.AUTH_CODE,
      code_challenge_method: codeChallengeMethod,
      code_challenge: codeChallenge,
      redirect_uri: redirectUri,
    }

    if (scope) queryObj['scope'] = scope

    const authorizationDetails = JSON.stringify(this.handleAuthorizationDetails(metadata, authDetails))
    if (authorizationDetails) queryObj['authorization_details'] = authorizationDetails

    const issuerState = credentialOffer.grants?.authorization_code?.issuer_state
    if (issuerState) queryObj['issuer_state'] = issuerState

    if (parEndpoint) {
      const body = new URLSearchParams(queryObj)
      const response = await formPost<PushedAuthorizationResponse>(parEndpoint, body)
      if (!response.successBody)
        throw new AriesFrameworkError(`Could not acquire the authorization request uri from '${parEndpoint}'`)
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

  private getFormatAndTypesFromOfferedCredential(
    offeredCredential: OfferedCredentialsWithMetadata,
    version: OpenId4VCIVersion
  ) {
    if (offeredCredential.type === OfferedCredentialType.InlineCredentialOffer) {
      const { format, types } = offeredCredential.inlineCredentialOffer
      return { format: format as SupportedCredentialFormats, types }
    } else {
      const { format, types } = offeredCredential.credentialSupported
      const uniFormat =
        version < OpenId4VCIVersion.VER_1_0_11 ? (getUniformFormat(format) as SupportedCredentialFormats) : format
      return { format: uniFormat, types }
    }
  }

  public async resolveCredentialOffer(
    credentialOffer: UniformCredentialOfferPayload | string,
    opts?: { version?: OpenId4VCIVersion }
  ) {
    let version = opts?.version ?? OpenId4VCIVersion.VER_1_0_11
    const claimedCredentialOfferUrl = `openid-credential-offer://?`
    const claimedIssuanceInitiationUrl = `openid-initiate-issuance://?`

    if (
      typeof credentialOffer === 'string' &&
      (credentialOffer.startsWith(claimedCredentialOfferUrl) ||
        credentialOffer.startsWith(claimedIssuanceInitiationUrl))
    ) {
      const credentialOfferWithBaseUrl = await CredentialOfferClient.fromURI(credentialOffer)
      credentialOffer = credentialOfferWithBaseUrl.credential_offer
      version = credentialOfferWithBaseUrl.version
    }

    const uniformCredentialOffer = {
      credential_offer: typeof credentialOffer === 'string' ? undefined : credentialOffer,
      credential_offer_uri: typeof credentialOffer === 'string' ? credentialOffer : undefined,
    }

    const credentialOfferPayload = (await assertedUniformCredentialOffer(uniformCredentialOffer)).credential_offer
    const issuer = credentialOfferPayload.credential_issuer

    const metadata = await MetadataClient.retrieveAllMetadata(issuer)
    if (!metadata) throw new AriesFrameworkError(`Could not retrieve metadata for OpenID4VCI issuer: ${issuer}`)

    this.logger.info('Fetched server metadata', {
      issuer: metadata.issuer,
      credentialEndpoint: metadata.credential_endpoint,
      tokenEndpoint: metadata.token_endpoint,
    })

    this.logger.debug('Full server metadata', metadata)

    const offeredCredentialsWithMetadata = this.getOfferedCredentialsWithMetadata(
      credentialOfferPayload,
      metadata.credentialIssuerMetadata,
      version
    )

    const credentialsToRequest: CredentialToRequest[] = offeredCredentialsWithMetadata.map((offeredCredential) => {
      const { format, types } = this.getFormatAndTypesFromOfferedCredential(offeredCredential, version)
      const offerType = offeredCredential.type

      if (offerType === OfferedCredentialType.InlineCredentialOffer) {
        return { offerType, types, format }
      } else {
        const { id, cryptographic_binding_methods_supported, cryptographic_suites_supported } =
          offeredCredential.credentialSupported

        return { id, offerType, cryptographic_binding_methods_supported, cryptographic_suites_supported, types, format }
      }
    })

    return {
      metadata,
      credentialOfferPayload,
      credentialsToRequest,
      version,
    }
  }

  public async resolveAuthorizationRequest(
    resolvedCredentialOffer: ResolvedCredentialOffer,
    authCodeFlowOptions: AuthCodeFlowOptions
  ): Promise<ResolvedAuthorizationRequest> {
    const { credentialOfferPayload, metadata: _metadata } = resolvedCredentialOffer

    // TODO: authdetails

    const issuer = credentialOfferPayload.credential_issuer
    const metadata = _metadata ? _metadata : await MetadataClient.retrieveAllMetadata(issuer)
    if (!metadata) throw new AriesFrameworkError(`Could not retrieve metadata for OpenID4VCI issuer: ${issuer}`)

    const codeVerifier = randomStringForEntropy(256)
    const codeVerifierSha256 = Hasher.hash(TypedArrayEncoder.fromString(codeVerifier), 'sha2-256')
    const codeChallenge = TypedArrayEncoder.toBase64URL(codeVerifierSha256)

    this.logger.debug('Converted code_verifier to code_challenge', {
      codeVerifier: codeVerifier,
      sha256: codeVerifierSha256.toString(),
      base64Url: codeChallenge,
    })

    const { clientId, redirectUri, scope, authDetails } = authCodeFlowOptions
    const authorizationRequestUri = await this.acquireAuthorizationRequestCode({
      credentialOffer: credentialOfferPayload,
      clientId,
      codeChallengeMethod: CodeChallengeMethod.SHA256,
      codeChallenge,
      redirectUri,
      scope,
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
      resolvedAuthorizationRequest?: ResolvedAuthorizationRequest & { code: string }
    }
  ) {
    const { resolvedCredentialOffer, acceptCredentialOfferOptions, resolvedAuthorizationRequest } = options

    const {
      credentialsToRequest,
      allowedProofOfPossessionSignatureAlgorithms: _allowedProofOfPossessionSignatureAlgorithms,
      userPin,
      proofOfPossessionVerificationMethodResolver,
      verifyCredentialStatus,
    } = acceptCredentialOfferOptions
    const { credentialOfferPayload, metadata: _metadata, version } = resolvedCredentialOffer

    if (credentialsToRequest?.length === 0) {
      this.logger.warn(`Accepting 0 credential offers. Returning`)
      return []
    }

    this.logger.info(`Accepting the following credential offers '${credentialsToRequest}'`)

    const issuer = credentialOfferPayload.credential_issuer
    const metadata = _metadata ? _metadata : await MetadataClient.retrieveAllMetadata(issuer)
    if (!metadata) throw new AriesFrameworkError(`Could not retrieve metadata for OpenID4VCI issuer: ${issuer}`)

    const issuerMetadata = metadata.credentialIssuerMetadata
    if (!issuerMetadata) throw new AriesFrameworkError('Found no credential issuer metadata')

    const supportedJwaSignatureAlgorithms = this.getSupportedJwaSignatureAlgorithms(agentContext)

    const allowedProofOfPossessionSignatureAlgorithms = _allowedProofOfPossessionSignatureAlgorithms
      ? _allowedProofOfPossessionSignatureAlgorithms.filter((algorithm) =>
          supportedJwaSignatureAlgorithms.includes(algorithm)
        )
      : supportedJwaSignatureAlgorithms

    if (allowedProofOfPossessionSignatureAlgorithms.length === 0) {
      throw new AriesFrameworkError(`No supported proof of possession signature algorithms found.`)
    }

    // acquire the access token
    let openIdAccessTokenResponse: OpenIDResponse<AccessTokenResponse>

    const accessTokenClient = new AccessTokenClient()
    if (resolvedAuthorizationRequest) {
      const { code, codeVerifier, redirectUri } = resolvedAuthorizationRequest
      openIdAccessTokenResponse = await accessTokenClient.acquireAccessToken({
        metadata,
        credentialOffer: { credential_offer: credentialOfferPayload },
        code,
        codeVerifier,
        redirectUri,
        pin: userPin,
      })
    } else {
      openIdAccessTokenResponse = await accessTokenClient.acquireAccessToken({
        metadata,
        credentialOffer: { credential_offer: credentialOfferPayload },
        pin: userPin,
      })
    }

    if (!openIdAccessTokenResponse.successBody) {
      throw new AriesFrameworkError(`could not acquire access token from '${metadata.issuer}'`)
    }
    this.logger.debug('Requested OpenId4VCI Access Token')

    const accessToken = openIdAccessTokenResponse.successBody

    const offeredCredentialsWithMetadata = this.getOfferedCredentialsWithMetadata(
      credentialOfferPayload,
      issuerMetadata,
      version
    )

    const credentialsToRequestWithMetadata = credentialsToRequest?.map((ctr) => {
      const credentialToRequest = offeredCredentialsWithMetadata.find((offeredCredentialWithMetadata) => {
        const { format, types } = this.getFormatAndTypesFromOfferedCredential(offeredCredentialWithMetadata, version)
        return ctr.format === format && ctr.types.sort().join(',') === types.sort().join(',')
      })

      if (!credentialToRequest)
        throw new AriesFrameworkError(
          `Could not find the the requested credential with format '${ctr.format}' and types '${ctr.types}' in the offered credentials`
        )

      return credentialToRequest
    })

    const receivedCredentials: W3cCredentialRecord[] = []

    // Loop through all the credentialTypes in the credential offer
    for (const credentialWithMetadata of credentialsToRequestWithMetadata ?? offeredCredentialsWithMetadata) {
      // Get all options for the credential request (such as which kid to use, the signature algorithm, etc)
      const { verificationMethod, signatureAlgorithm } = await this.getCredentialRequestOptions(agentContext, {
        allowedCredentialFormats: supportedCredentialFormats,
        allowedProofOfPossessionSignatureAlgorithms,
        offeredCredentialWithMetadata: credentialWithMetadata,
        proofOfPossessionVerificationMethodResolver: proofOfPossessionVerificationMethodResolver,
      })

      const callbacks: ProofOfPossessionCallbacks<unknown> = {
        signCallback: this.signCallback(agentContext, verificationMethod),
      }

      // Create the proof of possession
      const proofInput = await ProofOfPossessionBuilder.fromAccessTokenResponse({
        accessTokenResponse: accessToken,
        callbacks,
        version,
      })
        .withEndpointMetadata(metadata)
        .withAlg(signatureAlgorithm)
        .withClientId(verificationMethod.controller)
        .withKid(verificationMethod.id)
        .build()

      this.logger.debug('Generated JWS', proofInput)

      // Acquire the credential
      const credentialRequestBuilder = new CredentialRequestClientBuilder()
      credentialRequestBuilder
        .withVersion(version)
        .withCredentialEndpoint(metadata.credential_endpoint)
        .withTokenFromResponse(accessToken)

      const isInlineOffer = isInlineCredentialOffer(credentialWithMetadata)

      const format = isInlineOffer
        ? credentialWithMetadata.inlineCredentialOffer.format
        : credentialWithMetadata.credentialSupported.format

      let credentialTypes: string | string[]
      if (version < OpenId4VCIVersion.VER_1_0_11) {
        if (isInlineOffer) throw new AriesFrameworkError(`Inline credential offers not supported for version < 11`)
        if (!credentialWithMetadata.credentialSupported.id) {
          throw new AriesFrameworkError( // This should not happen
            `No id provided for a credential supported entry in combination with the OpenId4VCI v8 draft`
          )
        }
        credentialTypes = credentialWithMetadata.credentialSupported.id.split(`-${format}`)[0]
      } else {
        if (isInlineOffer) credentialTypes = credentialWithMetadata.inlineCredentialOffer.types
        else credentialTypes = credentialWithMetadata.credentialSupported.types
      }

      const credentialRequestClient = credentialRequestBuilder.build()
      const credentialResponse = await credentialRequestClient.acquireCredentialsUsingProof({
        proofInput,
        credentialTypes,
        format,
      })

      const credential = await this.handleCredentialResponse(agentContext, credentialResponse, {
        verifyCredentialStatus,
      })

      // Create credential record, but we don't store it yet (only after the user has accepted the credential)
      const credentialRecord = new W3cCredentialRecord({
        credential,
        tags: {
          expandedTypes: [],
        },
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
      allowedCredentialFormats: SupportedCredentialFormats[]
      allowedProofOfPossessionSignatureAlgorithms: JwaSignatureAlgorithm[]
      offeredCredentialWithMetadata: OfferedCredentialsWithMetadata
    }
  ) {
    const { signatureAlgorithm, supportedDidMethods, supportsAllDidMethods } = this.getProofOfPossessionRequirements(
      agentContext,
      {
        offeredCredentialWithMetadata: options.offeredCredentialWithMetadata,
        allowedCredentialFormats: options.allowedCredentialFormats,
        allowedProofOfPossessionSignatureAlgorithms: options.allowedProofOfPossessionSignatureAlgorithms,
      }
    )

    const JwkClass = getJwkClassFromJwaSignatureAlgorithm(signatureAlgorithm)

    if (!JwkClass) {
      throw new AriesFrameworkError(
        `Could not determine JWK key type based on JWA signature algorithm '${signatureAlgorithm}'`
      )
    }

    const supportedVerificationMethods = getSupportedVerificationMethodTypesFromKeyType(JwkClass.keyType)

    const format = (
      isInlineCredentialOffer(options.offeredCredentialWithMetadata)
        ? options.offeredCredentialWithMetadata.inlineCredentialOffer.format
        : options.offeredCredentialWithMetadata.credentialSupported.format
    ) as SupportedCredentialFormats

    // Now we need to determine the did method and alg based on the cryptographic suite
    const verificationMethod = await options.proofOfPossessionVerificationMethodResolver({
      credentialFormat: format,
      proofOfPossessionSignatureAlgorithm: signatureAlgorithm,
      supportedVerificationMethods,
      keyType: JwkClass.keyType,
      supportedCredentialId: !isInlineCredentialOffer(options.offeredCredentialWithMetadata)
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
   * Returns all entries from the credential offer with the associated metadata resolved. For inline entries, the offered credential object
   * is included directly. For 'id' entries, the associated `credentials_supported` object is resolved from the issuer metadata.
   *
   * NOTE: for v1_0-08, a single credential id in the issuer metadata could have multiple formats. This means that the returned value
   * from this method could contain multiple entries for a single credential id, but with different formats. This is detectable as the
   * id will be the `<credentialId>-<format>`.
   */
  private getOfferedCredentialsWithMetadata = (
    credentialOfferPayload: CredentialOfferPayloadV1_0_11,
    issuerMetadata: EndpointMetadataResult['credentialIssuerMetadata'],
    version: OpenId4VCIVersion
  ) => {
    const offeredCredentials: Array<OfferedCredentialsWithMetadata> = []

    const supportedCredentials = getSupportedCredentials({ issuerMetadata, version })

    for (const offeredCredential of credentialOfferPayload.credentials) {
      // If the offeredCredential is a string, it has to reference a supported credential in the issuer metadata
      if (typeof offeredCredential === 'string') {
        const foundSupportedCredentials = supportedCredentials.filter(
          (supportedCredential) =>
            supportedCredential.id === offeredCredential ||
            supportedCredential.id === `${offeredCredential}-${supportedCredential.format}`
        )

        // Make sure the issuer metadata includes the offered credential.
        if (foundSupportedCredentials.length === 0) {
          throw new Error(
            `Offered credential '${offeredCredential}' is not part of credentials_supported of the issuer metadata`
          )
        }

        for (const foundSupportedCredential of foundSupportedCredentials) {
          offeredCredentials.push({
            credentialSupported: foundSupportedCredential,
            type: OfferedCredentialType.CredentialSupported,
          } as const)
        }
      }
      // Otherwise it's an inline credential offer that does not reference a supported credential in the issuer metadata
      else {
        offeredCredentials.push({
          inlineCredentialOffer: offeredCredential,
          type: OfferedCredentialType.InlineCredentialOffer,
        } as const)
      }
    }

    return offeredCredentials
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
      offeredCredentialWithMetadata: OfferedCredentialsWithMetadata
      allowedCredentialFormats: SupportedCredentialFormats[]
      allowedProofOfPossessionSignatureAlgorithms: JwaSignatureAlgorithm[]
    }
  ): ProofOfPossessionRequirements {
    const { offeredCredentialWithMetadata, allowedCredentialFormats } = options
    const isInlineOffer = offeredCredentialWithMetadata.type === OfferedCredentialType.InlineCredentialOffer

    // Extract format from offer
    let format = isInlineOffer
      ? offeredCredentialWithMetadata.inlineCredentialOffer.format
      : offeredCredentialWithMetadata.credentialSupported.format

    // Get uniform format, so we don't have to deal with the different spec versions
    format = getUniformFormat(format)

    const credentialSupportedMetadata = isInlineOffer ? undefined : offeredCredentialWithMetadata.credentialSupported

    const issuerSupportedCryptographicSuites = credentialSupportedMetadata?.cryptographic_suites_supported
    const issuerSupportedBindingMethods =
      credentialSupportedMetadata?.cryptographic_binding_methods_supported ??
      // FIXME: somehow the MATTR Launchpad returns binding_methods_supported instead of cryptographic_binding_methods_supported
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      (credentialSupportedMetadata?.binding_methods_supported as string[] | undefined)

    if (!isInlineOffer) {
      const credentialMetadata = offeredCredentialWithMetadata.credentialSupported
      if (!allowedCredentialFormats.includes(format as SupportedCredentialFormats)) {
        throw new AriesFrameworkError(
          `Issuer only supports format '${format}' for credential type '${credentialMetadata.types.join(
            ', '
          )}', but the wallet only allows formats '${options.allowedCredentialFormats.join(', ')}'`
        )
      }
    }

    // For each of the supported algs, find the key types, then find the proof types
    const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

    let potentialSignatureAlgorithm: JwaSignatureAlgorithm | undefined

    switch (format) {
      case 'jwt_vc_json':
      case 'jwt_vc_json-ld':
        // If undefined, it means the issuer didn't include the cryptographic suites in the metadata
        // We just guess that the first one is supported
        if (issuerSupportedCryptographicSuites === undefined) {
          potentialSignatureAlgorithm = options.allowedProofOfPossessionSignatureAlgorithms[0]
        } else {
          potentialSignatureAlgorithm = options.allowedProofOfPossessionSignatureAlgorithms.find((signatureAlgorithm) =>
            issuerSupportedCryptographicSuites.includes(signatureAlgorithm)
          )
        }
        break
      case 'ldp_vc':
        // If undefined, it means the issuer didn't include the cryptographic suites in the metadata
        // We just guess that the first one is supported
        if (issuerSupportedCryptographicSuites === undefined) {
          potentialSignatureAlgorithm = options.allowedProofOfPossessionSignatureAlgorithms[0]
        } else {
          // We need to find it based on the JSON-LD proof type
          potentialSignatureAlgorithm = options.allowedProofOfPossessionSignatureAlgorithms.find(
            (signatureAlgorithm) => {
              const JwkClass = getJwkClassFromJwaSignatureAlgorithm(signatureAlgorithm)
              if (!JwkClass) return false

              const matchingSuite = signatureSuiteRegistry.getByKeyType(JwkClass.keyType)
              if (matchingSuite.length === 0) return false

              return issuerSupportedCryptographicSuites.includes(matchingSuite[0].proofType)
            }
          )
        }
        break
      default:
        throw new AriesFrameworkError(
          `Unsupported requested credential format '${format}' with id ${
            credentialSupportedMetadata?.id ?? 'Inline credential offer'
          }`
        )
    }

    const supportsAllDidMethods = issuerSupportedBindingMethods?.includes('did') ?? false
    const supportedDidMethods = issuerSupportedBindingMethods?.filter((method) => method.startsWith('did:'))

    if (!potentialSignatureAlgorithm) {
      throw new AriesFrameworkError(
        `Could not establish signature algorithm for format ${format} and id ${
          credentialSupportedMetadata?.id ?? 'Inline credential offer'
        }`
      )
    }

    return {
      signatureAlgorithm: potentialSignatureAlgorithm,
      supportedDidMethods,
      supportsAllDidMethods,
    }
  }

  /**
   * Returns the JWA Signature Algorithms that are supported by the wallet.
   *
   * This is an approximation based on the supported key types of the wallet.
   * This is not 100% correct as a supporting a key type does not mean you support
   * all the algorithms for that key type. However, this needs refactoring of the wallet
   * that is planned for the 0.5.0 release.
   */
  private getSupportedJwaSignatureAlgorithms(agentContext: AgentContext): JwaSignatureAlgorithm[] {
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

  private async handleCredentialResponse(
    agentContext: AgentContext,
    credentialResponse: OpenIDResponse<CredentialResponse>,
    options: { verifyCredentialStatus: boolean }
  ) {
    this.logger.debug('Credential request response', credentialResponse)

    if (!credentialResponse.successBody) {
      throw new AriesFrameworkError('Did not receive a successful credential response')
    }

    const format = getUniformFormat(credentialResponse.successBody.format)
    const difClaimFormat = fromOpenIdCredentialFormatProfileToDifClaimFormat(format as OpenIdCredentialFormatProfile)

    let credential: W3cVerifiableCredential
    let result: W3cVerifyCredentialResult
    if (difClaimFormat === ClaimFormat.LdpVc) {
      credential = JsonTransformer.fromJSON(credentialResponse.successBody.credential, W3cJsonLdVerifiableCredential)
      result = await this.w3cCredentialService.verifyCredential(agentContext, {
        credential,
        verifyCredentialStatus: options.verifyCredentialStatus,
      })
    } else if (difClaimFormat === ClaimFormat.JwtVc) {
      credential = W3cJwtVerifiableCredential.fromSerializedJwt(credentialResponse.successBody.credential as string)
      result = await this.w3cCredentialService.verifyCredential(agentContext, {
        credential,
        verifyCredentialStatus: options.verifyCredentialStatus,
      })
    } else {
      throw new AriesFrameworkError(`Unsupported credential format ${credentialResponse.successBody.format}`)
    }

    if (!result || !result.isValid) {
      agentContext.config.logger.error('Failed to validate credential', { result })
      throw new AriesFrameworkError(`Failed to validate credential, error = ${result.error?.message ?? 'Unknown'}`)
    }

    return credential
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

      const payload = JsonEncoder.toBuffer(jwt.payload)

      // We don't support these properties, remove them, so we can pass all other header properties to the JWS service
      if (jwt.header.x5c || jwt.header.jwk) throw new AriesFrameworkError('x5c and jwk are not supported')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { x5c: _x5c, jwk: _jwk, ...supportedHeaderOptions } = jwt.header

      const jws = await this.jwsService.createJwsCompact(agentContext, {
        key,
        payload,
        protectedHeaderOptions: supportedHeaderOptions,
      })

      return jws
    }
  }
}

function isInlineCredentialOffer(offeredCredential: OfferedCredentialsWithMetadata): offeredCredential is {
  inlineCredentialOffer: CredentialOfferFormat
  type: OfferedCredentialType.InlineCredentialOffer
} {
  return offeredCredential.type === OfferedCredentialType.InlineCredentialOffer
}
