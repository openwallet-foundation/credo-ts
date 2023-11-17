import type { OfferedCredentialWithMetadata } from './utils/IssuerMetadataUtils'
import type {
  AuthCodeFlowOptions,
  CredentialToRequest,
  AcceptCredentialOfferOptions,
  ProofOfPossessionRequirements,
  ProofOfPossessionVerificationMethodResolver,
  SupportedCredentialFormats,
  ResolvedCredentialOffer,
  ResolvedAuthorizationRequest,
  ResolvedAuthorizationRequestWithCode,
} from '../OpenId4VcHolderServiceOptions'
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
  ProofOfPossessionCallbacks,
  PushedAuthorizationResponse,
  UniformCredentialOfferPayload,
} from '@sphereon/oid4vci-common'
import type { CredentialFormat } from '@sphereon/ssi-types'

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
  getJwkFromKey,
  getKeyFromVerificationMethod,
  getSupportedVerificationMethodTypesFromKeyType,
  inject,
  injectable,
  parseDid,
  equalsIgnoreOrder,
} from '@aries-framework/core'
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

import { supportedCredentialFormats } from '../OpenId4VcHolderServiceOptions'
import { getSupportedJwaSignatureAlgorithms } from '../shared'

import { OpenIdCredentialFormatProfile, fromOpenIdCredentialFormatProfileToDifClaimFormat } from './utils'
import { getFormatForVersion, getUniformFormat } from './utils/Formats'
import {
  getMetadataFromCredentialOffer,
  getOfferedCredentialsWithMetadata,
  handleAuthorizationDetails,
  OfferedCredentialType,
} from './utils/IssuerMetadataUtils'

export interface AuthDetails {
  type: 'openid_credential' | string
  locations?: string | string[]
  format: CredentialFormat | CredentialFormat[]

  [s: string]: unknown
}

function getV8CredentialType(
  offeredCredentialWithMetadata: OfferedCredentialWithMetadata,
  format: string,
  version: OpenId4VCIVersion
) {
  if (offeredCredentialWithMetadata.offerType === OfferedCredentialType.InlineCredentialOffer) {
    throw new AriesFrameworkError(`Inline credential offers not supported for version < 11`)
  }

  if (!offeredCredentialWithMetadata.credentialSupported.id) {
    throw new AriesFrameworkError( // This should not happen
      `No id provided for a credential supported entry in combination with the OpenId4VCI v8 draft`
    )
  }

  const originalFormat = getFormatForVersion(format, version)
  const credentialType = offeredCredentialWithMetadata.credentialSupported.id.split(`-${originalFormat}`)[0]
  return credentialType
}

async function createAuthorizationRequestUri(options: {
  credentialOffer: CredentialOfferPayloadV1_0_11
  metadata: EndpointMetadataResult
  clientId: string
  codeChallenge: string
  codeChallengeMethod: CodeChallengeMethod
  authDetails?: AuthDetails | AuthDetails[]
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
    const { metadata, issuerMetadata } = await getMetadataFromCredentialOffer(credentialOfferPayload)

    this.logger.info('Fetched server metadata', {
      issuer: metadata.issuer,
      credentialEndpoint: metadata.credential_endpoint,
      tokenEndpoint: metadata.token_endpoint,
    })

    this.logger.debug('Full server metadata', metadata)

    const offeredCredentialsWithMetadata = getOfferedCredentialsWithMetadata(
      credentialOfferPayload,
      issuerMetadata,
      version
    )

    const credentialsToRequest: CredentialToRequest[] = offeredCredentialsWithMetadata.map((offeredCredential) => {
      const { format, types, offerType } = offeredCredential
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

  private getAuthDetailsFromOfferedCredential(
    credentialWithMetadata: OfferedCredentialWithMetadata,
    authDetailsLocation: string | undefined,
    version: OpenId4VCIVersion
  ): AuthDetails | undefined {
    const { format, types } = credentialWithMetadata
    const type = 'openid_credential'

    if (version < OpenId4VCIVersion.VER_1_0_11) {
      const credential_type = getV8CredentialType(credentialWithMetadata, format, version)
      return { type, credential_type, format }
    }

    const locations = authDetailsLocation ? [authDetailsLocation] : undefined
    if (format === OpenIdCredentialFormatProfile.JwtVcJson || format === OpenIdCredentialFormatProfile.JwtVcJsonLd) {
      return {
        type,
        format,
        types,
        locations,
      }
    } else if (format === OpenIdCredentialFormatProfile.LdpVc) {
      let context: string | undefined = undefined

      if (credentialWithMetadata.offerType === OfferedCredentialType.InlineCredentialOffer) {
        // Inline Credential Offers come with no context so we cannot create the authorization_details
        // This type of credentials can only be requested via scopes
        return undefined
      } else {
        if ('@context' in credentialWithMetadata.credentialSupported) {
          context = credentialWithMetadata.credentialSupported['@context'] as unknown as string
        } else {
          throw new AriesFrameworkError('Could not find @context in credentialSupported.')
        }
      }

      return {
        type,
        format,
        types,
        locations,
        '@context': context,
      }
    } else {
      throw new AriesFrameworkError(`Cannot create authorization_details. Unsupported credential format ${format}.`)
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

    const offeredCredentialsWithMetadata = getOfferedCredentialsWithMetadata(
      credentialOfferPayload,
      issuerMetadata,
      version
    )

    let authDetailsLocation: string | undefined
    if (issuerMetadata.authorization_server) {
      authDetailsLocation = metadata.issuer
    }

    const authDetails = offeredCredentialsWithMetadata
      .map((credential) => this.getAuthDetailsFromOfferedCredential(credential, authDetailsLocation, version))
      .filter((authDetail): authDetail is AuthDetails => authDetail !== undefined)

    this.logger.debug('Converted code_verifier to code_challenge', {
      codeVerifier: codeVerifier,
      sha256: codeVerifierSha256.toString(),
      base64Url: codeChallenge,
    })

    const { clientId, redirectUri, scope } = authCodeFlowOptions
    const authorizationRequestUri = await createAuthorizationRequestUri({
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

    const possibleProofOfPossessionSigAlgs = acceptCredentialOfferOptions.allowedProofOfPossessionSignatureAlgorithms
    const allowedProofOfPossessionSignatureAlgorithms = possibleProofOfPossessionSigAlgs
      ? possibleProofOfPossessionSigAlgs.filter((algorithm) => supportedJwaSignatureAlgorithms.includes(algorithm))
      : supportedJwaSignatureAlgorithms

    if (allowedProofOfPossessionSignatureAlgorithms.length === 0) {
      throw new AriesFrameworkError(
        [
          `No supported proof of possession signature algorithm found.`,
          `Signature algorithms supported by the Agent '${supportedJwaSignatureAlgorithms.join(', ')}'`,
          `Possible Signature algorithms '${possibleProofOfPossessionSigAlgs?.join(', ')}'`,
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

    const offeredCredentialsWithMetadata = getOfferedCredentialsWithMetadata(
      credentialOfferPayload,
      issuerMetadata,
      version
    )

    const credentialsToRequestWithMetadata = credentialsToRequest?.map((ctr) => {
      const credentialToRequest = offeredCredentialsWithMetadata.find((offeredCredentialWithMetadata) => {
        const { format, types } = offeredCredentialWithMetadata
        // only requests credentials with the exact same set of types and format
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

    const receivedCredentials: W3cCredentialRecord[] = []

    // Loop through all the credentialTypes in the credential offer
    for (const credentialWithMetadata of credentialsToRequestWithMetadata ?? offeredCredentialsWithMetadata) {
      // Get all options for the credential request (such as which kid to use, the signature algorithm, etc)
      const { verificationMethod, signatureAlgorithm } = await this.getCredentialRequestOptions(agentContext, {
        allowedCredentialFormats: supportedCredentialFormats,
        allowedProofOfPossessionSignatureAlgorithms,
        offeredCredentialWithMetadata: credentialWithMetadata,
        proofOfPossessionVerificationMethodResolver,
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

      const isInlineOffer = credentialWithMetadata.offerType === OfferedCredentialType.InlineCredentialOffer
      const format = credentialWithMetadata.format
      const originalFormat = getFormatForVersion(format, version)

      let credentialTypes: string | string[]
      if (version < OpenId4VCIVersion.VER_1_0_11) {
        if (isInlineOffer) throw new AriesFrameworkError(`Inline credential offers not supported for version < 11`)
        credentialTypes = getV8CredentialType(credentialWithMetadata, format, version)
      } else {
        if (isInlineOffer) credentialTypes = credentialWithMetadata.inlineCredentialOffer.types
        else credentialTypes = credentialWithMetadata.credentialSupported.types
      }

      const credentialRequestClient = credentialRequestBuilder.build()
      const credentialResponse = await credentialRequestClient.acquireCredentialsUsingProof({
        proofInput,
        credentialTypes,
        format: originalFormat,
      })

      const credential = await this.handleCredentialResponse(agentContext, credentialResponse, {
        verifyCredentialStatus: verifyCredentialStatus ?? false,
      })

      // Create credential record, but we don't store it yet (only after the user has accepted the credential)
      const credentialRecord = new W3cCredentialRecord({ credential, tags: { expandedTypes: [] } })
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
      offeredCredentialWithMetadata: OfferedCredentialWithMetadata
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
      offeredCredentialWithMetadata: OfferedCredentialWithMetadata
      allowedCredentialFormats: SupportedCredentialFormats[]
      allowedProofOfPossessionSignatureAlgorithms: JwaSignatureAlgorithm[]
    }
  ): ProofOfPossessionRequirements {
    const { offeredCredentialWithMetadata, allowedCredentialFormats } = options
    const isInlineOffer = offeredCredentialWithMetadata.offerType === OfferedCredentialType.InlineCredentialOffer
    const format = offeredCredentialWithMetadata.format

    const credentialSupportedMetadata = isInlineOffer ? undefined : offeredCredentialWithMetadata.credentialSupported

    const issuerSupportedCryptographicSuites = credentialSupportedMetadata?.cryptographic_suites_supported
    const issuerSupportedBindingMethods = credentialSupportedMetadata?.cryptographic_binding_methods_supported

    if (!isInlineOffer) {
      const credentialMetadata = offeredCredentialWithMetadata.credentialSupported
      if (!allowedCredentialFormats.includes(format as SupportedCredentialFormats)) {
        throw new AriesFrameworkError(
          [
            `The issuer only supports format '${format}'`,
            `for the credential type '${credentialMetadata.types.join(', ')}`,
            `but the wallet only allows formats '${options.allowedCredentialFormats.join(', ')}'`,
          ].join(' ')
        )
      }
    }

    // For each of the supported algs, find the key types, then find the proof types
    const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

    let signatureAlgorithm: JwaSignatureAlgorithm | undefined

    // If undefined, it means the issuer didn't include the cryptographic suites in the metadata
    // We just guess that the first one is supported
    if (issuerSupportedCryptographicSuites === undefined) {
      signatureAlgorithm = options.allowedProofOfPossessionSignatureAlgorithms[0]
    } else {
      switch (format) {
        case 'jwt_vc_json':
        case 'jwt_vc_json-ld':
          signatureAlgorithm = options.allowedProofOfPossessionSignatureAlgorithms.find((signatureAlgorithm) =>
            issuerSupportedCryptographicSuites.includes(signatureAlgorithm)
          )
          break
        case 'ldp_vc':
          // We need to find it based on the JSON-LD proof type
          signatureAlgorithm = options.allowedProofOfPossessionSignatureAlgorithms.find((signatureAlgorithm) => {
            const JwkClass = getJwkClassFromJwaSignatureAlgorithm(signatureAlgorithm)
            if (!JwkClass) return false

            const matchingSuite = signatureSuiteRegistry.getByKeyType(JwkClass.keyType)
            if (matchingSuite.length === 0) return false

            return issuerSupportedCryptographicSuites.includes(matchingSuite[0].proofType)
          })
          break
        default:
          throw new AriesFrameworkError(`Unsupported credential format. Requested format '${format}'`)
      }
    }

    if (!signatureAlgorithm) {
      throw new AriesFrameworkError(
        `Could not establish signature algorithm for format ${format} and id ${
          credentialSupportedMetadata?.id ?? 'Inline credential offer'
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
    options: { verifyCredentialStatus: boolean }
  ) {
    const { verifyCredentialStatus } = options
    this.logger.debug('Credential request response', credentialResponse)

    if (!credentialResponse.successBody) {
      throw new AriesFrameworkError('Did not receive a successful credential response')
    }

    const format = getUniformFormat(credentialResponse.successBody.format) as OpenIdCredentialFormatProfile
    const difClaimFormat = fromOpenIdCredentialFormatProfileToDifClaimFormat(format)

    let credential: W3cVerifiableCredential
    let result: W3cVerifyCredentialResult

    if (difClaimFormat === ClaimFormat.LdpVc) {
      // validate json-ld credentials
      credential = JsonTransformer.fromJSON(credentialResponse.successBody.credential, W3cJsonLdVerifiableCredential)
      result = await this.w3cCredentialService.verifyCredential(agentContext, { credential, verifyCredentialStatus })
    } else if (difClaimFormat === ClaimFormat.JwtVc) {
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
