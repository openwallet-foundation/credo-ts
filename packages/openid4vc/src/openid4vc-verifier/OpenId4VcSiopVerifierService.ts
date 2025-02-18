import type {
  AgentContext,
  DcqlQuery,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
  JwkJson,
  Query,
  QueryOptions,
  TransactionData,
  TransactionDataMeta,
  TransactionDataResult,
  VerifiablePresentation,
} from '@credo-ts/core'
import {
  Oid4vcVerifier,
  JarmClientMetadata,
  VpTokenPresentationParseResult,
  parseOpenid4vpAuthorizationResponse,
  parseOpenid4vpAuthorizationRequestPayload,
  ParsedOpenid4vpAuthorizationResponse,
  isOpenid4vpAuthorizationResponseDcApi,
  isJarmResponseMode,
} from '@openid4vc/oid4vp'
import type {
  OpenId4VcSiopCreateAuthorizationRequestOptions,
  OpenId4VcSiopCreateAuthorizationRequestReturn,
  OpenId4VcSiopCreateVerifierOptions,
  OpenId4VcSiopVerifiedAuthorizationResponse,
  OpenId4VcSiopVerifiedAuthorizationResponseDcql,
  OpenId4VcSiopVerifyAuthorizationResponseOptions,
  ResponseMode,
} from './OpenId4VcSiopVerifierServiceOptions'
import { OpenId4VcVerificationSessionRecord } from './repository'

import {
  CredoError,
  DidsApi,
  DifPresentationExchangeService,
  extractPresentationsWithDescriptorsFromSubmission,
  extractX509CertificatesFromJwt,
  getDomainFromUrl,
  getJwkFromKey,
  Hasher,
  inject,
  injectable,
  InjectionSymbols,
  joinUriParts,
  JsonEncoder,
  JsonTransformer,
  Jwt,
  KeyType,
  Logger,
  MdocDeviceResponse,
  SdJwtVcApi,
  SignatureSuiteRegistry,
  TypedArrayEncoder,
  utils,
  W3cCredentialService,
  W3cJsonLdVerifiablePresentation,
  W3cJwtVerifiablePresentation,
  X509Certificate,
  X509ModuleConfig,
  X509Service,
  isMdocSupportedSignatureAlgorithm,
  DcqlService,
} from '@credo-ts/core'
import { PresentationDefinitionLocation } from '@sphereon/did-auth-siop'
import {
  assertValidVerifiablePresentations,
  extractPresentationsFromVpToken,
} from '@sphereon/did-auth-siop/dist/authorization-response/OpenID4VP'

import { storeActorIdForContextCorrelationId } from '../shared/router'
import { getSupportedJwaSignatureAlgorithms, openIdTokenIssuerToJwtIssuer, parseIfJson } from '../shared/utils'

import { ClientIdScheme } from '@openid4vc/oid4vp'
import { getOid4vcCallbacks } from '../shared/callbacks'
import { OpenId4VcSiopAuthorizationResponsePayload } from '../shared/index'
import { OpenId4VcVerificationSessionState } from './OpenId4VcVerificationSessionState'
import { OpenId4VcVerifierModuleConfig } from './OpenId4VcVerifierModuleConfig'
import {
  OpenId4VcVerificationSessionRepository,
  OpenId4VcVerifierRecord,
  OpenId4VcVerifierRepository,
} from './repository'
import { OpenId4VcRelyingPartyEventHandler } from './repository/OpenId4VcRelyingPartyEventEmitter'
import { Oauth2ErrorCodes, Oauth2ServerErrorResponseError } from '@openid4vc/oauth2'
import { zOpenid4vpAuthorizationResponse } from '@openid4vc/oid4vp'

/**
 * @internal
 */
@injectable()
export class OpenId4VcSiopVerifierService {
  public constructor(
    @inject(InjectionSymbols.Logger) private logger: Logger,
    private w3cCredentialService: W3cCredentialService,
    private openId4VcVerifierRepository: OpenId4VcVerifierRepository,
    private config: OpenId4VcVerifierModuleConfig,
    private openId4VcVerificationSessionRepository: OpenId4VcVerificationSessionRepository
  ) {}

  private getOpenid4vpVerifier(agentContext: AgentContext) {
    const callbacks = getOid4vcCallbacks(agentContext)
    const openid4vpClient = new Oid4vcVerifier({ callbacks })

    return openid4vpClient
  }

  public async createAuthorizationRequest(
    agentContext: AgentContext,
    options: OpenId4VcSiopCreateAuthorizationRequestOptions & { verifier: OpenId4VcVerifierRecord }
  ): Promise<OpenId4VcSiopCreateAuthorizationRequestReturn> {
    const nonce = await agentContext.wallet.generateNonce()
    const state = await agentContext.wallet.generateNonce()

    // Correlation id will be the id of the verification session record
    const correlationId = utils.uuid()

    let authorizationResponseUrl = joinUriParts(this.config.baseUrl, [
      options.verifier.verifierId,
      this.config.authorizationEndpoint.endpointPath,
    ])

    const jwtIssuer =
      options.requestSigner.method === 'x5c'
        ? await openIdTokenIssuerToJwtIssuer(agentContext, {
            ...options.requestSigner,
            issuer: authorizationResponseUrl,
          })
        : await openIdTokenIssuerToJwtIssuer(agentContext, options.requestSigner)

    let clientIdScheme: ClientIdScheme
    let clientId: string

    if (jwtIssuer.method === 'x5c') {
      if (jwtIssuer.issuer !== authorizationResponseUrl) {
        throw new CredoError(
          `The jwtIssuer's issuer field must match the verifier's authorizationResponseUrl '${authorizationResponseUrl}'.`
        )
      }
      const leafCertificate = X509Service.getLeafCertificate(agentContext, { certificateChain: jwtIssuer.x5c })

      if (leafCertificate.sanDnsNames.includes(getDomainFromUrl(jwtIssuer.issuer))) {
        clientIdScheme = 'x509_san_dns'
        clientId = getDomainFromUrl(jwtIssuer.issuer)
        authorizationResponseUrl = jwtIssuer.issuer
      } else if (leafCertificate.sanUriNames.includes(jwtIssuer.issuer)) {
        clientIdScheme = 'x509_san_uri'
        clientId = jwtIssuer.issuer
        authorizationResponseUrl = clientId
      } else {
        throw new CredoError(
          `With jwtIssuer 'method' 'x5c' the jwtIssuer's 'issuer' field must either match the match a sanDnsName (FQDN) or sanUriName in the leaf x509 chain's leaf certificate.`
        )
      }
    } else if (jwtIssuer.method === 'did') {
      clientId = jwtIssuer.didUrl.split('#')[0]
      clientIdScheme = 'did'
    } else {
      throw new CredoError(
        `Unsupported jwt issuer method '${options.requestSigner.method}'. Only 'did' and 'x5c' are supported.`
      )
    }

    // We always use shortened URIs currently
    const hostedAuthorizationRequestUri = joinUriParts(this.config.baseUrl, [
      options.verifier.verifierId,
      this.config.authorizationRequestEndpoint.endpointPath,
      // It doesn't really matter what the url is, as long as it's unique
      utils.uuid(),
    ])

    const transaction_data =
      (options.dcql?.transactionData ?? options.presentationExchange?.transactionData)?.map((tdEntry) =>
        JsonEncoder.toBase64URL(tdEntry)
      ) ?? undefined

    const client_id =
      clientIdScheme === 'did' || (clientIdScheme as string) === 'https' ? clientId : `${clientIdScheme}:${clientId}`
    const client_metadata = {
      ...(await this.getClientMetadata(agentContext, {
        responseMode: options.responseMode ?? 'direct_post',
        verifier: options.verifier,
        clientId,
        authorizationResponseUrl,
      })),
    }

    const openid4vpVerifier = this.getOpenid4vpVerifier(agentContext)
    const authorizationRequest = await openid4vpVerifier.createOpenId4vpAuthorizationRequest({
      jar: { jwtSigner: jwtIssuer, requestUri: hostedAuthorizationRequestUri },
      requestParams: {
        client_id,
        nonce,
        state,
        presentation_definition: options.presentationExchange?.definition as any,
        dcql_query: options.dcql?.query,
        transaction_data,
        response_uri: authorizationResponseUrl,
        response_mode: options.responseMode ?? 'direct_post',
        response_type: 'vp_token',
        client_metadata,
        expected_origins: options.expectedOrigins,
      },
    })

    const verificationSession = await agentContext.dependencyManager
      .resolve(OpenId4VcRelyingPartyEventHandler)
      .authorizationRequestCreatedSuccess(agentContext, {
        verifierId: options.verifier.verifierId,
        correlationId,
        authorizationRequestJwt: authorizationRequest.jar?.requestObjectJwt,
        authorizationRequestUri: authorizationRequest.jar?.requestUri,
      })

    return {
      authorizationRequest: authorizationRequest.authRequest,
      verificationSession,
    }
  }

  private getDcqlVerifiedResponse(
    agentContext: AgentContext,
    _dcqlQuery: unknown,
    presentation: Record<string, VpTokenPresentationParseResult>
  ) {
    const dcqlService = agentContext.dependencyManager.resolve(DcqlService)
    const dcqlQuery = dcqlService.validateDcqlQuery(_dcqlQuery as DcqlQuery)

    const dcqlPresentationEntries = Object.entries(presentation)
    const dcqlPresentation = Object.fromEntries(
      dcqlPresentationEntries.map((presentation) => {
        const [credentialId, vpTokenPresentationParseResult] = presentation
        return [credentialId, this.decodePresentation(agentContext, { vpTokenPresentationParseResult })]
      })
    )

    const dcqlPresentationResult = dcqlService.assertValidDcqlPresentation(dcqlPresentation, dcqlQuery)
    if (dcqlPresentationResult.canBeSatisfied) {
      throw new CredoError('The dcql query cannot be satisfied.')
    }

    return {
      query: dcqlQuery,
      presentation: dcqlPresentation,
      presentationResult: dcqlPresentationResult,
    } satisfies OpenId4VcSiopVerifiedAuthorizationResponseDcql
  }

  public async parseAuthorizationResponse(
    agentContext: AgentContext,
    options: {
      verifierId: string
      responsePayload: Record<string, unknown>
      setResponseState?: boolean
    }
  ): Promise<ParsedOpenid4vpAuthorizationResponse & { verificationSession: OpenId4VcVerificationSessionRecord }> {
    const { verifierId, responsePayload } = options

    let verificationSession: OpenId4VcVerificationSessionRecord | undefined
    let parsedAuthResponse: ParsedOpenid4vpAuthorizationResponse

    let rawResponsePayload = responsePayload

    try {
      parsedAuthResponse = await parseOpenid4vpAuthorizationResponse({
        responsePayload,
        callbacks: {
          ...getOid4vcCallbacks(agentContext),
          getOpenid4vpAuthorizationRequest: async (responsePayload) => {
            const { state, nonce } = responsePayload
            rawResponsePayload = responsePayload
            const openId4VcVerifierService = agentContext.dependencyManager.resolve(OpenId4VcSiopVerifierService)
            const session = await openId4VcVerifierService.findVerificationSessionForAuthorizationResponse(
              agentContext,
              { authorizationResponseParams: { state, nonce }, verifierId }
            )

            if (!session) {
              agentContext.config.logger.warn(
                `No verification session found for incoming authorization response for verifier ${verifierId}`
              )
              throw new CredoError(`No state or nonce provided in authorization response for verifier ${verifierId}`)
            }
            verificationSession = session

            const authorizationRequest = parseOpenid4vpAuthorizationRequestPayload({ requestPayload: verificationSession.authorizationRequestJwt })
            if (authorizationRequest.type !== 'openid4vp') {
              throw new CredoError(
                `Invalid authorization request jwt. Expected 'openid4vp' request, received '${authorizationRequest.type}'.`
              )
            }
            return { authRequest: authorizationRequest.params }
          },
        },
      })
    } catch (error) {
      if (
        options.setResponseState &&
        verificationSession &&
        (verificationSession.state === OpenId4VcVerificationSessionState.RequestUriRetrieved ||
          verificationSession.state === OpenId4VcVerificationSessionState.RequestCreated)
      ) {
        const parsed = zOpenid4vpAuthorizationResponse.safeParse(rawResponsePayload)
        if (!parsed.success) throw new error

        await agentContext.dependencyManager
          .resolve(OpenId4VcRelyingPartyEventHandler)
          .authorizationResponseReceivedFailed(agentContext, {
            verifierId,
            correlationId: verificationSession.id,
            authorizationResponsePayload: parsed.data,
            errorMessage: error.message,
          })
      }

      throw error
    }
    if (
      parsedAuthResponse.authResponsePayload.presentation_submission &&
      typeof parsedAuthResponse.authResponsePayload.presentation_submission === 'string'
    ) {
      const decoded = decodeURIComponent(parsedAuthResponse.authResponsePayload.presentation_submission)
      const parsed = JSON.parse(decoded)
      parsedAuthResponse.authResponsePayload.presentation_submission = parsed
      if (parsedAuthResponse.type === 'pex') {
        parsedAuthResponse.pex.presentationSubmission = parsed
      }
    }

    if (!verificationSession) {
      throw new CredoError('Missing verification session, cannot verify authorization response.')
    }

    if (parsedAuthResponse.jarm && parsedAuthResponse.jarm.type !== 'encrypted') {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidRequest,
        error_description: `Only encrypted JARM responses are supported, received '${parsedAuthResponse.jarm.type}'.`,
      })
    }

    return {
      ...parsedAuthResponse,
      verificationSession,
    }
  }

  public async verifyAuthorizationResponse(
    agentContext: AgentContext,
    options: OpenId4VcSiopVerifyAuthorizationResponseOptions & {
      verifierId: string
      jarmHeader?: { apu?: string; apv?: string }
      origin?: string
    }
  ): Promise<OpenId4VcSiopVerifiedAuthorizationResponse & { verificationSession: OpenId4VcVerificationSessionRecord }> {
    const openid4vpVerifier = this.getOpenid4vpVerifier(agentContext)
    const openId4VcRelyingPartyEventHandler = await agentContext.dependencyManager.resolve(
      OpenId4VcRelyingPartyEventHandler
    )

    const result = await this.parseAuthorizationResponse(agentContext, {
      verifierId: options.verifierId,
      responsePayload: options.authorizationResponse,
      setResponseState: true,
    })

    result.verificationSession.assertState([
      OpenId4VcVerificationSessionState.RequestUriRetrieved,
      OpenId4VcVerificationSessionState.RequestCreated,
    ])

    const authorizationRequest = result.authRequestPayload
    const { client_id: requestClientId, nonce: requestNonce, response_uri: responseUri } = authorizationRequest

    const transactionData = authorizationRequest.transaction_data
      ? openid4vpVerifier.parseTransactionData({ transactionData: authorizationRequest.transaction_data })
      : undefined

    // validating the id token
    // verifying the presentations
    // validating the presentations against the presentation definition
    // checking the revocation status of the presentations
    // checking the nonce of the presentations matches the nonce of the request
    let presentationVerificationResults: Awaited<ReturnType<typeof this.verifyPresentations>>[] = []

    if (result.type === 'dcql') {
      const dcqlPresentationEntries = Object.entries(result.dcql.presentation)
      const presentationVerificationPromises = dcqlPresentationEntries.map(async (presentation) => {
        const [credentialId, vpTokenPresentationParseResult] = presentation
        return await this.verifyPresentations(agentContext, {
          correlationId: result.verificationSession.id,
          transactionData,
          nonce: requestNonce,
          audience: requestClientId,
          responseUri,
          mdocGeneratedNonce: result.jarm?.mdocGeneratedNonce,
          verificationSessionRecordId: result.verificationSession.id,
          vpTokenPresentationParseResult,
          credentialId,
        })
      })

      presentationVerificationResults = await Promise.all(presentationVerificationPromises)
    }

    if (result.type === 'pex') {
      const presentations = result.pex.presentations
      const pex = agentContext.dependencyManager.resolve(DifPresentationExchangeService)
      pex.validatePresentationDefinition(
        result.pex.presentationDefinition as unknown as DifPresentationExchangeDefinition
      )
      pex.validatePresentationSubmission(
        result.pex.presentationSubmission as unknown as DifPresentationExchangeSubmission
      )

      // This should be provided by pex-light!
      // It must check if the presentations match the presentation definition
      assertValidVerifiablePresentations({
        presentationDefinitions: [
          {
            definition: result.pex.presentationDefinition as any,
            location: PresentationDefinitionLocation.TOPLEVEL_PRESENTATION_DEF,
          },
        ],
        verificationCallback: async () => ({ verified: true }),
        presentations: result.authResponsePayload.vp_token
          ? await extractPresentationsFromVpToken(parseIfJson(result.authResponsePayload.vp_token) as any, {
              hasher: Hasher.hash,
            })
          : [],
        opts: {
          hasher: Hasher.hash,
          presentationSubmission: result.pex.presentationSubmission as any,
        },
      })

      const presentationVerificationPromises = (Array.isArray(presentations) ? presentations : [presentations]).map(
        (presentation) => {
          const inputDescriptor = (
            result.pex.presentationSubmission as DifPresentationExchangeSubmission
          ).descriptor_map.find((descriptorMapEntry) => descriptorMapEntry.path === presentation.path)
          if (!inputDescriptor) {
            throw new CredoError(`Could not map transaction data entry to input descriptor.`)
          }

          return this.verifyPresentations(agentContext, {
            correlationId: result.verificationSession.id,
            transactionData,
            nonce: requestNonce,
            audience: requestClientId,
            responseUri,
            mdocGeneratedNonce: result.jarm?.mdocGeneratedNonce,
            verificationSessionRecordId: result.verificationSession.id,
            vpTokenPresentationParseResult: presentation,
            credentialId: inputDescriptor.id,
          })
        }
      )

      presentationVerificationResults = await Promise.all(presentationVerificationPromises)
    }

    try {
      if (presentationVerificationResults.some((result) => !result.verified)) {
        throw new CredoError('One or more presentations failed verification.')
      }

      const transactionDataMeta: [string, TransactionDataMeta][] = []
      for (const result of presentationVerificationResults) {
        if (result.verified && result.transactionDataMeta) {
          transactionDataMeta.push([result.transactionDataMeta.credentialId, result.transactionDataMeta])
        }
      }

      if (transactionData) {
        const inputDescriptorToTransactionDataMeta = Object.fromEntries(transactionDataMeta)

        if (
          !transactionData.every((tdEntry) => {
            return tdEntry.credential_ids.some((credentialId) => inputDescriptorToTransactionDataMeta[credentialId])
          })
        ) {
          throw new CredoError(
            'One ore more required transaction data entries were not found in the signed transaction data.'
          )
        }
      }
    } catch (error) {
      await openId4VcRelyingPartyEventHandler.authorizationResponseVerifiedFailed(agentContext, {
        verifierId: options.verifierId,
        correlationId: result.verificationSession.id,
        errorMessage: error.message,
      })
      throw error
    }

    await openId4VcRelyingPartyEventHandler.authorizationResponseVerifiedSuccess(agentContext, {
      verifierId: options.verifierId,
      correlationId: result.verificationSession.id,
      authorizationResponsePayload: result.authResponsePayload,
    })

    const verificationSession = await this.getVerificationSessionById(agentContext, result.verificationSession.id)
    const verifiedAuthorizationResponse = await this.getVerifiedAuthorizationResponse(agentContext, verificationSession)

    return { ...verifiedAuthorizationResponse, verificationSession, transactionData }
  }

  public async getVerifiedAuthorizationResponse(
    agentContext: AgentContext,
    verificationSession: OpenId4VcVerificationSessionRecord
  ): Promise<OpenId4VcSiopVerifiedAuthorizationResponse> {
    verificationSession.assertState(OpenId4VcVerificationSessionState.ResponseVerified)

    if (!verificationSession.authorizationResponsePayload) {
      throw new CredoError('No authorization response payload found in the verification session.')
    }

    const openid4vpAuthorizationResponsePayload = isOpenid4vpAuthorizationResponseDcApi(verificationSession.authorizationResponsePayload)
      ? verificationSession.authorizationResponsePayload.data
      : verificationSession.authorizationResponsePayload


    const openid4vpVerifier = this.getOpenid4vpVerifier(agentContext)
    const authorizationRequest = openid4vpVerifier.parseOpenid4vpAuthorizationRequestPayload({
      requestPayload: verificationSession.authorizationRequestJwt,
    })
    if (authorizationRequest.provided !== 'jwt' || authorizationRequest.type === 'jar') {
      throw new CredoError('Invalid authorization request jwt')
    }

    const result = openid4vpVerifier.validateOpenid4vpAuthorizationResponse({
      authorizationRequest: authorizationRequest.params,
      authorizationResponse: openid4vpAuthorizationResponsePayload,
    })

    const transactionData = authorizationRequest.params.transaction_data
      ? openid4vpVerifier.parseTransactionData({ transactionData: authorizationRequest.params.transaction_data })
      : undefined

    let presentationExchange: OpenId4VcSiopVerifiedAuthorizationResponse['presentationExchange'] | undefined = undefined
    let dcql =
      result.type === 'dcql'
        ? this.getDcqlVerifiedResponse(agentContext, authorizationRequest.params.dcql_query, result.dcql.presentation)
        : undefined

    const vpToken = parseIfJson(openid4vpAuthorizationResponsePayload.vp_token)

    const presentationDefinition = authorizationRequest.params
      .presentation_definition as unknown as DifPresentationExchangeDefinition
    if (presentationDefinition) {
      if (!vpToken) {
        throw new CredoError('Missing vp_token in the openid4vp authorization response.')
      }

      const rawPresentations = openid4vpVerifier.parsePresentationsFromVpToken({ vpToken })

      const submission = openid4vpAuthorizationResponsePayload.presentation_submission as
        | DifPresentationExchangeSubmission
        | undefined
      if (!submission) {
        throw new CredoError('Unable to extract submission from the response.')
      }

      const verifiablePresentations = rawPresentations.map((presentation) =>
        this.getPresentationFromVpTokenParseResult(agentContext, presentation)
      )
      presentationExchange = {
        definition: presentationDefinition,
        submission,
        presentations: verifiablePresentations,
        descriptors: extractPresentationsWithDescriptorsFromSubmission(
          verifiablePresentations,
          submission,
          presentationDefinition
        ),
      }
    }

    if (!presentationExchange && !dcql) {
      throw new CredoError('No presentationExchange or dcql found in the response.')
    }

    return {
      presentationExchange,
      dcql,
      transactionData,
    }
  }

  /**
   * Find the verification session associated with an authorization response. You can optionally provide a verifier id
   * if the verifier that the response is associated with is already known.
   */
  public async findVerificationSessionForAuthorizationResponse(
    agentContext: AgentContext,
    {
      authorizationResponse,
      authorizationResponseParams,
      verifierId,
    }:
      | {
          authorizationResponse?: never
          authorizationResponseParams: {
            state?: string
            nonce?: string
          }
          verifierId?: string
        }
      | {
          authorizationResponse: OpenId4VcSiopAuthorizationResponsePayload
          authorizationResponseParams?: never
          verifierId?: string
        }
  ) {
    let nonce: string | undefined
    let state: string | undefined

    if (authorizationResponse) {
      const state = authorizationResponse.state
      if (!state) {
        throw new CredoError(
          'Could not extract nonce or state from authorization response. Unable to find OpenId4VcVerificationSession.'
        )
      }
    } else {
      if (authorizationResponseParams?.nonce && !authorizationResponseParams?.state) {
        throw new CredoError(
          'Either nonce or state must be provided if no authorization response is provided. Unable to find OpenId4VcVerificationSession.'
        )
      }
      nonce = authorizationResponseParams?.nonce
      state = authorizationResponseParams?.state
    }

    const verificationSession = await this.openId4VcVerificationSessionRepository.findSingleByQuery(agentContext, {
      nonce,
      payloadState: state,
      verifierId,
    })

    return verificationSession
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

  public async createVerifier(agentContext: AgentContext, options?: OpenId4VcSiopCreateVerifierOptions) {
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
      clientId: string
      authorizationResponseUrl: string
    }
  ) {
    const { responseMode, verifier, clientId } = options

    const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)
    const supportedAlgs = getSupportedJwaSignatureAlgorithms(agentContext)
    const supportedMdocAlgs = supportedAlgs.filter(isMdocSupportedSignatureAlgorithm)
    const supportedProofTypes = signatureSuiteRegistry.supportedProofTypes

    // FIXME: we now manually remove did:peer, we should probably allow the user to configure this
    const supportedDidMethods = agentContext.dependencyManager
      .resolve(DidsApi)
      .supportedResolverMethods.filter((m) => m !== 'peer')

    type JarmEncryptionJwk = JwkJson & { kid: string; use: 'enc' }
    let jarmEncryptionJwk: JarmEncryptionJwk | undefined

    if (isJarmResponseMode(responseMode)) {
      const key = await agentContext.wallet.createKey({ keyType: KeyType.P256 })
      jarmEncryptionJwk = { ...getJwkFromKey(key).toJson(), kid: key.fingerprint, use: 'enc' }
    }

    const jarmClientMetadata: (JarmClientMetadata & { jwks: { keys: JarmEncryptionJwk[] } }) | undefined =
      jarmEncryptionJwk
        ? {
            jwks: { keys: [jarmEncryptionJwk] },
            authorization_encrypted_response_alg: 'ECDH-ES',
            authorization_encrypted_response_enc: 'A256GCM',
          }
        : undefined

    return {
      ...jarmClientMetadata,
      ...verifier.clientMetadata,
      // FIXME: not passing client_id here means it will not be added
      // to the authorization request url (not the signed payload). Need
      // to fix that in Sphereon lib
      client_id: clientId,
      response_types_supported: ['vp_token'],
      subject_syntax_types_supported: [
        'urn:ietf:params:oauth:jwk-thumbprint',
        ...supportedDidMethods.map((m) => `did:${m}`),
      ],
      authorization_signed_response_alg: 'RS256',
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
      },
    }
  }

  private getPresentationFromVpTokenParseResult(
    agentContext: AgentContext,
    vpTokenPresentationParseResult: VpTokenPresentationParseResult
  ): VerifiablePresentation {
    if (vpTokenPresentationParseResult.format === 'dc+sd-jwt') {
      const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)
      return sdJwtVcApi.fromCompact(vpTokenPresentationParseResult.presentation)
    } else if (vpTokenPresentationParseResult.format === 'mso_mdoc') {
      return MdocDeviceResponse.fromBase64Url(vpTokenPresentationParseResult.presentation)
    } else if (vpTokenPresentationParseResult.format === 'jwt_vp_json') {
      return W3cJwtVerifiablePresentation.fromSerializedJwt(vpTokenPresentationParseResult.presentation)
    } else if (vpTokenPresentationParseResult.format === 'ldp_vp') {
      return JsonTransformer.fromJSON(vpTokenPresentationParseResult.presentation, W3cJsonLdVerifiablePresentation)
    }

    throw new CredoError(`Unsupported presentation format. ${vpTokenPresentationParseResult.format}`)
  }

  private getTransactionDataMeta(options: {
    vpTokenPresentationParseResult: VpTokenPresentationParseResult
    transactionData?: TransactionData
    transactionDataResult: TransactionDataResult
    credentialId: string
  }) {
    const { vpTokenPresentationParseResult, transactionData, transactionDataResult, credentialId } = options

    if (!transactionData) {
      throw new CredoError('Could not map transaction data result to the request')
    }

    const hashName = transactionDataResult.hashes_alg ?? 'sha-256'
    const presentationHashes = transactionDataResult.hashes

    const transactionDataEntriesWithHash = transactionData.map((tdEntry) => {
      const hash = TypedArrayEncoder.toBase64URL(Hasher.hash(JsonEncoder.toBase64URL(tdEntry), hashName))
      return hash
    })

    for (const [idx, hash] of transactionDataEntriesWithHash.entries()) {
      if (presentationHashes[idx] !== hash) {
        throw new CredoError(`Transaction data entry ${idx} does not match hash ${hash}`)
      }
    }

    return {
      credentialId,
      transactionData,
      transactionDataResult,
      path: vpTokenPresentationParseResult.path,
    }
  }

  private decodePresentation(
    agentContext: AgentContext,
    options: { vpTokenPresentationParseResult: VpTokenPresentationParseResult }
  ): VerifiablePresentation {
    const { vpTokenPresentationParseResult } = options

    if (vpTokenPresentationParseResult.format === 'dc+sd-jwt') {
      // TODO: it might be better here to look at the presentation submission to know
      // If presentation includes a ~, we assume it's an SD-JWT-VC
      const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)

      const sdJwtVc = sdJwtVcApi.fromCompact(vpTokenPresentationParseResult.presentation)
      return sdJwtVc
    } else if (vpTokenPresentationParseResult.format === 'mso_mdoc') {
      const mdocDeviceResponse = MdocDeviceResponse.fromBase64Url(vpTokenPresentationParseResult.presentation)
      return mdocDeviceResponse
    } else if (vpTokenPresentationParseResult.format === 'jwt_vp_json') {
      return W3cJwtVerifiablePresentation.fromSerializedJwt(vpTokenPresentationParseResult.presentation)
    } else {
      return JsonTransformer.fromJSON(vpTokenPresentationParseResult.presentation, W3cJsonLdVerifiablePresentation)
    }
  }

  private async verifyPresentations(
    agentContext: AgentContext,
    options: {
      nonce: string
      audience: string
      correlationId: string
      responseUri?: string
      mdocGeneratedNonce?: string
      transactionData?: TransactionData
      verificationSessionRecordId: string
      vpTokenPresentationParseResult: VpTokenPresentationParseResult
      credentialId: string
    }
  ): Promise<
    | {
        verified: true
        presentation: VerifiablePresentation
        transactionDataMeta?: TransactionDataMeta
        credentialId: string
      }
    | { verified: false; reason: string; credentialId: string }
  > {
    const { vpTokenPresentationParseResult, transactionData } = options

    let transactionDataMeta: TransactionDataMeta | undefined = undefined

    try {
      this.logger.debug(`Presentation response`, JsonTransformer.toJSON(vpTokenPresentationParseResult.presentation))

      if (!vpTokenPresentationParseResult) throw new CredoError('Did not receive a presentation for verification.')
      const x509Config = agentContext.dependencyManager.resolve(X509ModuleConfig)

      let isValid: boolean
      let reason: string | undefined = undefined
      let verifiablePresentation: VerifiablePresentation

      if (vpTokenPresentationParseResult.format === 'dc+sd-jwt') {
        // TODO: it might be better here to look at the presentation submission to know
        // If presentation includes a ~, we assume it's an SD-JWT-VC
        const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)

        const jwt = Jwt.fromSerializedJwt(vpTokenPresentationParseResult.presentation.split('~')[0])
        const sdJwtVc = sdJwtVcApi.fromCompact(vpTokenPresentationParseResult.presentation)
        const certificateChain = extractX509CertificatesFromJwt(jwt)

        let trustedCertificates: string[] | undefined = undefined
        if (certificateChain && x509Config.getTrustedCertificatesForVerification) {
          trustedCertificates = await x509Config.getTrustedCertificatesForVerification(agentContext, {
            certificateChain,
            verification: {
              type: 'credential',
              credential: sdJwtVc,
              openId4VcVerificationSessionId: options.verificationSessionRecordId,
            },
          })
        }

        if (!trustedCertificates) {
          // We also take from the config here to avoid the callback being called again
          trustedCertificates = x509Config.trustedCertificates ?? []
        }

        const verificationResult = await sdJwtVcApi.verify({
          compactSdJwtVc: vpTokenPresentationParseResult.presentation,
          keyBinding: {
            audience: options.audience,
            nonce: options.nonce,
          },
          trustedCertificates,
        })

        if (verificationResult.sdJwtVc?.transactionData) {
          transactionDataMeta = this.getTransactionDataMeta({
            vpTokenPresentationParseResult,
            transactionData,
            transactionDataResult: verificationResult.sdJwtVc.transactionData,
            credentialId: options.credentialId,
          })
        }

        isValid = verificationResult.verification.isValid
        reason = verificationResult.isValid ? undefined : verificationResult.error.message
        verifiablePresentation = sdJwtVc
      } else if (vpTokenPresentationParseResult.format === 'mso_mdoc') {
        if (!options.responseUri || !options.mdocGeneratedNonce) {
          throw new CredoError(
            'Mdoc device response verification failed. Response uri and the mdocGeneratedNonce are not set'
          )
        } else {
          const mdocDeviceResponse = MdocDeviceResponse.fromBase64Url(vpTokenPresentationParseResult.presentation)

          const trustedCertificates = (
            await Promise.all(
              mdocDeviceResponse.documents.map(async (mdoc) => {
                const certificateChain = mdoc.issuerSignedCertificateChain.map((cert) =>
                  X509Certificate.fromRawCertificate(cert)
                )

                const trustedCertificates = await x509Config.getTrustedCertificatesForVerification?.(agentContext, {
                  certificateChain,
                  verification: {
                    type: 'credential',
                    credential: mdoc,
                    openId4VcVerificationSessionId: options.verificationSessionRecordId,
                  },
                })

                // TODO: could have some duplication but not a big issue
                return trustedCertificates ?? x509Config.trustedCertificates
              })
            )
          )
            .filter((c): c is string[] => c !== undefined)
            .flatMap((c) => c)

          await mdocDeviceResponse.verify(agentContext, {
            sessionTranscriptOptions: {
              clientId: options.audience,
              mdocGeneratedNonce: options.mdocGeneratedNonce,
              responseUri: options.responseUri,
              verifierGeneratedNonce: options.nonce,
            },
            trustedCertificates,
          })
          isValid = true
          verifiablePresentation = mdocDeviceResponse
        }
      } else if (vpTokenPresentationParseResult.format === 'jwt_vp_json') {
        const sdJwtPresentation = W3cJwtVerifiablePresentation.fromSerializedJwt(
          vpTokenPresentationParseResult.presentation
        )
        const certificateChain = extractX509CertificatesFromJwt(sdJwtPresentation.jwt)

        let trustedCertificates: string[] | undefined = undefined
        if (certificateChain && x509Config.getTrustedCertificatesForVerification) {
          trustedCertificates = await x509Config.getTrustedCertificatesForVerification?.(agentContext, {
            certificateChain,
            verification: {
              type: 'credential',
              credential: sdJwtPresentation,
              openId4VcVerificationSessionId: options.verificationSessionRecordId,
            },
          })
        }

        if (!trustedCertificates) {
          trustedCertificates = x509Config.trustedCertificates ?? []
        }

        const verificationResult = await this.w3cCredentialService.verifyPresentation(agentContext, {
          presentation: vpTokenPresentationParseResult.presentation,
          challenge: options.nonce,
          domain: options.audience,
          trustedCertificates,
        })

        isValid = verificationResult.isValid
        reason = verificationResult.error?.message
        verifiablePresentation = W3cJwtVerifiablePresentation.fromSerializedJwt(
          vpTokenPresentationParseResult.presentation
        )
      } else {
        const w3cJsonLdVerifiablePresentation = JsonTransformer.fromJSON(
          vpTokenPresentationParseResult.presentation,
          W3cJsonLdVerifiablePresentation
        )
        const verificationResult = await this.w3cCredentialService.verifyPresentation(agentContext, {
          presentation: w3cJsonLdVerifiablePresentation,
          challenge: options.nonce,
          domain: options.audience,
        })

        isValid = verificationResult.isValid
        reason = verificationResult.error?.message
        verifiablePresentation = w3cJsonLdVerifiablePresentation
      }

      if (!isValid) {
        throw new Error(reason)
      }

      return {
        verified: true,
        transactionDataMeta,
        presentation: verifiablePresentation,
        credentialId: options.credentialId,
      }
    } catch (error) {
      agentContext.config.logger.warn('Error occurred during verification of presentation', {
        error,
      })
      return {
        verified: false,
        reason: error.message,
        credentialId: options.credentialId,
      }
    }
  }
}
