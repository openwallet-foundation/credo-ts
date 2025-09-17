import {
  AgentContext,
  ClaimFormat,
  DcqlEncodedPresentations,
  DcqlQuery,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
  HashName,
  Kms,
  MdocSessionTranscriptOptions,
  MdocSupportedSignatureAlgorithm,
  Query,
  QueryOptions,
  VerifiablePresentation,
} from '@credo-ts/core'
import {
  CredoError,
  DcqlService,
  DifPresentationExchangeService,
  EventEmitter,
  InjectionSymbols,
  JsonEncoder,
  JsonTransformer,
  Jwt,
  Logger,
  MdocDeviceResponse,
  SdJwtVcApi,
  SignatureSuiteRegistry,
  TypedArrayEncoder,
  W3cCredentialService,
  W3cJsonLdVerifiablePresentation,
  W3cJwtVerifiablePresentation,
  X509Certificate,
  X509ModuleConfig,
  X509Service,
  extractPresentationsWithDescriptorsFromSubmission,
  extractX509CertificatesFromJwt,
  getDomainFromUrl,
  inject,
  injectable,
  isMdocSupportedSignatureAlgorithm,
  joinUriParts,
  utils,
} from '@credo-ts/core'
import { NonEmptyArray, mapNonEmptyArray } from '@credo-ts/core'
import { Jwk, Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'
import {
  ClientIdPrefix,
  ClientMetadata,
  JarmMode,
  Openid4vpVerifier,
  ParsedOpenid4vpAuthorizationResponse,
  TransactionDataHashesCredentials,
  getOpenid4vpClientId,
  isJarmResponseMode,
  isOpenid4vpAuthorizationRequestDcApi,
  zOpenid4vpAuthorizationResponse,
} from '@openid4vc/openid4vp'
import { getOid4vcCallbacks } from '../shared/callbacks'
import { OpenId4VpAuthorizationRequestPayload } from '../shared/index'
import { storeActorIdForContextCorrelationId } from '../shared/router'
import { getSdJwtVcTransactionDataHashes } from '../shared/transactionData'
import {
  addSecondsToDate,
  dcqlFormatToPresentationClaimFormat,
  getSupportedJwaSignatureAlgorithms,
  requestSignerToJwtIssuer,
} from '../shared/utils'
import { OpenId4VcVerificationSessionState } from './OpenId4VcVerificationSessionState'
import { OpenId4VcVerificationSessionStateChangedEvent, OpenId4VcVerifierEvents } from './OpenId4VcVerifierEvents'
import { OpenId4VcVerifierModuleConfig } from './OpenId4VcVerifierModuleConfig'
import type {
  OpenId4VpCreateAuthorizationRequestOptions,
  OpenId4VpCreateAuthorizationRequestReturn,
  OpenId4VpCreateVerifierOptions,
  OpenId4VpVerifiedAuthorizationResponse,
  OpenId4VpVerifiedAuthorizationResponseDcql,
  OpenId4VpVerifiedAuthorizationResponsePresentationExchange,
  OpenId4VpVerifiedAuthorizationResponseTransactionData,
  OpenId4VpVerifyAuthorizationResponseOptions,
  OpenId4VpVersion,
  ResponseMode,
} from './OpenId4VpVerifierServiceOptions'
import {
  OpenId4VcVerificationSessionRecord,
  OpenId4VcVerificationSessionRepository,
  OpenId4VcVerifierRecord,
  OpenId4VcVerifierRepository,
} from './repository'

/**
 * @internal
 */
@injectable()
export class OpenId4VpVerifierService {
  public constructor(
    @inject(InjectionSymbols.Logger) private logger: Logger,
    private w3cCredentialService: W3cCredentialService,
    private openId4VcVerifierRepository: OpenId4VcVerifierRepository,
    private config: OpenId4VcVerifierModuleConfig,
    private openId4VcVerificationSessionRepository: OpenId4VcVerificationSessionRepository
  ) {}

  private getOpenid4vpVerifier(agentContext: AgentContext) {
    const callbacks = getOid4vcCallbacks(agentContext)
    const openid4vpClient = new Openid4vpVerifier({ callbacks })

    return openid4vpClient
  }

  public async createAuthorizationRequest(
    agentContext: AgentContext,
    options: OpenId4VpCreateAuthorizationRequestOptions & { verifier: OpenId4VcVerifierRecord }
  ): Promise<OpenId4VpCreateAuthorizationRequestReturn> {
    const kms = agentContext.resolve(Kms.KeyManagementApi)
    const nonce = TypedArrayEncoder.toBase64URL(kms.randomBytes({ length: 32 }))
    const state = TypedArrayEncoder.toBase64URL(kms.randomBytes({ length: 32 }))

    const responseMode = options.responseMode ?? 'direct_post.jwt'
    const isDcApiRequest = responseMode === 'dc_api' || responseMode === 'dc_api.jwt'

    const version = options.version ?? 'v1'
    if (version === 'v1.draft21' && isDcApiRequest) {
      throw new CredoError(
        `OpenID4VP version '${version}' cannot be used with responseMode '${options.responseMode}'. Use version 'v1' or 'v1.draft24' instead.`
      )
    }
    if (version === 'v1.draft21' && options.transactionData) {
      throw new CredoError(
        `OpenID4VP version '${version}' cannot be used with transactionData. Use version 'v1' or 'v1.draft24' instead.`
      )
    }
    if (version === 'v1.draft21' && options.dcql) {
      throw new CredoError(
        `OpenID4VP version '${version}' cannot be used with dcql. Use version 'v1' or 'v1.draft24' instead.`
      )
    }
    if (version !== 'v1' && options.verifierInfo) {
      throw new CredoError(`OpenID4VP version '${version}' cannot be used with verifierInfo. Use version 'v1' instead.`)
    }
    if (version === 'v1' && options.presentationExchange) {
      throw new CredoError(
        `OpenID4VP version '${version}' cannot be used with presentationExchange. Use dcql instead (recommended), or use older versions 'v1.draft24' and 'v1.draft21'.`
      )
    }

    // For now we only support presentations with holder binding.
    if (options.dcql?.query.credentials.some((c) => c.require_cryptographic_holder_binding === false)) {
      throw new CredoError(
        `Setting 'require_cryptographic_holder_binding' to false in DCQL Query is not supported by Credo at the moment. Only presentations with cryptographic holder binding are supported.`
      )
    }

    if (isDcApiRequest && options.authorizationResponseRedirectUri) {
      throw new CredoError(
        "'authorizationResponseRedirectUri' cannot be be used with response mode 'dc_api' and 'dc_api.jwt'."
      )
    }

    // Check to prevent direct_post from being used with mDOC
    const hasMdocRequest =
      options.presentationExchange?.definition.input_descriptors.some((i) => i.format?.mso_mdoc) ||
      options.dcql?.query.credentials.some((c) => c.format === 'mso_mdoc')
    // Up to draft 24 we use the 18013-7 mdoc session transcript which needs values from APU/APV
    if ((version === 'v1.draft21' || version === 'v1.draft24') && responseMode === 'direct_post' && hasMdocRequest) {
      throw new CredoError(
        "Unable to create authorization request with response mode 'direct_post' containing mDOC credentials. ISO 18013-7 requires the usage of response mode 'direct_post.jwt', and needs parameters from the encrypted response header to verify the mDOC sigature. Either use version 'v1', or update the response mode to 'direct_post.jwt'"
      )
    }

    if (options.verifierInfo) {
      const queryIds =
        options?.dcql?.query.credentials.map(({ id }) => id) ??
        options?.presentationExchange?.definition.input_descriptors.map(({ id }) => id) ??
        []

      const hasValidCredentialIds = options.verifierInfo.every(
        (vi) => !vi.credential_ids || vi.credential_ids.every((credentialId) => queryIds.includes(credentialId))
      )

      if (!hasValidCredentialIds) {
        throw new CredoError(
          'Verifier info (attestations) were provided, but the verifier info used credential ids that are not present in the query'
        )
      }
    }

    const authorizationRequestId = utils.uuid()
    // We include the `session=` in the url so we can still easily
    // find the session an encrypted response
    const authorizationResponseUrl = `${joinUriParts(this.config.baseUrl, [options.verifier.verifierId, this.config.authorizationEndpoint])}?session=${authorizationRequestId}`

    const jwtIssuer =
      options.requestSigner.method === 'none'
        ? undefined
        : options.requestSigner.method === 'x5c'
          ? await requestSignerToJwtIssuer(agentContext, {
              ...options.requestSigner,
              issuer: authorizationResponseUrl,
            })
          : await requestSignerToJwtIssuer(agentContext, options.requestSigner)

    let clientIdPrefix: ClientIdPrefix
    let clientId: string | undefined

    if (!jwtIssuer) {
      if (isDcApiRequest) {
        clientIdPrefix = version === 'v1' ? 'origin' : 'web-origin'
        clientId = undefined
      } else {
        clientIdPrefix = 'redirect_uri'
        clientId = authorizationResponseUrl
      }
    } else if (jwtIssuer?.method === 'x5c') {
      const leafCertificate = X509Service.getLeafCertificate(agentContext, { certificateChain: jwtIssuer.x5c })

      if (leafCertificate.sanDnsNames.includes(getDomainFromUrl(jwtIssuer.issuer))) {
        clientIdPrefix = 'x509_san_dns'
        clientId = getDomainFromUrl(jwtIssuer.issuer)
      } else {
        throw new CredoError(
          `With jwtIssuer method 'x5c' the jwtIssuer's 'issuer' field must match a sanDnsName (FQDN) in the leaf x509 chain's leaf certificate.`
        )
      }
    } else if (jwtIssuer?.method === 'did') {
      clientId = jwtIssuer.didUrl.split('#')[0]
      clientIdPrefix = version === 'v1' ? 'decentralized_identifier' : 'did'
    } else {
      throw new CredoError(
        `Unsupported jwt issuer method '${options.requestSigner.method}'. Only 'did' and 'x5c' are supported.`
      )
    }

    // We always use shortened URIs currently
    const hostedAuthorizationRequestUri =
      !isDcApiRequest && jwtIssuer
        ? joinUriParts(this.config.baseUrl, [
            options.verifier.verifierId,
            this.config.authorizationRequestEndpoint,
            authorizationRequestId,
          ])
        : // No hosted request needed when using DC API or using unsigned request
          undefined

    const client_id =
      // For did/https and draft 21 the client id has no special prefix
      clientIdPrefix === 'did' || (clientIdPrefix as string) === 'https' || version === 'v1.draft21'
        ? clientId
        : `${clientIdPrefix}:${clientId}`

    // for did the client_id is same in draft 21 and 24 so we could support both at the same time
    const legacyClientIdScheme =
      version === 'v1.draft21' &&
      clientIdPrefix !== 'web-origin' &&
      clientIdPrefix !== 'origin' &&
      clientIdPrefix !== 'decentralized_identifier'
        ? clientIdPrefix
        : undefined

    const client_metadata = await this.getClientMetadata(agentContext, {
      responseMode,
      verifier: options.verifier,
      authorizationResponseUrl,
      version,

      // TODO: we don't validate the DCQL query when creating a request i think?
      dcqlQuery: options.dcql?.query,
    })

    const requestParamsBase = {
      nonce,
      presentation_definition: options.presentationExchange?.definition,
      dcql_query: options.dcql?.query,
      transaction_data: options.transactionData?.map((entry) => JsonEncoder.toBase64URL(entry)),
      response_mode: responseMode,
      response_type: 'vp_token',
      client_metadata,
      verifier_info: options.verifierInfo,
    } as const

    const openid4vpVerifier = this.getOpenid4vpVerifier(agentContext)
    const authorizationRequest = await openid4vpVerifier.createOpenId4vpAuthorizationRequest({
      jar: jwtIssuer
        ? {
            jwtSigner: jwtIssuer,
            requestUri: hostedAuthorizationRequestUri,
            expiresInSeconds: this.config.authorizationRequestExpiresInSeconds,
          }
        : undefined,
      authorizationRequestPayload:
        requestParamsBase.response_mode === 'dc_api.jwt' || requestParamsBase.response_mode === 'dc_api'
          ? {
              ...requestParamsBase,
              // No client_id for unsigned DC API requests
              client_id: jwtIssuer ? client_id : undefined,
              response_mode: requestParamsBase.response_mode,
              expected_origins: options.expectedOrigins,
            }
          : {
              ...requestParamsBase,
              response_mode: requestParamsBase.response_mode,
              client_id: client_id as string,
              state,
              response_uri: authorizationResponseUrl,
              client_id_scheme: legacyClientIdScheme,
            },
    })

    const verificationSession = new OpenId4VcVerificationSessionRecord({
      authorizationResponseRedirectUri: options.authorizationResponseRedirectUri,

      // Only store payload for unsiged requests
      authorizationRequestPayload: authorizationRequest.jar
        ? undefined
        : authorizationRequest.authorizationRequestPayload,
      authorizationRequestJwt: authorizationRequest.jar?.authorizationRequestJwt,
      authorizationRequestUri: hostedAuthorizationRequestUri,
      authorizationRequestId,
      state: OpenId4VcVerificationSessionState.RequestCreated,
      verifierId: options.verifier.verifierId,
      expiresAt: addSecondsToDate(new Date(), this.config.authorizationRequestExpiresInSeconds),
      openId4VpVersion: version,
    })
    await this.openId4VcVerificationSessionRepository.save(agentContext, verificationSession)
    this.emitStateChangedEvent(agentContext, verificationSession, null)

    return {
      authorizationRequest: authorizationRequest.authorizationRequest,
      verificationSession,
      authorizationRequestObject: authorizationRequest.authorizationRequestObject,
    }
  }

  private async getDcqlVerifiedResponse(
    agentContext: AgentContext,
    _dcqlQuery: unknown,
    presentations: DcqlEncodedPresentations
  ) {
    const dcqlService = agentContext.dependencyManager.resolve(DcqlService)
    const dcqlQuery = dcqlService.validateDcqlQuery(_dcqlQuery)

    const dcqlPresentationEntries = Object.entries(presentations)
    const dcqlPresentation = Object.fromEntries(
      dcqlPresentationEntries.map(([credentialId, presentations]) => {
        const queryCredential = dcqlQuery.credentials.find((c) => c.id === credentialId)
        if (!queryCredential) {
          throw new CredoError(
            `vp_token contains presentation for credential query id '${credentialId}', but this credential is not present in the dcql query.`
          )
        }

        return [
          credentialId,
          mapNonEmptyArray(presentations, (presentation) =>
            this.decodePresentation(agentContext, {
              presentation,
              format: dcqlFormatToPresentationClaimFormat[queryCredential.format],
            })
          ),
        ]
      })
    )

    const dcqlPresentationResult = await dcqlService.assertValidDcqlPresentation(
      agentContext,
      dcqlPresentation,
      dcqlQuery
    )

    return {
      query: dcqlQuery,
      presentations: dcqlPresentation,
      presentationResult: dcqlPresentationResult,
    } satisfies OpenId4VpVerifiedAuthorizationResponseDcql
  }

  private async parseAuthorizationResponse(
    agentContext: AgentContext,
    options: {
      authorizationResponse: Record<string, unknown>
      origin?: string
      verificationSession: OpenId4VcVerificationSessionRecord
    }
  ): Promise<ParsedOpenid4vpAuthorizationResponse & { verificationSession: OpenId4VcVerificationSessionRecord }> {
    const openid4vpVerifier = this.getOpenid4vpVerifier(agentContext)

    const { authorizationResponse, verificationSession, origin } = options
    let parsedAuthorizationResponse: ParsedOpenid4vpAuthorizationResponse | undefined = undefined

    try {
      parsedAuthorizationResponse = await openid4vpVerifier.parseOpenid4vpAuthorizationResponse({
        authorizationResponse,
        origin,
        authorizationRequestPayload: verificationSession.requestPayload,
        callbacks: getOid4vcCallbacks(agentContext),
      })

      if (parsedAuthorizationResponse.jarm && parsedAuthorizationResponse.jarm.type !== JarmMode.Encrypted) {
        throw new Oauth2ServerErrorResponseError({
          error: Oauth2ErrorCodes.InvalidRequest,
          error_description: `Only encrypted JARM responses are supported, received '${parsedAuthorizationResponse.jarm.type}'.`,
        })
      }

      return {
        ...parsedAuthorizationResponse,
        verificationSession,
      }
    } catch (error) {
      if (
        verificationSession?.state === OpenId4VcVerificationSessionState.RequestUriRetrieved ||
        verificationSession?.state === OpenId4VcVerificationSessionState.RequestCreated
      ) {
        const parsed = zOpenid4vpAuthorizationResponse.safeParse(
          parsedAuthorizationResponse?.authorizationResponsePayload
        )

        verificationSession.authorizationResponsePayload = parsed.success ? parsed.data : undefined
        verificationSession.errorMessage = error.message
        await this.updateState(agentContext, verificationSession, OpenId4VcVerificationSessionState.Error)
      }

      throw error
    }
  }

  public async verifyAuthorizationResponse(
    agentContext: AgentContext,
    options: OpenId4VpVerifyAuthorizationResponseOptions & {
      /**
       * The verification session associated with the response
       */
      verificationSession: OpenId4VcVerificationSessionRecord
    }
  ): Promise<OpenId4VpVerifiedAuthorizationResponse> {
    const { verificationSession, authorizationResponse, origin } = options
    const authorizationRequest = verificationSession.requestPayload
    const openid4vpVersion =
      verificationSession.openId4VpVersion ??
      (authorizationRequest.client_id_scheme !== undefined ? 'v1.draft21' : 'v1.draft24')

    if (
      verificationSession.state !== OpenId4VcVerificationSessionState.RequestUriRetrieved &&
      verificationSession.state !== OpenId4VcVerificationSessionState.RequestCreated
    ) {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidRequest,
        error_description: 'Invalid session',
      })
    }

    if (verificationSession.expiresAt && Date.now() > verificationSession.expiresAt.getTime()) {
      verificationSession.errorMessage = 'session expired'
      await this.updateState(agentContext, verificationSession, OpenId4VcVerificationSessionState.Error)
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidRequest,
        error_description: 'session expired',
      })
    }

    const result = await this.parseAuthorizationResponse(agentContext, {
      verificationSession,
      authorizationResponse,
      origin,
    })

    // NOTE: we always currently include only one key, and also use 'use=enc'. If we change
    // that, we should change this. I think we should return the jarm key in the openid4vp lib
    // and match against that (and also ensure then it's present in client_metadata -> should not conflict with federation)
    const encryptionJwk = authorizationRequest.client_metadata?.jwks?.keys.find((key) => key.use === 'enc')
    const encryptionPublicJwk = encryptionJwk ? Kms.PublicJwk.fromUnknown(encryptionJwk) : undefined

    let dcqlResponse: OpenId4VpVerifiedAuthorizationResponseDcql | undefined = undefined
    let pexResponse: OpenId4VpVerifiedAuthorizationResponsePresentationExchange | undefined = undefined
    let transactionData: OpenId4VpVerifiedAuthorizationResponseTransactionData[] | undefined = undefined

    try {
      const parsedClientId = getOpenid4vpClientId({
        responseMode: authorizationRequest.response_mode,
        clientId: authorizationRequest.client_id,
        legacyClientIdScheme: authorizationRequest.client_id_scheme,
        origin: options.origin,
        version: openid4vpVersion === 'v1' ? 100 : openid4vpVersion === 'v1.draft24' ? 24 : 21,
      })

      const clientId = parsedClientId.effectiveClientId
      const isDcApiRequest = isOpenid4vpAuthorizationRequestDcApi(authorizationRequest)

      // TODO: we should return the effectiveAudience in the returned value of openid4vp lib
      // Since it differs based on the version of openid4vp used
      // NOTE: in v1 DC API request the audience is always origin: (not the client id)
      const audience = openid4vpVersion === 'v1' && isDcApiRequest ? `origin:${options.origin}` : clientId

      const responseUri = isOpenid4vpAuthorizationRequestDcApi(authorizationRequest)
        ? undefined
        : authorizationRequest.response_uri

      // NOTE: apu is needed for mDOC over OID4VP without DC API up to draft 24
      const mdocGeneratedNonce = result.jarm?.jarmHeader.apu
        ? TypedArrayEncoder.toUtf8String(TypedArrayEncoder.fromBase64(result.jarm?.jarmHeader.apu))
        : undefined

      if (result.type === 'dcql') {
        const dcqlPresentationEntries = Object.entries(result.dcql.presentations)
        if (!authorizationRequest.dcql_query) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidRequest,
            error_description: 'DCQL response provided but no dcql_query found in the authorization request.',
          })
        }

        const dcql = agentContext.dependencyManager.resolve(DcqlService)
        const dcqlQuery = dcql.validateDcqlQuery(authorizationRequest.dcql_query)

        const presentationVerificationResults = await Promise.all(
          dcqlPresentationEntries.map(async ([credentialId, presentations]) => {
            const queryCredential = dcqlQuery.credentials.find((c) => c.id === credentialId)
            if (!queryCredential) {
              throw new Oauth2ServerErrorResponseError({
                error: Oauth2ErrorCodes.InvalidRequest,
                error_description: `vp_token contains presentation for credential query id '${credentialId}', but this credential is not present in the dcql query.`,
              })
            }

            const verifiedPresentations = await Promise.all(
              mapNonEmptyArray(presentations, (presentation) =>
                this.verifyPresentation(agentContext, {
                  format: dcqlFormatToPresentationClaimFormat[queryCredential.format],
                  nonce: authorizationRequest.nonce,
                  audience,
                  version: openid4vpVersion,
                  clientId,
                  encryptionJwk: encryptionPublicJwk,
                  origin: options.origin,
                  responseUri,
                  mdocGeneratedNonce,
                  verificationSessionId: result.verificationSession.id,
                  presentation,
                })
              )
            )
            return [credentialId, verifiedPresentations] as const
          })
        )

        const errorMessages = presentationVerificationResults
          .flatMap(([credentialId, presentations], index) =>
            presentations.map((result) =>
              !result.verified ? `\t- ${credentialId}[${index}]: ${result.reason}` : undefined
            )
          )
          .filter((i) => i !== undefined)
        if (errorMessages.length > 0) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: 'One or more presentations failed verification.',
            },
            { internalMessage: errorMessages.join('\n') }
          )
        }

        // We can be certain here that all presentations passed verification
        const presentations = Object.fromEntries(
          presentationVerificationResults.map(
            ([credentialId, presentations]) =>
              [
                credentialId,
                presentations
                  .map((p) => (p.verified ? p.presentation : undefined))
                  // NOTE: we add NonEmpty cast here since it's needed for DCQL, and because we
                  // previously ensured all items are valid, we can be sure this arary is non empty
                  // even after the filter.
                  .filter((p) => p !== undefined) as NonEmptyArray<VerifiablePresentation>,
              ] as const
          )
        )

        const presentationResult = await dcql.assertValidDcqlPresentation(agentContext, presentations, dcqlQuery)

        dcqlResponse = {
          presentations,
          presentationResult,
          query: dcqlQuery,
        }
      }

      if (result.type === 'pex') {
        const pex = agentContext.dependencyManager.resolve(DifPresentationExchangeService)

        const encodedPresentations = result.pex.presentations
        const submission = result.pex.presentationSubmission as DifPresentationExchangeSubmission
        const definition = result.pex.presentationDefinition as unknown as DifPresentationExchangeDefinition

        pex.validatePresentationDefinition(definition)

        try {
          pex.validatePresentationSubmission(submission)
        } catch (error) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: 'Invalid presentation submission.',
            },
            { cause: error }
          )
        }

        const presentationsArray = Array.isArray(encodedPresentations) ? encodedPresentations : [encodedPresentations]
        const presentationVerificationResults = await Promise.all(
          presentationsArray.map((presentation) => {
            return this.verifyPresentation(agentContext, {
              nonce: authorizationRequest.nonce,
              audience,
              clientId,
              version: openid4vpVersion,
              encryptionJwk: encryptionPublicJwk,
              responseUri,
              mdocGeneratedNonce,
              verificationSessionId: result.verificationSession.id,
              presentation,
              format: this.claimFormatFromEncodedPresentation(presentation),
              origin: options.origin,
            })
          })
        )

        const errorMessages = presentationVerificationResults
          .map((result, index) => (!result.verified ? `\t- [${index}]: ${result.reason}` : undefined))
          .filter((i) => i !== undefined)
        if (errorMessages.length > 0) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: 'One or more presentations failed verification.',
            },
            { internalMessage: errorMessages.join('\n') }
          )
        }

        const verifiablePresentations = presentationVerificationResults
          .map((p) => (p.verified ? p.presentation : undefined))
          .filter((p) => p !== undefined)

        try {
          pex.validatePresentation(
            definition,
            // vp_token MUST not be an array if only one entry
            verifiablePresentations.length === 1 ? verifiablePresentations[0] : verifiablePresentations,
            submission
          )
        } catch (error) {
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidRequest,
              error_description: 'Presentation submission does not satisy presentation request.',
            },
            { cause: error }
          )
        }

        const descriptors = extractPresentationsWithDescriptorsFromSubmission(
          // vp_token MUST not be an array if only one entry
          verifiablePresentations.length === 1 ? verifiablePresentations[0] : verifiablePresentations,
          submission,
          definition
        )

        pexResponse = {
          definition,
          descriptors,
          presentations: verifiablePresentations,
          submission,
        }
      }

      transactionData = await this.getVerifiedTransactionData(agentContext, {
        authorizationRequest,
        dcql: dcqlResponse,
        presentationExchange: pexResponse,
      })
    } catch (error) {
      result.verificationSession.errorMessage = error.message
      await this.updateState(agentContext, result.verificationSession, OpenId4VcVerificationSessionState.Error)
      throw error
    }

    result.verificationSession.authorizationResponsePayload = result.authorizationResponsePayload
    await this.updateState(agentContext, result.verificationSession, OpenId4VcVerificationSessionState.ResponseVerified)

    return {
      presentationExchange: pexResponse,
      dcql: dcqlResponse,
      transactionData,
      verificationSession: result.verificationSession,
    }
  }

  /**
   * Get the format based on an encoded presentation. This is mostly leveraged for
   * PEX where it's not known based on the request which format to expect
   */
  private claimFormatFromEncodedPresentation(
    presentation: string | Record<string, unknown>
  ): ClaimFormat.JwtVp | ClaimFormat.LdpVp | ClaimFormat.SdJwtVc | ClaimFormat.MsoMdoc {
    if (typeof presentation === 'object') return ClaimFormat.LdpVp
    if (presentation.includes('~')) return ClaimFormat.SdJwtVc
    if (Jwt.format.test(presentation)) return ClaimFormat.JwtVp

    // Fallback, we tried all other formats
    return ClaimFormat.MsoMdoc
  }

  public async getVerifiedAuthorizationResponse(
    agentContext: AgentContext,
    verificationSession: OpenId4VcVerificationSessionRecord
  ): Promise<OpenId4VpVerifiedAuthorizationResponse> {
    verificationSession.assertState(OpenId4VcVerificationSessionState.ResponseVerified)

    if (!verificationSession.authorizationResponsePayload) {
      throw new CredoError('No authorization response payload found in the verification session.')
    }

    const authorizationRequestPayload = verificationSession.requestPayload
    const openid4vpAuthorizationResponsePayload = verificationSession.authorizationResponsePayload
    const openid4vpVerifier = this.getOpenid4vpVerifier(agentContext)

    const result = openid4vpVerifier.validateOpenid4vpAuthorizationResponsePayload({
      authorizationRequestPayload: verificationSession.requestPayload,
      authorizationResponsePayload: openid4vpAuthorizationResponsePayload,
    })

    let presentationExchange: OpenId4VpVerifiedAuthorizationResponsePresentationExchange | undefined = undefined
    const dcql =
      result.type === 'dcql'
        ? await this.getDcqlVerifiedResponse(
            agentContext,
            authorizationRequestPayload.dcql_query,
            result.dcql.presentations
          )
        : undefined

    if (result.type === 'pex') {
      const presentationDefinition =
        authorizationRequestPayload.presentation_definition as unknown as DifPresentationExchangeDefinition
      const submission = openid4vpAuthorizationResponsePayload.presentation_submission as
        | DifPresentationExchangeSubmission
        | undefined

      if (!submission) {
        throw new CredoError('Unable to extract submission from the response.')
      }

      const verifiablePresentations = result.pex.presentations.map((presentation) =>
        this.decodePresentation(agentContext, {
          presentation,
          format: this.claimFormatFromEncodedPresentation(presentation),
        })
      )

      presentationExchange = {
        definition: presentationDefinition,
        submission,
        presentations: verifiablePresentations,
        descriptors: extractPresentationsWithDescriptorsFromSubmission(
          // vp_token MUST not be an array if only one entry
          verifiablePresentations.length === 1 ? verifiablePresentations[0] : verifiablePresentations,
          submission,
          presentationDefinition
        ),
      }
    }

    if (!presentationExchange && !dcql) {
      throw new CredoError('No presentationExchange or dcql found in the response.')
    }

    const transactionData = await this.getVerifiedTransactionData(agentContext, {
      authorizationRequest: authorizationRequestPayload,
      dcql,
      presentationExchange,
    })

    return {
      presentationExchange,
      dcql,
      transactionData,
      verificationSession,
    }
  }

  private async getVerifiedTransactionData(
    agentContext: AgentContext,
    {
      authorizationRequest,
      presentationExchange,
      dcql,
    }: {
      dcql?: OpenId4VpVerifiedAuthorizationResponseDcql
      presentationExchange?: OpenId4VpVerifiedAuthorizationResponsePresentationExchange
      authorizationRequest: OpenId4VpAuthorizationRequestPayload
    }
  ): Promise<OpenId4VpVerifiedAuthorizationResponseTransactionData[] | undefined> {
    if (!authorizationRequest.transaction_data) return undefined

    const openid4vpVerifier = this.getOpenid4vpVerifier(agentContext)
    const transactionDataHashesCredentials: TransactionDataHashesCredentials = {}

    // Extract presentations with credentialId
    const idToCredential = dcql
      ? Object.entries(dcql.presentations)
      : (presentationExchange?.descriptors.map(
          (descriptor) => [descriptor.descriptor.id, [descriptor.presentation]] as const
        ) ?? [])

    for (const [credentialId, presentations] of idToCredential) {
      // Only SD-JWT VC supported for now
      const transactionDataHashes = presentations.map((presentation) =>
        presentation.claimFormat === ClaimFormat.SdJwtVc ? getSdJwtVcTransactionDataHashes(presentation) : undefined
      )

      const firstHasHash = transactionDataHashes[0] !== undefined
      if (!transactionDataHashes.every((hash) => (firstHasHash ? hash !== undefined : hash === undefined))) {
        throw new Oauth2ServerErrorResponseError({
          error: Oauth2ErrorCodes.InvalidTransactionData,
          error_description: `Multipe presentations were submitted for credential query ${credentialId} but not all presentations includes a transaction data hash. Either all or none of the presentations for a credential query id should include a transaction data hash.`,
        })
      }

      if (!firstHasHash) continue

      transactionDataHashesCredentials[credentialId] = transactionDataHashes as [
        Exclude<(typeof transactionDataHashes)[number], undefined>,
      ]
    }

    // Verify the transaction data
    const transactionData = await openid4vpVerifier.verifyTransactionData({
      credentials: transactionDataHashesCredentials,
      transactionData: authorizationRequest.transaction_data,
    })

    return transactionData.map(({ credentialId, transactionDataEntry, presentations }) => ({
      credentialId,
      encoded: transactionDataEntry.encoded,
      decoded: transactionDataEntry.transactionData,
      transactionDataIndex: transactionDataEntry.transactionDataIndex,
      presentations: presentations.map((presentation) => ({
        presentationHashIndex: presentation.credentialHashIndex,
        hash: presentation.hash,
        // We only support the values supported by Credo hasher, so it can't be any other value than those.
        hashAlg: presentation.hashAlg as HashName,
      })) as OpenId4VpVerifiedAuthorizationResponseTransactionData['presentations'],
    }))
  }

  public async getAllVerifiers(agentContext: AgentContext) {
    return this.openId4VcVerifierRepository.getAll(agentContext)
  }

  public async getVerifierByVerifierId(agentContext: AgentContext, verifierId: string) {
    return this.openId4VcVerifierRepository.getByVerifierId(agentContext, verifierId)
  }

  public async updateVerifier(agentContext: AgentContext, verifier: OpenId4VcVerifierRecord) {
    return this.openId4VcVerifierRepository.update(agentContext, verifier)
  }

  public async createVerifier(agentContext: AgentContext, options?: OpenId4VpCreateVerifierOptions) {
    const openId4VcVerifier = new OpenId4VcVerifierRecord({
      verifierId: options?.verifierId ?? utils.uuid(),
      clientMetadata: options?.clientMetadata,
    })

    await this.openId4VcVerifierRepository.save(agentContext, openId4VcVerifier)
    await storeActorIdForContextCorrelationId(agentContext, openId4VcVerifier.verifierId)
    return openId4VcVerifier
  }

  public async findVerificationSessionsByQuery(
    agentContext: AgentContext,
    query: Query<OpenId4VcVerificationSessionRecord>,
    queryOptions?: QueryOptions
  ) {
    return this.openId4VcVerificationSessionRepository.findByQuery(agentContext, query, queryOptions)
  }

  public async getVerificationSessionById(agentContext: AgentContext, verificationSessionId: string) {
    return this.openId4VcVerificationSessionRepository.getById(agentContext, verificationSessionId)
  }

  private async getClientMetadata(
    agentContext: AgentContext,
    options: {
      responseMode: ResponseMode
      verifier: OpenId4VcVerifierRecord
      authorizationResponseUrl: string
      dcqlQuery?: DcqlQuery
      version: NonNullable<OpenId4VpCreateAuthorizationRequestOptions['version']>
    }
  ): Promise<ClientMetadata> {
    const { responseMode, verifier } = options

    const signatureSuiteRegistry = agentContext.resolve(SignatureSuiteRegistry)
    const kms = agentContext.resolve(Kms.KeyManagementApi)
    const supportedAlgs = getSupportedJwaSignatureAlgorithms(agentContext) as [
      Kms.KnownJwaSignatureAlgorithm,
      ...Kms.KnownJwaSignatureAlgorithm[],
    ]
    const supportedMdocAlgs = supportedAlgs.filter(isMdocSupportedSignatureAlgorithm) as [
      MdocSupportedSignatureAlgorithm,
      ...MdocSupportedSignatureAlgorithm[],
    ]
    const supportedProofTypes = signatureSuiteRegistry.supportedProofTypes

    type JarmEncryptionJwk = Kms.Jwk & { kid: string; use: 'enc' }
    let jarmEncryptionJwk: JarmEncryptionJwk | undefined

    if (isJarmResponseMode(responseMode)) {
      const key = await kms.createKey({ type: { crv: 'P-256', kty: 'EC' } })
      jarmEncryptionJwk = { ...key.publicJwk, use: 'enc' }
    }

    const jarmClientMetadata:
      | Pick<
          ClientMetadata,
          | 'jwks'
          | 'encrypted_response_enc_values_supported'
          | 'authorization_encrypted_response_alg'
          | 'authorization_encrypted_response_enc'
        >
      | undefined = jarmEncryptionJwk
      ? {
          jwks: { keys: [jarmEncryptionJwk as Jwk] },

          ...(options.version === 'v1'
            ? {
                encrypted_response_enc_values_supported: ['A128GCM', 'A256GCM', 'A128CBC-HS256'],
              }
            : {
                authorization_encrypted_response_alg: 'ECDH-ES',

                // NOTE: pre draft 24 we could only include one version. To maximize compatiblity we use
                // - A128GCM for draft 24 (HAIP)
                // - A256GCM for draft 21 (18013-7)
                authorization_encrypted_response_enc: options.version === 'v1.draft24' ? 'A128GCM' : 'A256GCM',
              }),
        }
      : undefined

    const dclqQueryFormats = new Set(options.dcqlQuery?.credentials.map((c) => c.format))

    return {
      ...jarmClientMetadata,
      ...verifier.clientMetadata,
      response_types_supported: ['vp_token'],

      // for v1 version we only include the vp_formats_supported for formats we're
      // requesting.
      ...(options.version === 'v1'
        ? {
            vp_formats_supported: {
              ...(dclqQueryFormats.has('dc+sd-jwt')
                ? {
                    'dc+sd-jwt': {
                      'kb-jwt_alg_values': supportedAlgs,
                      'sd-jwt_alg_values': supportedAlgs,
                    },
                  }
                : {}),

              ...(dclqQueryFormats.has('mso_mdoc')
                ? {
                    mso_mdoc: {
                      // TODO: we need to add some generic utils for fully specified COSE algorithms
                      deviceauth_alg_values: [/* P-256 */ -9, /* P-384 */ -51, /* Ed25519 */ -19],
                      issuerauth_alg_values: [/* P-256 */ -9, /* P-384 */ -51, /* Ed25519 */ -19],
                    },
                  }
                : {}),

              ...(dclqQueryFormats.has('jwt_vc_json')
                ? {
                    jwt_vc_json: {
                      alg_values: supportedAlgs,
                    },
                  }
                : {}),

              ...(dclqQueryFormats.has('ldp_vc')
                ? {
                    ldp_vc: {
                      proof_type_values: supportedProofTypes as [string, ...string[]],
                    },
                  }
                : {}),
            },
          }
        : {
            vp_formats: {
              mso_mdoc: {
                alg: supportedMdocAlgs,
              },
              jwt_vc: {
                alg: supportedAlgs,
              },
              jwt_vc_json: {
                alg: supportedAlgs,
              },
              jwt_vp_json: {
                alg: supportedAlgs,
              },
              jwt_vp: {
                alg: supportedAlgs,
              },
              ldp_vc: {
                proof_type: supportedProofTypes,
              },
              ldp_vp: {
                proof_type: supportedProofTypes,
              },
              'vc+sd-jwt': {
                'kb-jwt_alg_values': supportedAlgs,
                'sd-jwt_alg_values': supportedAlgs,
              },
              'dc+sd-jwt': {
                'kb-jwt_alg_values': supportedAlgs,
                'sd-jwt_alg_values': supportedAlgs,
              },
            },
          }),
    }
  }

  private decodePresentation(
    agentContext: AgentContext,
    options: {
      presentation: string | Record<string, unknown>
      format: ClaimFormat.JwtVp | ClaimFormat.LdpVp | ClaimFormat.SdJwtVc | ClaimFormat.MsoMdoc
    }
  ): VerifiablePresentation {
    const { presentation, format } = options

    if (format === ClaimFormat.SdJwtVc) {
      if (typeof presentation !== 'string') {
        throw new CredoError(`Expected vp_token entry for format ${format} to be of type string`)
      }
      const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)

      const sdJwtVc = sdJwtVcApi.fromCompact(presentation)
      return sdJwtVc
    }
    if (format === ClaimFormat.MsoMdoc) {
      if (typeof presentation !== 'string') {
        throw new CredoError(`Expected vp_token entry for format ${format} to be of type string`)
      }
      const mdocDeviceResponse = MdocDeviceResponse.fromBase64Url(presentation)
      return mdocDeviceResponse
    }
    if (format === ClaimFormat.JwtVp) {
      if (typeof presentation !== 'string') {
        throw new CredoError(`Expected vp_token entry for format ${format} to be of type string`)
      }
      return W3cJwtVerifiablePresentation.fromSerializedJwt(presentation)
    }

    return JsonTransformer.fromJSON(presentation, W3cJsonLdVerifiablePresentation)
  }

  private async verifyPresentation(
    agentContext: AgentContext,
    options: {
      nonce: string
      audience: string
      clientId: string
      responseUri?: string
      mdocGeneratedNonce?: string
      origin?: string
      verificationSessionId: string
      presentation: string | Record<string, unknown>
      format: ClaimFormat.LdpVp | ClaimFormat.JwtVp | ClaimFormat.SdJwtVc | ClaimFormat.MsoMdoc
      version: OpenId4VpVersion
      encryptionJwk?: Kms.PublicJwk
    }
  ): Promise<
    | {
        verified: true
        presentation: VerifiablePresentation
        transactionData?: TransactionDataHashesCredentials[string]
      }
    | { verified: false; reason: string }
  > {
    const x509Config = agentContext.dependencyManager.resolve(X509ModuleConfig)
    const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)

    const { presentation, format } = options

    try {
      this.logger.trace('Presentation response', JsonTransformer.toJSON(presentation))

      let isValid: boolean
      let cause: Error | undefined = undefined
      let verifiablePresentation: VerifiablePresentation

      if (format === ClaimFormat.SdJwtVc) {
        if (typeof presentation !== 'string') {
          throw new CredoError(`Expected vp_token entry for format ${format} to be of type string`)
        }

        const sdJwtVc = sdJwtVcApi.fromCompact(presentation)
        const jwt = Jwt.fromSerializedJwt(presentation.split('~')[0])
        const certificateChain = extractX509CertificatesFromJwt(jwt)

        let trustedCertificates: string[] | undefined = undefined
        if (certificateChain && x509Config.getTrustedCertificatesForVerification) {
          trustedCertificates = await x509Config.getTrustedCertificatesForVerification(agentContext, {
            certificateChain,
            verification: {
              type: 'credential',
              credential: sdJwtVc,
              openId4VcVerificationSessionId: options.verificationSessionId,
            },
          })
        }

        if (!trustedCertificates) {
          // We also take from the config here to avoid the callback being called again
          trustedCertificates = x509Config.trustedCertificates ?? []
        }

        const verificationResult = await sdJwtVcApi.verify({
          compactSdJwtVc: presentation,
          keyBinding: {
            audience: options.audience,
            nonce: options.nonce,
          },
          trustedCertificates,
        })

        isValid = verificationResult.verification.isValid
        cause = verificationResult.isValid ? undefined : verificationResult.error
        verifiablePresentation = sdJwtVc
      } else if (format === ClaimFormat.MsoMdoc) {
        if (typeof presentation !== 'string') {
          throw new CredoError('Expected vp_token entry for format mso_mdoc to be of type string')
        }
        const mdocDeviceResponse = MdocDeviceResponse.fromBase64Url(presentation)
        if (mdocDeviceResponse.documents.length === 0) {
          throw new CredoError('mdoc device response does not contain any mdocs')
        }

        const deviceResponses = mdocDeviceResponse.splitIntoSingleDocumentResponses()

        for (const deviceResponseIndex of deviceResponses.keys()) {
          const mdocDeviceResponse = deviceResponses[deviceResponseIndex]

          const document = mdocDeviceResponse.documents[0]
          const certificateChain = document.issuerSignedCertificateChain.map((cert) =>
            X509Certificate.fromRawCertificate(cert)
          )

          const trustedCertificates = await x509Config.getTrustedCertificatesForVerification?.(agentContext, {
            certificateChain,
            verification: {
              type: 'credential',
              credential: document,
              openId4VcVerificationSessionId: options.verificationSessionId,
            },
          })

          let sessionTranscriptOptions: MdocSessionTranscriptOptions
          if (options.origin && options.version === 'v1') {
            sessionTranscriptOptions = {
              type: 'openId4VpDcApi',
              verifierGeneratedNonce: options.nonce,
              origin: options.origin,
              encryptionJwk: options.encryptionJwk,
            }
          } else if (options.origin) {
            sessionTranscriptOptions = {
              type: 'openId4VpDcApiDraft24',
              clientId: options.clientId,
              verifierGeneratedNonce: options.nonce,
              origin: options.origin,
            }
          } else if (options.version === 'v1') {
            if (!options.responseUri) {
              throw new CredoError('responseUri is required for mdoc openid4vp session transcript calculation')
            }

            sessionTranscriptOptions = {
              type: 'openId4Vp',
              clientId: options.clientId,
              responseUri: options.responseUri,
              verifierGeneratedNonce: options.nonce,
              encryptionJwk: options.encryptionJwk,
            }
          } else {
            if (!options.mdocGeneratedNonce || !options.responseUri) {
              throw new CredoError(
                'mdocGeneratedNonce and responseUri are required for mdoc openid4vp session transcript calculation'
              )
            }

            sessionTranscriptOptions = {
              type: 'openId4VpDraft18',
              clientId: options.clientId,
              mdocGeneratedNonce: options.mdocGeneratedNonce,
              responseUri: options.responseUri,
              verifierGeneratedNonce: options.nonce,
            }
          }

          await mdocDeviceResponse.verify(agentContext, {
            sessionTranscriptOptions,
            trustedCertificates,
          })
        }
        // TODO: extract transaction data hashes once https://github.com/openid/OpenID4VP/pull/330 is resolved

        isValid = true
        verifiablePresentation = mdocDeviceResponse
      } else if (format === ClaimFormat.JwtVp) {
        if (typeof presentation !== 'string') {
          throw new CredoError(`Expected vp_token entry for format ${format} to be of type string`)
        }

        verifiablePresentation = W3cJwtVerifiablePresentation.fromSerializedJwt(presentation)
        const verificationResult = await this.w3cCredentialService.verifyPresentation(agentContext, {
          presentation,
          challenge: options.nonce,
          domain: options.audience,
        })

        isValid = verificationResult.isValid
        cause = verificationResult.error
      } else {
        verifiablePresentation = JsonTransformer.fromJSON(presentation, W3cJsonLdVerifiablePresentation)
        const verificationResult = await this.w3cCredentialService.verifyPresentation(agentContext, {
          presentation: verifiablePresentation,
          challenge: options.nonce,
          domain: options.audience,
        })

        isValid = verificationResult.isValid
        cause = verificationResult.error
      }

      if (!isValid) {
        throw new CredoError(`Error occured during verification of presentation.${cause ? ` ${cause.message}` : ''}`, {
          cause,
        })
      }

      return {
        verified: true,
        presentation: verifiablePresentation,
      }
    } catch (error) {
      agentContext.config.logger.warn('Error occurred during verification of presentation', {
        error,
      })
      return {
        verified: false,
        reason: error.message,
      }
    }
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   */
  public async updateState(
    agentContext: AgentContext,
    verificationSession: OpenId4VcVerificationSessionRecord,
    newState: OpenId4VcVerificationSessionState
  ) {
    agentContext.config.logger.debug(
      `Updating openid4vc verification session record ${verificationSession.id} to state ${newState} (previous=${verificationSession.state})`
    )

    const previousState = verificationSession.state
    verificationSession.state = newState
    await this.openId4VcVerificationSessionRepository.update(agentContext, verificationSession)

    this.emitStateChangedEvent(agentContext, verificationSession, previousState)
  }

  protected emitStateChangedEvent(
    agentContext: AgentContext,
    verificationSession: OpenId4VcVerificationSessionRecord,
    previousState: OpenId4VcVerificationSessionState | null
  ) {
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)

    eventEmitter.emit<OpenId4VcVerificationSessionStateChangedEvent>(agentContext, {
      type: OpenId4VcVerifierEvents.VerificationSessionStateChanged,
      payload: {
        verificationSession: verificationSession.clone(),
        previousState,
      },
    })
  }
}
