import type {
  AgentContext,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
  JwkJson,
  Query,
  QueryOptions,
  VerifiablePresentation
} from '@credo-ts/core'
import { parseIfJson, parseOpenid4vpRequestParams, parsePresentationsFromVpToken, verifyOpenid4vpAuthorizationResponse, VpTokenPresentationParseResult } from '@openid4vc/oid4vp'
import type { IDTokenPayload, JarmClientMetadata } from '@sphereon/did-auth-siop'
import type {
  OpenId4VcSiopCreateAuthorizationRequestOptions,
  OpenId4VcSiopCreateAuthorizationRequestReturn,
  OpenId4VcSiopCreateVerifierOptions,
  OpenId4VcSiopVerifiedAuthorizationResponse,
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
} from '@credo-ts/core'
import { PresentationDefinitionLocation } from '@sphereon/did-auth-siop'
import {
  assertValidVerifiablePresentations,
  extractPresentationsFromVpToken,
} from '@sphereon/did-auth-siop/dist/authorization-response/OpenID4VP'

import { storeActorIdForContextCorrelationId } from '../shared/router'
import { getSupportedJwaSignatureAlgorithms, openIdTokenIssuerToJwtIssuer } from '../shared/utils'

import { ClientIdScheme, createOpenid4vpAuthorizationRequest } from '@openid4vc/oid4vp'
import { PresentationSubmission } from '@sphereon/ssi-types'
import { getOid4vciCallbacks } from '../shared/callbacks'
import { OpenId4VcSiopAuthorizationResponsePayload } from '../shared/index.js'
import { OpenId4VcVerificationSessionState } from './OpenId4VcVerificationSessionState'
import { OpenId4VcVerifierModuleConfig } from './OpenId4VcVerifierModuleConfig'
import {
  OpenId4VcVerificationSessionRepository,
  OpenId4VcVerifierRecord,
  OpenId4VcVerifierRepository,
} from './repository'
import { OpenId4VcRelyingPartyEventHandler } from './repository/OpenId4VcRelyingPartyEventEmitter'

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

    const callbacks = getOid4vciCallbacks(agentContext)

    const authorizationRequest = await createOpenid4vpAuthorizationRequest({
      jar: { jwtSigner: jwtIssuer, requestUri: hostedAuthorizationRequestUri },
      requestParams: {
        client_id: `${clientIdScheme}:${clientId}`,
        nonce,
        state,
        presentation_definition: options.presentationExchange?.definition as any,
        response_uri: authorizationResponseUrl,
        response_mode: options.responseMode ?? 'direct_post',
        response_type: 'vp_token',
        client_metadata: {
          ...(await this.getClientMetadata(agentContext, {
            responseMode: options.responseMode ?? 'direct_post',
            verifier: options.verifier,
            clientId,
            authorizationResponseUrl,
          })),
        },
      },
      callbacks,
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
      authorizationRequest: authorizationRequest.uri,
      verificationSession,
    }
  }

  public async verifyAuthorizationResponse(
    agentContext: AgentContext,
    options: OpenId4VcSiopVerifyAuthorizationResponseOptions & {
      verificationSession: OpenId4VcVerificationSessionRecord
      jarmHeader?: { apu?: string; apv?: string }
    }
  ): Promise<OpenId4VcSiopVerifiedAuthorizationResponse & { verificationSession: OpenId4VcVerificationSessionRecord }> {
    // Assert state
    options.verificationSession.assertState([
      OpenId4VcVerificationSessionState.RequestUriRetrieved,
      OpenId4VcVerificationSessionState.RequestCreated,
    ])

    const authRequestJwtParseResult = parseOpenid4vpRequestParams(options.verificationSession.authorizationRequestJwt)
    if (authRequestJwtParseResult.provided !== 'jwt' || authRequestJwtParseResult.type === 'jar') {
      throw new CredoError('Invalid authorization request jwt')
    }

    const authorizationRequest = authRequestJwtParseResult.params
    const {client_id: requestClientId, nonce: requestNonce, response_uri: responseUri} = authorizationRequest

    const openId4VcRelyingPartyEventHandler = await agentContext.dependencyManager.resolve(
      OpenId4VcRelyingPartyEventHandler
    )

    let result: ReturnType<typeof verifyOpenid4vpAuthorizationResponse>
    try {
      result = verifyOpenid4vpAuthorizationResponse({
        requestParams: authorizationRequest,
        responseParams: options.authorizationResponse,
        jarm: undefined,
      })
    } catch (error) {
      await openId4VcRelyingPartyEventHandler.authorizationResponseReceivedFailed(agentContext, {
        verifierId: options.verificationSession.verifierId,
        correlationId: options.verificationSession.id,
        authorizationResponsePayload: options.authorizationResponse,
        errorMessage: error.message,
      })

      throw error
    }

    // validating the id token
    // verifying the presentations
    // validating the presentations against the presentation definition
    // checking the revocation status of the presentations
    // checking the nonce of the presentations matches the nonce of the request

    if (result.type === 'dcql') {
      throw new CredoError('DCQL is not supported yet')
    }

    // for us verifying the presentations also checks the nonces match only thing we need to do manually is check if the mdoc
    // nonce in the jarm header matches the nonce in the request
    let mdocGeneratedNonce: string | undefined
    if (options.jarmHeader?.apu) {
      mdocGeneratedNonce = TypedArrayEncoder.toUtf8String(TypedArrayEncoder.fromBase64(options.jarmHeader.apu))
      // TODO: CORRECT THIS CHECK
      //if (mdocGeneratedNonce !== requestNonce) {
        //throw new CredoError('The nonce in the jarm header does not match the nonce in the request.')
      //}
    }

    const presentations = result.pex.presentations
    const pex = agentContext.dependencyManager.resolve(DifPresentationExchangeService)
    pex.validatePresentationDefinition(
      result.pex.presentation_definition as unknown as DifPresentationExchangeDefinition
    )
    pex.validatePresentationSubmission(
      result.pex.presentation_submission as unknown as DifPresentationExchangeSubmission
    )

    const presentationVerificationPromises = (Array.isArray(presentations) ? presentations : [presentations]).map(
      (presentation) => {
        return this.verifyPresentations(agentContext, {
          correlationId: options.verificationSession.id,
          nonce: result.nonce,
          audience: requestClientId,
          responseUri,
          mdocGeneratedNonce: mdocGeneratedNonce,
          verificationSessionRecordId: options.verificationSession.id,
          vpTokenPresentationParseResult: presentation,
          presentationSubmission: result.pex.presentation_submission as any,
        })
      }
    )

    try {
      const presentationVerificationResults = await Promise.all(presentationVerificationPromises)

      if (presentationVerificationResults.some((result) => !result.verified)) {
        throw new CredoError('One or more presentations failed verification.')
      }

      // This should be provided by pex-light!
      // It must check if the presentations match the presentation definition
      assertValidVerifiablePresentations({
        presentationDefinitions: [
          {
            definition: result.pex.presentation_definition as any,
            location: PresentationDefinitionLocation.TOPLEVEL_PRESENTATION_DEF,
          },
        ],
        verificationCallback: async () => ({verified: true}),
        presentations: options.authorizationResponse.vp_token
          ? await extractPresentationsFromVpToken(parseIfJson(options.authorizationResponse.vp_token) as any, {
              hasher: Hasher.hash,
            })
          : [],
        opts: {
          hasher: Hasher.hash,
          presentationSubmission: result.pex.presentation_submission as any,
        },
      })
    } catch (error) {
      await openId4VcRelyingPartyEventHandler.authorizationResponseVerifiedFailed(agentContext, {
        verifierId: options.verificationSession.verifierId,
        correlationId: options.verificationSession.id,
        errorMessage: error.message,
      })
      throw error
    }

    await openId4VcRelyingPartyEventHandler.authorizationResponseVerifiedSuccess(agentContext, {
      verifierId: options.verificationSession.verifierId,
      correlationId: options.verificationSession.id,
      authorizationResponsePayload: options.authorizationResponse,
    })

    const verificationSession = await this.getVerificationSessionById(agentContext, options.verificationSession.id)
    const verifiedAuthorizationResponse = await this.getVerifiedAuthorizationResponse(agentContext, verificationSession)

    return { ...verifiedAuthorizationResponse, verificationSession }
  }

  public async getVerifiedAuthorizationResponse(
    agentContext: AgentContext,
    verificationSession: OpenId4VcVerificationSessionRecord
  ): Promise<OpenId4VcSiopVerifiedAuthorizationResponse> {
    verificationSession.assertState(OpenId4VcVerificationSessionState.ResponseVerified)

    if (!verificationSession.authorizationResponsePayload) {
      throw new CredoError('No authorization response payload found in the verification session.')
    }
    const idToken = verificationSession.authorizationResponsePayload.id_token
    const idTokenPayload = idToken ? Jwt.fromSerializedJwt(idToken).payload : undefined

    const authorizationRequest = parseOpenid4vpRequestParams(verificationSession.authorizationRequestJwt)
    if (authorizationRequest.provided !== 'jwt' || authorizationRequest.type === 'jar') {
      throw new CredoError('Invalid authorization request jwt')
    }

    let presentationExchange: OpenId4VcSiopVerifiedAuthorizationResponse['presentationExchange'] | undefined = undefined

    const vpToken = parseIfJson(verificationSession.authorizationResponsePayload.vp_token)

    const presentationDefinition = authorizationRequest.params.presentation_definition as unknown as DifPresentationExchangeDefinition
    if (presentationDefinition) {
      if (!vpToken) {
        throw new CredoError('Missing vp_token in the openid4vp authorization response.')
      }

      const rawPresentations = parsePresentationsFromVpToken({vp_token: vpToken })

      const submission = verificationSession.authorizationResponsePayload
        .presentation_submission as (PresentationSubmission | undefined)
      if (!submission) {
        throw new CredoError('Unable to extract submission from the response.')
      }

      const verifiablePresentations = rawPresentations.map(presentation => this.getPresentationFromVpTokenParseResult(agentContext, presentation))
      presentationExchange = {
        definition: presentationDefinition,
        submission,
        presentations: verifiablePresentations,
        descriptors: extractPresentationsWithDescriptorsFromSubmission(verifiablePresentations, submission, presentationDefinition),
      }
    }

    if (!idToken && !presentationExchange) {
      throw new CredoError('No idToken or presentationExchange found in the response.')
    }

    return {
      idToken: idTokenPayload ? { payload: idTokenPayload as IDTokenPayload } : undefined,
      presentationExchange,
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
    const supportedAlgs = getSupportedJwaSignatureAlgorithms(agentContext) as string[]
    const supportedProofTypes = signatureSuiteRegistry.supportedProofTypes

    // FIXME: we now manually remove did:peer, we should probably allow the user to configure this
    const supportedDidMethods = agentContext.dependencyManager
      .resolve(DidsApi)
      .supportedResolverMethods.filter((m) => m !== 'peer')

    type JarmEncryptionJwk = JwkJson & { kid: string; use: 'enc' }
    let jarmEncryptionJwk: JarmEncryptionJwk | undefined

    if (responseMode === 'direct_post.jwt') {
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
          alg: supportedAlgs,
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
         return  MdocDeviceResponse.fromBase64Url(vpTokenPresentationParseResult.presentation)
      } else if (vpTokenPresentationParseResult.format === 'jwt_vp_json') {
        return W3cJwtVerifiablePresentation.fromSerializedJwt(vpTokenPresentationParseResult.presentation)
      } else if (vpTokenPresentationParseResult.format === 'ldp_vp') {
        return JsonTransformer.fromJSON(vpTokenPresentationParseResult.presentation, W3cJsonLdVerifiablePresentation)
      }

      throw new CredoError(`Unsupported presentation format. ${vpTokenPresentationParseResult.format}`)
  }


  private async verifyPresentations(
    agentContext: AgentContext,
    options: {
      nonce: string
      audience: string
      correlationId: string
      responseUri?: string
      mdocGeneratedNonce?: string
      verificationSessionRecordId: string
      vpTokenPresentationParseResult: VpTokenPresentationParseResult
      presentationSubmission: PresentationSubmission
    }
  ): Promise<{ verified: true; presentation: VerifiablePresentation } | { verified: false; reason: string }> {
    const { vpTokenPresentationParseResult, presentationSubmission } = options

    try {
      this.logger.debug(`Presentation response`, JsonTransformer.toJSON(vpTokenPresentationParseResult.presentation))
      this.logger.debug(`Presentation submission`, presentationSubmission)

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
        const sdJwtPresentation = W3cJwtVerifiablePresentation.fromSerializedJwt(vpTokenPresentationParseResult.presentation)
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
        verifiablePresentation = W3cJwtVerifiablePresentation.fromSerializedJwt(vpTokenPresentationParseResult.presentation)
      } else {
        const w3cJsonLdVerifiablePresentation = JsonTransformer.fromJSON(vpTokenPresentationParseResult.presentation, W3cJsonLdVerifiablePresentation)
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


}
