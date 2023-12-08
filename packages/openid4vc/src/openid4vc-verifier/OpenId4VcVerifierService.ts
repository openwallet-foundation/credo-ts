import type {
  ProofRequestWithMetadata,
  CreateProofRequestOptions,
  ProofRequestMetadata,
  VerifiedProofResponse,
  VerifierEndpointConfig,
  HolderMetadata,
} from './OpenId4VcVerifierServiceOptions'
import type { VerificationRequest } from './router/OpenId4VpEndpointConfiguration'
import type { AgentContext, W3cVerifyPresentationResult } from '@aries-framework/core'
import type {
  AuthorizationResponsePayload,
  PresentationVerificationCallback,
  SigningAlgo,
} from '@sphereon/did-auth-siop'
import type { NextFunction, Response, Router } from 'express'

import {
  InjectionSymbols,
  Logger,
  W3cCredentialService,
  inject,
  injectable,
  AriesFrameworkError,
  W3cJsonLdVerifiablePresentation,
  JsonTransformer,
  AgentContextProvider,
} from '@aries-framework/core'
import {
  RP,
  ResponseIss,
  RevocationVerification,
  SupportedVersion,
  ResponseMode,
  PropertyTarget,
  ResponseType,
  CheckLinkedDomain,
  PresentationDefinitionLocation,
  PassBy,
  VerificationMode,
  AuthorizationResponse,
} from '@sphereon/did-auth-siop'
import bodyParser from 'body-parser'

import { getRequestContext, getEndpointUrl, initializeAgentFromContext } from '../shared/router'
import {
  generateRandomValues,
  getSupportedDidMethods,
  getSuppliedSignatureFromVerificationMethod,
  getResolver,
  getSupportedJwaSignatureAlgorithms,
} from '../shared/utils'

import { OpenId4VcVerifierModuleConfig } from './OpenId4VcVerifierModuleConfig'
import { staticOpOpenIdConfig, staticOpSiopConfig } from './OpenId4VcVerifierServiceOptions'
import { configureVerificationEndpoint } from './router/OpenId4VpEndpointConfiguration'

/**
 * @internal
 */
@injectable()
export class OpenId4VcVerifierService {
  private logger: Logger
  private w3cCredentialService: W3cCredentialService
  private openId4VcVerifierModuleConfig: OpenId4VcVerifierModuleConfig
  private agentContextProvider: AgentContextProvider

  public get verifierMetadata() {
    return this.openId4VcVerifierModuleConfig.verifierMetadata
  }

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    @inject(InjectionSymbols.AgentContextProvider) agentContextProvider: AgentContextProvider,
    w3cCredentialService: W3cCredentialService,
    openId4VcVerifierModuleConfig: OpenId4VcVerifierModuleConfig
  ) {
    this.agentContextProvider = agentContextProvider
    this.w3cCredentialService = w3cCredentialService
    this.logger = logger
    this.openId4VcVerifierModuleConfig = openId4VcVerifierModuleConfig
  }

  public async getRelyingParty(
    agentContext: AgentContext,
    createProofRequestOptions: CreateProofRequestOptions,
    proofRequestMetadata?: ProofRequestMetadata
  ) {
    const {
      verificationEndpointUrl,
      presentationDefinition,
      verificationMethod,
      holderMetadata: _holderClientMetadata,
    } = createProofRequestOptions

    const isVpRequest = presentationDefinition !== undefined

    let holderClientMetadata: HolderMetadata
    if (!_holderClientMetadata) {
      // use a static set of configuration values defined in the spec
      if (isVpRequest) {
        holderClientMetadata = staticOpOpenIdConfig
      } else {
        holderClientMetadata = staticOpSiopConfig
      }
    } else {
      if (typeof _holderClientMetadata === 'string') {
        // Use OpenId Discovery to get the client metadata
        let reference_uri = _holderClientMetadata
        if (!reference_uri.endsWith('/.well-known/openid-configuration')) {
          reference_uri = reference_uri + '/.well-known/openid-configuration'
        }
        holderClientMetadata = { reference_uri, passBy: PassBy.REFERENCE, targets: PropertyTarget.REQUEST_OBJECT }
      } else {
        holderClientMetadata = _holderClientMetadata
      }
    }

    const { signature, did, kid, alg } = await getSuppliedSignatureFromVerificationMethod(
      agentContext,
      verificationMethod
    )

    // Check if the OpenId Provider (Holder) can validate the request signature provided by the Relying Party (Verifier)
    const requestObjectSigningAlgValuesSupported = holderClientMetadata.requestObjectSigningAlgValuesSupported
    if (requestObjectSigningAlgValuesSupported && !requestObjectSigningAlgValuesSupported.includes(alg)) {
      throw new AriesFrameworkError(
        [
          `Cannot sign authorization request with '${alg}' that isn't supported by the OpenId Provider.`,
          `Supported algorithms are ${requestObjectSigningAlgValuesSupported}`,
        ].join('\n')
      )
    }

    // Check if the Relying Party (Verifier) can validate the IdToken provided by the OpenId Provider (Holder)
    const idTokenSigningAlgValuesSupported = holderClientMetadata.idTokenSigningAlgValuesSupported
    if (idTokenSigningAlgValuesSupported) {
      const rpSupportedSignatureAlgorithms = getSupportedJwaSignatureAlgorithms(
        agentContext
      ) as unknown as SigningAlgo[]

      const possibleIdTokenSigningAlgValues = Array.isArray(idTokenSigningAlgValuesSupported)
        ? idTokenSigningAlgValuesSupported.filter((value) => rpSupportedSignatureAlgorithms.includes(value))
        : rpSupportedSignatureAlgorithms.includes(idTokenSigningAlgValuesSupported)

      if (!possibleIdTokenSigningAlgValues) {
        throw new AriesFrameworkError(
          [
            `The OpenId Provider supports no signature algorithms that are supported by the Relying Party.`,
            `Relying Party supported algorithms are ${rpSupportedSignatureAlgorithms}.`,
            `OpenId Provider supported algorithms are ${idTokenSigningAlgValuesSupported}.`,
          ].join('\n')
        )
      }
    }

    const authorizationEndpoint = holderClientMetadata?.authorization_endpoint ?? (isVpRequest ? 'openid:' : 'siopv2:')

    const redirectUri =
      verificationEndpointUrl ??
      getEndpointUrl(
        this.verifierMetadata.verifierBaseUrl,
        this.openId4VcVerifierModuleConfig.getBasePath(agentContext),
        this.verifierMetadata.verificationEndpointPath
      )

    // Check: audience must be set to the issuer with dynamic disc otherwise self-issued.me/v2.
    const builder = RP.builder()
      .withClientId(verificationMethod.id)
      .withRedirectUri(redirectUri)
      .withIssuer(ResponseIss.SELF_ISSUED_V2)
      .withSuppliedSignature(signature, did, kid, alg)
      .withSupportedVersions([SupportedVersion.SIOPv2_D11, SupportedVersion.SIOPv2_D12_OID4VP_D18])
      .withClientMetadata(holderClientMetadata)
      .withCustomResolver(getResolver(agentContext))
      .withResponseMode(ResponseMode.POST)
      .withResponseType(isVpRequest ? [ResponseType.ID_TOKEN, ResponseType.VP_TOKEN] : ResponseType.ID_TOKEN)
      .withScope('openid')
      .withRequestBy(PassBy.VALUE)
      .withAuthorizationEndpoint(authorizationEndpoint)
      .withCheckLinkedDomain(CheckLinkedDomain.NEVER)
      .withRevocationVerification(RevocationVerification.NEVER)
      .withSessionManager(this.openId4VcVerifierModuleConfig.getSessionManager(agentContext))
      .withEventEmitter(this.openId4VcVerifierModuleConfig.getEventEmitter(agentContext))
    // .withWellknownDIDVerifyCallback

    if (proofRequestMetadata) {
      builder.withPresentationVerification(
        this.getPresentationVerificationCallback(agentContext, { challenge: proofRequestMetadata.challenge })
      )
    }

    if (isVpRequest) {
      builder.withPresentationDefinition({ definition: presentationDefinition }, [
        PropertyTarget.REQUEST_OBJECT,
        PropertyTarget.AUTHORIZATION_REQUEST,
      ])
    }

    const supportedDidMethods = getSupportedDidMethods(agentContext)
    for (const supportedDidMethod of supportedDidMethods) {
      builder.addDidMethod(supportedDidMethod)
    }

    return builder.build()
  }

  public async createProofRequest(
    agentContext: AgentContext,
    options: CreateProofRequestOptions
  ): Promise<ProofRequestWithMetadata> {
    const [noncePart1, noncePart2, state, correlationId] = await generateRandomValues(agentContext, 4)
    const challenge = noncePart1 + noncePart2

    const relyingParty = await this.getRelyingParty(agentContext, options)

    const authorizationRequest = await relyingParty.createAuthorizationRequest({
      correlationId,
      nonce: challenge,
      state,
    })

    const authorizationRequestUri = await authorizationRequest.uri()
    const encodedAuthorizationRequestUri = authorizationRequestUri.encodedUri

    const proofRequestMetadata = { correlationId, challenge, state }

    await this.openId4VcVerifierModuleConfig
      .getSessionManager(agentContext)
      .saveVerifyProofResponseOptions(correlationId, {
        createProofRequestOptions: options,
        proofRequestMetadata,
      })

    return {
      proofRequest: encodedAuthorizationRequestUri,
      proofRequestMetadata,
    }
  }

  public async verifyProofResponse(
    agentContext: AgentContext,
    authorizationResponsePayload: AuthorizationResponsePayload
  ): Promise<VerifiedProofResponse> {
    let authorizationResponse: AuthorizationResponse
    try {
      authorizationResponse = await AuthorizationResponse.fromPayload(authorizationResponsePayload)
    } catch (error: unknown) {
      throw new AriesFrameworkError(
        `Unable to parse authorization response payload. ${JSON.stringify(authorizationResponsePayload)}`
      )
    }

    const resNonce = (await authorizationResponse.getMergedProperty('nonce', false)) as string
    const resState = (await authorizationResponse.getMergedProperty('state', false)) as string
    const sessionManager = this.openId4VcVerifierModuleConfig.getSessionManager(agentContext)

    const correlationId =
      (await sessionManager.getCorrelationIdByNonce(resNonce, false)) ??
      (await sessionManager.getCorrelationIdByState(resState, false))
    if (!correlationId) {
      throw new AriesFrameworkError(`Unable to find correlationId for nonce '${resNonce}' or state '${resState}'`)
    }

    const verifyProofResponseOptions = await sessionManager.getVerifyProofResponseOptions(correlationId)
    if (!verifyProofResponseOptions) {
      throw new AriesFrameworkError(`Unable to associate a request to the response correlationId '${correlationId}'`)
    }

    const { createProofRequestOptions, proofRequestMetadata } = verifyProofResponseOptions
    const presentationDefinition = createProofRequestOptions.presentationDefinition

    // For now we always use the VP_TOKEN
    const presentationDefinitionsWithLocation = presentationDefinition
      ? [{ definition: presentationDefinition, location: PresentationDefinitionLocation.CLAIMS_VP_TOKEN }]
      : undefined

    const relyingParty = await this.getRelyingParty(agentContext, createProofRequestOptions, proofRequestMetadata)

    const response = await relyingParty.verifyAuthorizationResponse(authorizationResponsePayload, {
      audience: createProofRequestOptions.verificationMethod.id,
      correlationId,
      nonce: proofRequestMetadata.challenge,
      state: proofRequestMetadata.state,
      presentationDefinitions: presentationDefinitionsWithLocation,
      verification: {
        mode: VerificationMode.INTERNAL,
        resolveOpts: { noUniversalResolverFallback: true, resolver: getResolver(agentContext) },
      },
    })

    const idTokenPayload = await response.authorizationResponse.idToken.payload()

    return {
      idTokenPayload: idTokenPayload,
      submission: presentationDefinition ? response.oid4vpSubmission : undefined,
    }
  }

  private getPresentationVerificationCallback(
    agentContext: AgentContext,
    options: { challenge: string }
  ): PresentationVerificationCallback {
    const { challenge } = options
    return async (encodedPresentation, presentationSubmission) => {
      this.logger.debug(`Presentation response`, JsonTransformer.toJSON(encodedPresentation))
      this.logger.debug(`Presentation submission`, presentationSubmission)

      if (!encodedPresentation) throw new AriesFrameworkError('Did not receive a presentation for verification.')

      let verificationResult: W3cVerifyPresentationResult
      if (typeof encodedPresentation === 'string') {
        verificationResult = await this.w3cCredentialService.verifyPresentation(agentContext, {
          presentation: encodedPresentation,
          challenge,
        })
      } else {
        verificationResult = await this.w3cCredentialService.verifyPresentation(agentContext, {
          presentation: JsonTransformer.fromJSON(encodedPresentation, W3cJsonLdVerifiablePresentation),
          challenge,
        })
      }

      return { verified: verificationResult.isValid }
    }
  }

  public configureRouter = (
    initializationContext: AgentContext,
    router: Router,
    endpointConfig: VerifierEndpointConfig
  ) => {
    const { basePath } = endpointConfig
    this.openId4VcVerifierModuleConfig.setBasePath(initializationContext, basePath)

    // parse application/x-www-form-urlencoded
    router.use(bodyParser.urlencoded({ extended: false }))

    // parse application/json
    router.use(bodyParser.json())

    // initialize the agent and set the request context
    router.use(async (req: VerificationRequest, _res: Response, next: NextFunction) => {
      const agentContext = await initializeAgentFromContext(
        initializationContext.contextCorrelationId,
        this.agentContextProvider
      )

      req.requestContext = {
        agentContext,
        openId4VcVerifierService: agentContext.dependencyManager.resolve(OpenId4VcVerifierService),
        logger: agentContext.dependencyManager.resolve(InjectionSymbols.Logger),
      }

      next()
    })

    if (endpointConfig.verificationEndpointConfig?.enabled) {
      const verificationEndpointPath = this.verifierMetadata.verificationEndpointPath
      configureVerificationEndpoint(router, verificationEndpointPath, {
        ...endpointConfig.verificationEndpointConfig,
      })

      const endPointUrl = getEndpointUrl(this.verifierMetadata.verifierBaseUrl, basePath, verificationEndpointPath)
      this.logger.info(`[OID4VP] Verification endpoint running at '${endPointUrl}'.`)
    }

    router.use(async (req: VerificationRequest, _res, next) => {
      const { agentContext } = getRequestContext(req)
      await agentContext.endSession()
      next()
    })

    return router
  }
}
