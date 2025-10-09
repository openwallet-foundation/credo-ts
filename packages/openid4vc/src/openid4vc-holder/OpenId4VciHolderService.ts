import type {
  OpenId4VciAuthCodeFlowOptions,
  OpenId4VciProofOfPossessionRequirements,
  OpenId4VciCredentialBindingResolver,
  OpenId4VciResolvedCredentialOffer,
  OpenId4VciResolvedAuthorizationRequest,
  OpenId4VciResolvedAuthorizationRequestWithCode,
  OpenId4VciSupportedCredentialFormats,
  OpenId4VciCredentialResponse,
  OpenId4VciNotificationEvent,
  OpenId4VciAcceptCredentialOfferOptions,
  OpenId4VciTokenRequestOptions,
} from './OpenId4VciHolderServiceOptions'
import type {
  OpenId4VciCredentialConfigurationsSupported,
  OpenId4VciCredentialConfigurationSupported,
  OpenId4VciCredentialSupported,
  OpenId4VciIssuerMetadata,
} from '../shared'
import type { AgentContext, JwaSignatureAlgorithm, Key, JwkJson } from '@credo-ts/core'
import type {
  AccessTokenResponse,
  CredentialResponse,
  Jwt,
  OpenIDResponse,
  AuthorizationDetails,
  AuthorizationDetailsJwtVcJson,
  CredentialIssuerMetadataV1_0_11,
  CredentialIssuerMetadataV1_0_13,
} from '@sphereon/oid4vci-common'

import {
  SdJwtVcApi,
  getJwkFromJson,
  DidsApi,
  CredoError,
  Hasher,
  InjectionSymbols,
  JsonEncoder,
  JwsService,
  Logger,
  SignatureSuiteRegistry,
  TypedArrayEncoder,
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
} from '@credo-ts/core'
import {
  AccessTokenClient,
  CredentialRequestClientBuilder,
  ProofOfPossessionBuilder,
  OpenID4VCIClient,
  OpenID4VCIClientV1_0_11,
  OpenID4VCIClientV1_0_13,
} from '@sphereon/oid4vci-client'
import { CodeChallengeMethod, OpenId4VCIVersion, PARMode, post } from '@sphereon/oid4vci-common'

import { OpenId4VciCredentialFormatProfile } from '../shared'
import {
  getTypesFromCredentialSupported,
  getOfferedCredentials,
  credentialsSupportedV11ToV13,
} from '../shared/issuerMetadataUtils'
import { OpenId4VciCredentialSupportedWithId } from '../shared/models/index'
import { getSupportedJwaSignatureAlgorithms, isCredentialOfferV1Draft13 } from '../shared/utils'

import { openId4VciSupportedCredentialFormats, OpenId4VciNotificationMetadata } from './OpenId4VciHolderServiceOptions'

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

  public async resolveCredentialOffer(credentialOffer: string): Promise<OpenId4VciResolvedCredentialOffer> {
    const client = await OpenID4VCIClient.fromURI({
      uri: credentialOffer,
      resolveOfferUri: true,
      retrieveServerMetadata: true,
      // This is a separate call, so we don't fetch it here, however it may be easier to just construct it here?
      createAuthorizationRequestURL: false,
    })

    if (!client.credentialOffer?.credential_offer) {
      throw new CredoError(`Could not resolve credential offer from '${credentialOffer}'`)
    }

    const metadata = client.endpointMetadata
    const credentialIssuerMetadata = metadata.credentialIssuerMetadata as
      | CredentialIssuerMetadataV1_0_11
      | CredentialIssuerMetadataV1_0_13

    if (!credentialIssuerMetadata) {
      throw new CredoError(`Could not retrieve issuer metadata from '${metadata.issuer}'`)
    }

    this.logger.info('Fetched server metadata', {
      issuer: metadata.issuer,
      credentialEndpoint: metadata.credential_endpoint,
      tokenEndpoint: metadata.token_endpoint,
    })

    this.logger.debug('Full server metadata', metadata)

    const credentialOfferPayload = client.credentialOffer.credential_offer

    const offeredCredentialsData = isCredentialOfferV1Draft13(credentialOfferPayload)
      ? credentialOfferPayload.credential_configuration_ids
      : credentialOfferPayload.credentials

    const offeredCredentials = getOfferedCredentials(
      offeredCredentialsData,
      (credentialIssuerMetadata.credentials_supported as OpenId4VciCredentialSupportedWithId[] | undefined) ??
        (credentialIssuerMetadata.credential_configurations_supported as OpenId4VciCredentialConfigurationsSupported)
    )

    return {
      metadata: {
        ...metadata,
        credentialIssuerMetadata: credentialIssuerMetadata,
      },
      offeredCredentials,
      credentialOfferPayload,
      credentialOfferRequestWithBaseUrl: client.credentialOffer,
      version: client.version(),
    }
  }

  private getAuthDetailsFromOfferedCredential(
    offeredCredential: OpenId4VciCredentialSupported,
    authDetailsLocation: string | undefined
  ): AuthorizationDetails | undefined {
    const { format } = offeredCredential
    const type = 'openid_credential'

    const locations = authDetailsLocation ? [authDetailsLocation] : undefined
    if (format === OpenId4VciCredentialFormatProfile.JwtVcJson) {
      return { type, format, types: offeredCredential.types, locations } satisfies AuthorizationDetailsJwtVcJson
    } else if (
      format === OpenId4VciCredentialFormatProfile.LdpVc ||
      format === OpenId4VciCredentialFormatProfile.JwtVcJsonLd
    ) {
      const credential_definition = {
        '@context': offeredCredential['@context'],
        credentialSubject: offeredCredential.credentialSubject,
        types: offeredCredential.types,
      }

      return { type, format, locations, credential_definition }
    } else if (format === OpenId4VciCredentialFormatProfile.SdJwtVc) {
      return {
        type,
        format,
        locations,
        vct: offeredCredential.vct,
        claims: offeredCredential.claims,
      }
    } else {
      throw new CredoError(`Cannot create authorization_details. Unsupported credential format '${format}'.`)
    }
  }

  public async resolveAuthorizationRequest(
    agentContext: AgentContext,
    resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer,
    authCodeFlowOptions: OpenId4VciAuthCodeFlowOptions
  ): Promise<OpenId4VciResolvedAuthorizationRequest> {
    const { metadata, offeredCredentials } = resolvedCredentialOffer
    const codeVerifier = (
      await Promise.all([agentContext.wallet.generateNonce(), agentContext.wallet.generateNonce()])
    ).join()
    const codeVerifierSha256 = Hasher.hash(codeVerifier, 'sha-256')
    const codeChallenge = TypedArrayEncoder.toBase64URL(codeVerifierSha256)

    this.logger.debug('Converted code_verifier to code_challenge', {
      codeVerifier: codeVerifier,
      sha256: codeVerifierSha256.toString(),
      base64Url: codeChallenge,
    })

    const authDetailsLocation = metadata.credentialIssuerMetadata.authorization_server
      ? metadata.credentialIssuerMetadata.authorization_server
      : undefined

    const authDetails = offeredCredentials
      .map((credential) => this.getAuthDetailsFromOfferedCredential(credential, authDetailsLocation))
      .filter((authDetail): authDetail is AuthorizationDetails => authDetail !== undefined)

    const { clientId, redirectUri, scope } = authCodeFlowOptions

    const vciClientState = {
      state: {
        credentialOffer: resolvedCredentialOffer.credentialOfferRequestWithBaseUrl,
        clientId,
        credentialIssuer: metadata.issuer,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        endpointMetadata: metadata as unknown as any, // will be v11 / v13 based on version
        pkce: {
          codeChallenge,
          codeChallengeMethod: CodeChallengeMethod.S256,
          codeVerifier,
        },
      },
    }

    const client =
      resolvedCredentialOffer.version === OpenId4VCIVersion.VER_1_0_11
        ? await OpenID4VCIClientV1_0_11.fromState(vciClientState)
        : await OpenID4VCIClientV1_0_13.fromState(vciClientState)

    const authorizationRequestUri = await client.createAuthorizationRequestUrl({
      authorizationRequest: {
        redirectUri,
        scope: scope ? scope[0] : 'openid',
        authorizationDetails: authDetails,
        parMode: PARMode.AUTO,
      },
    })

    return {
      ...authCodeFlowOptions,
      codeVerifier,
      authorizationRequestUri,
    }
  }

  public async sendNotification(options: {
    notificationMetadata: OpenId4VciNotificationMetadata
    notificationEvent: OpenId4VciNotificationEvent
    accessToken: string
  }) {
    const { notificationMetadata, notificationEvent } = options
    const { notificationId, notificationEndpoint } = notificationMetadata

    const response = await post(
      notificationEndpoint,
      { notification_id: notificationId, event: notificationEvent },
      {
        bearerToken: options.accessToken,
        contentType: 'application/json',
      }
    )

    if (!response.successBody) {
      throw new CredoError(`Failed to send notification event '${notificationId}' to '${notificationEndpoint}'`)
    }
  }

  public async requestAccessToken(agentContext: AgentContext, options: OpenId4VciTokenRequestOptions) {
    const { resolvedCredentialOffer, txCode, resolvedAuthorizationRequest, code } = options
    const { metadata, credentialOfferRequestWithBaseUrl } = resolvedCredentialOffer

    // acquire the access token
    let accessTokenResponse: OpenIDResponse<AccessTokenResponse>

    const accessTokenClient = new AccessTokenClient()
    if (resolvedAuthorizationRequest) {
      const { codeVerifier, redirectUri } = resolvedAuthorizationRequest
      accessTokenResponse = await accessTokenClient.acquireAccessToken({
        metadata: metadata,
        credentialOffer: { credential_offer: credentialOfferRequestWithBaseUrl.credential_offer },
        pin: txCode,
        code,
        codeVerifier,
        redirectUri,
      })
    } else {
      accessTokenResponse = await accessTokenClient.acquireAccessToken({
        metadata: metadata,
        credentialOffer: { credential_offer: credentialOfferRequestWithBaseUrl.credential_offer },
        pin: txCode,
      })
    }

    if (!accessTokenResponse.successBody) {
      throw new CredoError(
        `could not acquire access token from '${metadata.issuer}'. ${accessTokenResponse.errorBody?.error}: ${accessTokenResponse.errorBody?.error_description}`
      )
    }

    this.logger.debug('Requested OpenId4VCI Access Token.')

    return accessTokenResponse.successBody
  }

  public async acceptCredentialOffer(
    agentContext: AgentContext,
    options: {
      resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer
      acceptCredentialOfferOptions: OpenId4VciAcceptCredentialOfferOptions
      resolvedAuthorizationRequestWithCode?: OpenId4VciResolvedAuthorizationRequestWithCode
      accessToken?: string
      cNonce?: string
    }
  ) {
    const { resolvedCredentialOffer, acceptCredentialOfferOptions } = options
    const { metadata, version, offeredCredentials } = resolvedCredentialOffer

    const { credentialsToRequest, credentialBindingResolver, verifyCredentialStatus } = acceptCredentialOfferOptions

    if (credentialsToRequest?.length === 0) {
      this.logger.warn(`Accepting 0 credential offers. Returning`)
      return []
    }

    this.logger.info(`Accepting the following credential offers '${credentialsToRequest}'`)

    const supportedJwaSignatureAlgorithms = getSupportedJwaSignatureAlgorithms(agentContext)

    const allowedProofOfPossessionSigAlgs = acceptCredentialOfferOptions.allowedProofOfPossessionSignatureAlgorithms
    const possibleProofOfPossessionSigAlgs = allowedProofOfPossessionSigAlgs
      ? allowedProofOfPossessionSigAlgs.filter((algorithm) => supportedJwaSignatureAlgorithms.includes(algorithm))
      : supportedJwaSignatureAlgorithms

    if (possibleProofOfPossessionSigAlgs.length === 0) {
      throw new CredoError(
        [
          `No possible proof of possession signature algorithm found.`,
          `Signature algorithms supported by the Agent '${supportedJwaSignatureAlgorithms.join(', ')}'`,
          `Allowed Signature algorithms '${allowedProofOfPossessionSigAlgs?.join(', ')}'`,
        ].join('\n')
      )
    }

    const tokenRequestOptions = {
      resolvedCredentialOffer,
      resolvedAuthorizationRequest: options.resolvedAuthorizationRequestWithCode,
      code: options.resolvedAuthorizationRequestWithCode?.code,
      txCode: acceptCredentialOfferOptions.userPin,
    } as OpenId4VciTokenRequestOptions

    const tokenResponse = options.accessToken
      ? { access_token: options.accessToken, c_nonce: options.cNonce }
      : await this.requestAccessToken(agentContext, tokenRequestOptions)

    const receivedCredentials: Array<OpenId4VciCredentialResponse> = []
    let newCNonce: string | undefined

    const credentialsSupportedToRequest =
      credentialsToRequest
        ?.map((id) => offeredCredentials.find((credential) => credential.id === id))
        .filter((c, i): c is OpenId4VciCredentialSupportedWithId => {
          if (!c) {
            const offeredCredentialIds = offeredCredentials.map((c) => c.id).join(', ')
            throw new CredoError(
              `Credential to request '${credentialsToRequest[i]}' is not present in offered credentials. Offered credentials are ${offeredCredentialIds}`
            )
          }

          return true
        }) ?? offeredCredentials

    const offeredCredentialConfigurations = credentialsSupportedV11ToV13(agentContext, credentialsSupportedToRequest)
    for (const [offeredCredentialId, offeredCredentialConfiguration] of Object.entries(
      offeredCredentialConfigurations
    )) {
      // Get all options for the credential request (such as which kid to use, the signature algorithm, etc)
      const { credentialBinding, signatureAlgorithm } = await this.getCredentialRequestOptions(agentContext, {
        possibleProofOfPossessionSignatureAlgorithms: possibleProofOfPossessionSigAlgs,
        offeredCredential: {
          id: offeredCredentialId,
          configuration: offeredCredentialConfiguration,
        },
        credentialBindingResolver,
      })

      // Create the proof of possession
      const proofOfPossessionBuilder = ProofOfPossessionBuilder.fromAccessTokenResponse({
        accessTokenResponse: tokenResponse,
        callbacks: { signCallback: this.proofOfPossessionSignCallback(agentContext) },
        version,
      })
        .withEndpointMetadata(metadata)
        .withAlg(signatureAlgorithm)

      if (credentialBinding.method === 'did') {
        proofOfPossessionBuilder.withClientId(parseDid(credentialBinding.didUrl).did).withKid(credentialBinding.didUrl)
      } else if (credentialBinding.method === 'jwk') {
        proofOfPossessionBuilder.withJWK(credentialBinding.jwk.toJson())
      }

      if (newCNonce) proofOfPossessionBuilder.withAccessTokenNonce(newCNonce)

      const proofOfPossession = await proofOfPossessionBuilder.build()
      this.logger.debug('Generated JWS', proofOfPossession)

      // Acquire the credential
      const credentialRequestBuilder = CredentialRequestClientBuilder.fromCredentialOffer({
        credentialOffer: resolvedCredentialOffer.credentialOfferRequestWithBaseUrl,
        metadata: resolvedCredentialOffer.metadata,
      })
      credentialRequestBuilder
        .withVersion(version)
        .withCredentialEndpoint(metadata.credential_endpoint)
        .withToken(tokenResponse.access_token)

      const credentialRequestClient = credentialRequestBuilder.build()
      const credentialResponse = await credentialRequestClient.acquireCredentialsUsingProof({
        proofInput: proofOfPossession,
        credentialTypes: getTypesFromCredentialSupported(offeredCredentialConfiguration),
        format: offeredCredentialConfiguration.format,
      })

      newCNonce = credentialResponse.successBody?.c_nonce

      // Create credential, but we don't store it yet (only after the user has accepted the credential)
      const credential = await this.handleCredentialResponse(agentContext, credentialResponse, {
        verifyCredentialStatus: verifyCredentialStatus ?? false,
        credentialIssuerMetadata: metadata.credentialIssuerMetadata,
        format: offeredCredentialConfiguration.format as OpenId4VciCredentialFormatProfile,
      })

      this.logger.debug('Full credential', credential)
      receivedCredentials.push(credential)
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
      credentialBindingResolver: OpenId4VciCredentialBindingResolver
      possibleProofOfPossessionSignatureAlgorithms: JwaSignatureAlgorithm[]
      offeredCredential: {
        id: string
        configuration: OpenId4VciCredentialConfigurationSupported
      }
    }
  ) {
    const { signatureAlgorithm, supportedDidMethods, supportsAllDidMethods, supportsJwk } =
      this.getProofOfPossessionRequirements(agentContext, {
        credentialToRequest: options.offeredCredential,
        possibleProofOfPossessionSignatureAlgorithms: options.possibleProofOfPossessionSignatureAlgorithms,
      })

    const JwkClass = getJwkClassFromJwaSignatureAlgorithm(signatureAlgorithm)
    if (!JwkClass) {
      throw new CredoError(`Could not determine JWK key type of the JWA signature algorithm '${signatureAlgorithm}'`)
    }

    const supportedVerificationMethods = getSupportedVerificationMethodTypesFromKeyType(JwkClass.keyType)

    const format = options.offeredCredential.configuration.format as OpenId4VciSupportedCredentialFormats

    // Now we need to determine how the credential will be bound to us
    const credentialBinding = await options.credentialBindingResolver({
      credentialFormat: format,
      signatureAlgorithm,
      supportedVerificationMethods,
      keyType: JwkClass.keyType,
      supportedCredentialId: options.offeredCredential.id,
      supportsAllDidMethods,
      supportedDidMethods,
      supportsJwk,
    })

    // Make sure the issuer of proof of possession is valid according to openid issuer metadata
    if (
      credentialBinding.method === 'did' &&
      !supportsAllDidMethods &&
      // If supportedDidMethods is undefined, it means the issuer didn't include the binding methods in the metadata
      // The user can still select a verification method, but we can't validate it
      supportedDidMethods !== undefined &&
      !supportedDidMethods.find((supportedDidMethod) => credentialBinding.didUrl.startsWith(supportedDidMethod))
    ) {
      const { method } = parseDid(credentialBinding.didUrl)
      const supportedDidMethodsString = supportedDidMethods.join(', ')
      throw new CredoError(
        `Resolved credential binding for proof of possession uses did method '${method}', but issuer only supports '${supportedDidMethodsString}'`
      )
    } else if (credentialBinding.method === 'jwk' && !supportsJwk) {
      throw new CredoError(
        `Resolved credential binding for proof of possession uses jwk, but openid issuer does not support 'jwk' cryptographic binding method`
      )
    }

    // FIXME: we don't have the verification method here
    // Make sure the verification method uses a supported verification method type
    // if (!supportedVerificationMethods.includes(verificationMethod.type)) {
    //   const supportedVerificationMethodsString = supportedVerificationMethods.join(', ')
    //   throw new CredoError(
    //     `Verification method uses verification method type '${verificationMethod.type}', but only '${supportedVerificationMethodsString}' verification methods are supported for key type '${JwkClass.keyType}'`
    //   )
    // }

    return { credentialBinding, signatureAlgorithm }
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
      credentialToRequest: {
        id: string
        configuration: OpenId4VciCredentialConfigurationSupported
      }
      possibleProofOfPossessionSignatureAlgorithms: JwaSignatureAlgorithm[]
    }
  ): OpenId4VciProofOfPossessionRequirements {
    const { credentialToRequest } = options

    if (
      !openId4VciSupportedCredentialFormats.includes(
        credentialToRequest.configuration.format as OpenId4VciSupportedCredentialFormats
      )
    ) {
      throw new CredoError(
        [
          `Requested credential with format '${credentialToRequest.configuration.format}',`,
          `for the credential with id '${credentialToRequest.id},`,
          `but the wallet only supports the following formats '${openId4VciSupportedCredentialFormats.join(', ')}'`,
        ].join('\n')
      )
    }

    // For each of the supported algs, find the key types, then find the proof types
    const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

    let signatureAlgorithm: JwaSignatureAlgorithm | undefined

    if (credentialToRequest.configuration.proof_types_supported) {
      if (!credentialToRequest.configuration.proof_types_supported.jwt) {
        throw new CredoError(
          `Unsupported proof type(s) ${Object.keys(credentialToRequest.configuration.proof_types_supported).join(
            ', '
          )}. Supported proof type(s) are: jwt`
        )
      }
    }

    // FIXME credentialToRequest.credential_signing_alg_values_supported is only required for v11 compat
    const proofSigningAlgsSupported =
      credentialToRequest.configuration.proof_types_supported?.jwt?.proof_signing_alg_values_supported ??
      credentialToRequest.configuration.credential_signing_alg_values_supported

    // If undefined, it means the issuer didn't include the cryptographic suites in the metadata
    // We just guess that the first one is supported
    if (proofSigningAlgsSupported === undefined) {
      signatureAlgorithm = options.possibleProofOfPossessionSignatureAlgorithms[0]
    } else {
      switch (credentialToRequest.configuration.format) {
        case OpenId4VciCredentialFormatProfile.JwtVcJson:
        case OpenId4VciCredentialFormatProfile.JwtVcJsonLd:
        case OpenId4VciCredentialFormatProfile.SdJwtVc:
          signatureAlgorithm = options.possibleProofOfPossessionSignatureAlgorithms.find((signatureAlgorithm) =>
            proofSigningAlgsSupported.includes(signatureAlgorithm)
          )
          break
        case OpenId4VciCredentialFormatProfile.LdpVc:
          signatureAlgorithm = options.possibleProofOfPossessionSignatureAlgorithms.find((signatureAlgorithm) => {
            const JwkClass = getJwkClassFromJwaSignatureAlgorithm(signatureAlgorithm)
            if (!JwkClass) return false

            const matchingSuite = signatureSuiteRegistry.getAllByKeyType(JwkClass.keyType)
            if (matchingSuite.length === 0) return false

            return proofSigningAlgsSupported.includes(matchingSuite[0].proofType)
          })
          break
        default:
          throw new CredoError(`Unsupported credential format.`)
      }
    }

    if (!signatureAlgorithm) {
      throw new CredoError(
        `Could not establish signature algorithm for format ${credentialToRequest.configuration.format} and id ${credentialToRequest.id}`
      )
    }

    const issuerSupportedBindingMethods = credentialToRequest.configuration.cryptographic_binding_methods_supported
    const supportsAllDidMethods = issuerSupportedBindingMethods?.includes('did') ?? false
    const supportedDidMethods = issuerSupportedBindingMethods?.filter((method) => method.startsWith('did:'))
    const supportsJwk = issuerSupportedBindingMethods?.includes('jwk') ?? false

    return {
      signatureAlgorithm,
      supportedDidMethods,
      supportsAllDidMethods,
      supportsJwk,
    }
  }

  private async handleCredentialResponse(
    agentContext: AgentContext,
    credentialResponse: OpenIDResponse<CredentialResponse>,
    options: {
      verifyCredentialStatus: boolean
      credentialIssuerMetadata: OpenId4VciIssuerMetadata
      format: OpenId4VciCredentialFormatProfile
    }
  ): Promise<OpenId4VciCredentialResponse> {
    const { verifyCredentialStatus, credentialIssuerMetadata } = options

    this.logger.debug('Credential request response', credentialResponse)

    if (!credentialResponse.successBody || !credentialResponse.successBody.credential) {
      throw new CredoError(
        `Did not receive a successful credential response. ${credentialResponse.errorBody?.error}: ${credentialResponse.errorBody?.error_description}`
      )
    }

    const notificationMetadata =
      credentialIssuerMetadata.notification_endpoint && credentialResponse.successBody.notification_id
        ? {
            notificationEndpoint: credentialIssuerMetadata.notification_endpoint,
            notificationId: credentialResponse.successBody.notification_id,
          }
        : undefined

    const format = options.format
    if (format === OpenId4VciCredentialFormatProfile.SdJwtVc) {
      if (typeof credentialResponse.successBody.credential !== 'string')
        throw new CredoError(
          `Received a credential of format ${
            OpenId4VciCredentialFormatProfile.SdJwtVc
          }, but the credential is not a string. ${JSON.stringify(credentialResponse.successBody.credential)}`
        )

      const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)
      const verificationResult = await sdJwtVcApi.verify({
        compactSdJwtVc: credentialResponse.successBody.credential,
      })

      if (!verificationResult.isValid) {
        agentContext.config.logger.error('Failed to validate credential', { verificationResult })
        throw new CredoError(`Failed to validate sd-jwt-vc credential. Results = ${JSON.stringify(verificationResult)}`)
      }

      return { credential: verificationResult.sdJwtVc, notificationMetadata }
    } else if (
      format === OpenId4VciCredentialFormatProfile.JwtVcJson ||
      format === OpenId4VciCredentialFormatProfile.JwtVcJsonLd
    ) {
      const credential = W3cJwtVerifiableCredential.fromSerializedJwt(
        credentialResponse.successBody.credential as string
      )
      const result = await this.w3cCredentialService.verifyCredential(agentContext, {
        credential,
        verifyCredentialStatus,
      })
      if (!result.isValid) {
        agentContext.config.logger.error('Failed to validate credential', { result })
        throw new CredoError(`Failed to validate credential, error = ${result.error?.message ?? 'Unknown'}`)
      }

      return { credential, notificationMetadata }
    } else if (format === OpenId4VciCredentialFormatProfile.LdpVc) {
      const credential = W3cJsonLdVerifiableCredential.fromJson(
        credentialResponse.successBody.credential as Record<string, unknown>
      )
      const result = await this.w3cCredentialService.verifyCredential(agentContext, {
        credential,
        verifyCredentialStatus,
      })
      if (!result.isValid) {
        agentContext.config.logger.error('Failed to validate credential', { result })
        throw new CredoError(`Failed to validate credential, error = ${result.error?.message ?? 'Unknown'}`)
      }

      return { credential, notificationMetadata }
    }

    throw new CredoError(`Unsupported credential format ${credentialResponse.successBody.format}`)
  }

  private proofOfPossessionSignCallback(agentContext: AgentContext) {
    return async (jwt: Jwt, kid?: string) => {
      if (!jwt.header) throw new CredoError('No header present on JWT')
      if (!jwt.payload) throw new CredoError('No payload present on JWT')
      if (kid && jwt.header.jwk) {
        throw new CredoError('Both KID and JWK are present in the callback. Only one can be present')
      }

      let key: Key

      if (kid) {
        if (!kid.startsWith('did:')) {
          throw new CredoError(`kid '${kid}' is not a DID. Only dids are supported for kid`)
        } else if (!kid.includes('#')) {
          throw new CredoError(
            `kid '${kid}' does not contain a fragment. kid MUST point to a specific key in the did document.`
          )
        }

        const didsApi = agentContext.dependencyManager.resolve(DidsApi)
        const didDocument = await didsApi.resolveDidDocument(kid)
        const verificationMethod = didDocument.dereferenceKey(kid, ['authentication'])

        key = getKeyFromVerificationMethod(verificationMethod)
      } else if (jwt.header.jwk) {
        key = getJwkFromJson(jwt.header.jwk as JwkJson).key
      } else {
        throw new CredoError('No KID or JWK is present in the callback')
      }

      const jwk = getJwkFromKey(key)
      if (!jwk.supportsSignatureAlgorithm(jwt.header.alg)) {
        throw new CredoError(`key type '${jwk.keyType}', does not support the JWS signature alg '${jwt.header.alg}'`)
      }

      // We don't support these properties, remove them, so we can pass all other header properties to the JWS service
      if (jwt.header.x5c) throw new CredoError('x5c is not supported')

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { x5c: _x5c, ...supportedHeaderOptions } = jwt.header

      const jws = await this.jwsService.createJwsCompact(agentContext, {
        key,
        payload: JsonEncoder.toBuffer(jwt.payload),
        protectedHeaderOptions: {
          ...supportedHeaderOptions,
          // only pass jwk if it was present in the header
          jwk: jwt.header.jwk ? jwk : undefined,
        },
      })

      return jws
    }
  }
}
