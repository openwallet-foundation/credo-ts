import type {
  OpenId4VcSiopCreateAuthorizationRequestOptions,
  OpenId4VcSiopCreateAuthorizationRequestReturn,
  OpenId4VcSiopCreateVerifierOptions,
  OpenId4VcSiopVerifiedAuthorizationResponse,
  OpenId4VcSiopVerifyAuthorizationResponseOptions,
} from './OpenId4VcSiopVerifierServiceOptions'
import type { OpenId4VcJwtIssuer } from '../shared'
import type { AgentContext, DifPresentationExchangeDefinition } from '@credo-ts/core'
import type { PresentationVerificationCallback, SigningAlgo } from '@sphereon/did-auth-siop'

import {
  CredoError,
  inject,
  injectable,
  InjectionSymbols,
  joinUriParts,
  JsonTransformer,
  Logger,
  SdJwtVcApi,
  SignatureSuiteRegistry,
  utils,
  W3cCredentialService,
  W3cJsonLdVerifiablePresentation,
  Hasher,
  DidsApi,
} from '@credo-ts/core'
import {
  AuthorizationResponse,
  CheckLinkedDomain,
  PassBy,
  PropertyTarget,
  ResponseIss,
  ResponseMode,
  ResponseType,
  RevocationVerification,
  RP,
  SupportedVersion,
  VerificationMode,
} from '@sphereon/did-auth-siop'

import { storeActorIdForContextCorrelationId } from '../shared/router'
import { getVerifiablePresentationFromSphereonWrapped } from '../shared/transform'
import {
  getSphereonDidResolver,
  getSphereonSuppliedSignatureFromJwtIssuer,
  getSupportedJwaSignatureAlgorithms,
} from '../shared/utils'

import { OpenId4VcVerifierModuleConfig } from './OpenId4VcVerifierModuleConfig'
import { OpenId4VcVerifierRecord, OpenId4VcVerifierRepository } from './repository'

/**
 * @internal
 */
@injectable()
export class OpenId4VcSiopVerifierService {
  public constructor(
    @inject(InjectionSymbols.Logger) private logger: Logger,
    private w3cCredentialService: W3cCredentialService,
    private openId4VcVerifierRepository: OpenId4VcVerifierRepository,
    private config: OpenId4VcVerifierModuleConfig
  ) {}

  public async createAuthorizationRequest(
    agentContext: AgentContext,
    options: OpenId4VcSiopCreateAuthorizationRequestOptions & { verifier: OpenId4VcVerifierRecord }
  ): Promise<OpenId4VcSiopCreateAuthorizationRequestReturn> {
    const nonce = await agentContext.wallet.generateNonce()
    const state = await agentContext.wallet.generateNonce()
    const correlationId = utils.uuid()

    const relyingParty = await this.getRelyingParty(agentContext, options.verifier, {
      presentationDefinition: options.presentationExchange?.definition,
      requestSigner: options.requestSigner,
    })

    const authorizationRequest = await relyingParty.createAuthorizationRequest({
      correlationId,
      nonce,
      state,
    })

    const authorizationRequestUri = await authorizationRequest.uri()

    return {
      authorizationRequestUri: authorizationRequestUri.encodedUri,
      authorizationRequestPayload: authorizationRequest.payload,
    }
  }

  public async verifyAuthorizationResponse(
    agentContext: AgentContext,
    options: OpenId4VcSiopVerifyAuthorizationResponseOptions & { verifier: OpenId4VcVerifierRecord }
  ): Promise<OpenId4VcSiopVerifiedAuthorizationResponse> {
    const authorizationResponse = await AuthorizationResponse.fromPayload(options.authorizationResponse).catch(() => {
      throw new CredoError(
        `Unable to parse authorization response payload. ${JSON.stringify(options.authorizationResponse)}`
      )
    })

    const responseNonce = await authorizationResponse.getMergedProperty<string>('nonce', {
      hasher: Hasher.hash,
    })
    const responseState = await authorizationResponse.getMergedProperty<string>('state', {
      hasher: Hasher.hash,
    })
    const sessionManager = this.config.getSessionManager(agentContext)

    const correlationId = responseNonce
      ? await sessionManager.getCorrelationIdByNonce(responseNonce, false)
      : responseState
      ? await sessionManager.getCorrelationIdByState(responseState, false)
      : undefined

    if (!correlationId) {
      throw new CredoError(`Unable to find correlationId for nonce '${responseNonce}' or state '${responseState}'`)
    }

    const requestSessionState = await sessionManager.getRequestStateByCorrelationId(correlationId)
    if (!requestSessionState) {
      throw new CredoError(`Unable to find request state for correlationId '${correlationId}'`)
    }

    const requestClientId = await requestSessionState.request.getMergedProperty<string>('client_id')
    const requestNonce = await requestSessionState.request.getMergedProperty<string>('nonce')
    const requestState = await requestSessionState.request.getMergedProperty<string>('state')
    const presentationDefinitionsWithLocation = await requestSessionState.request.getPresentationDefinitions()

    if (!requestNonce || !requestClientId || !requestState) {
      throw new CredoError(
        `Unable to find nonce, state, or client_id in authorization request for correlationId '${correlationId}'`
      )
    }

    const relyingParty = await this.getRelyingParty(agentContext, options.verifier, {
      presentationDefinition: presentationDefinitionsWithLocation?.[0]?.definition,
      clientId: requestClientId,
    })

    const response = await relyingParty.verifyAuthorizationResponse(authorizationResponse.payload, {
      audience: requestClientId,
      correlationId,
      state: requestState,
      presentationDefinitions: presentationDefinitionsWithLocation,
      verification: {
        presentationVerificationCallback: this.getPresentationVerificationCallback(agentContext, {
          nonce: requestNonce,
          audience: requestClientId,
        }),
        // FIXME: Supplied mode is not implemented.
        // See https://github.com/Sphereon-Opensource/SIOP-OID4VP/issues/55
        mode: VerificationMode.INTERNAL,
        resolveOpts: { noUniversalResolverFallback: true, resolver: getSphereonDidResolver(agentContext) },
      },
    })

    const presentationExchange = response.oid4vpSubmission?.submissionData
      ? {
          submission: response.oid4vpSubmission.submissionData,
          definition: response.oid4vpSubmission.presentationDefinitions[0]?.definition,
          presentations: response.oid4vpSubmission?.presentations.map(getVerifiablePresentationFromSphereonWrapped),
        }
      : undefined

    const idToken = response.authorizationResponse.idToken
      ? {
          payload: await response.authorizationResponse.idToken.payload(),
        }
      : undefined

    // TODO: do we need to verify whether idToken or vpToken is present?
    // Or is that properly handled by sphereon's library?
    return {
      // Parameters related to ID Token.
      idToken,

      // Parameters related to DIF Presentation Exchange
      presentationExchange,
    }
  }

  public async getAllVerifiers(agentContext: AgentContext) {
    return this.openId4VcVerifierRepository.getAll(agentContext)
  }

  public async getByVerifierId(agentContext: AgentContext, verifierId: string) {
    return this.openId4VcVerifierRepository.getByVerifierId(agentContext, verifierId)
  }

  public async updateVerifier(agentContext: AgentContext, verifier: OpenId4VcVerifierRecord) {
    return this.openId4VcVerifierRepository.update(agentContext, verifier)
  }

  public async createVerifier(agentContext: AgentContext, options?: OpenId4VcSiopCreateVerifierOptions) {
    const openId4VcVerifier = new OpenId4VcVerifierRecord({
      verifierId: options?.verifierId ?? utils.uuid(),
    })

    await this.openId4VcVerifierRepository.save(agentContext, openId4VcVerifier)
    await storeActorIdForContextCorrelationId(agentContext, openId4VcVerifier.verifierId)
    return openId4VcVerifier
  }

  private async getRelyingParty(
    agentContext: AgentContext,
    verifier: OpenId4VcVerifierRecord,
    {
      presentationDefinition,
      requestSigner,
      clientId,
    }: {
      presentationDefinition?: DifPresentationExchangeDefinition
      requestSigner?: OpenId4VcJwtIssuer
      clientId?: string
    }
  ) {
    const authorizationResponseUrl = joinUriParts(this.config.baseUrl, [
      verifier.verifierId,
      this.config.authorizationEndpoint.endpointPath,
    ])

    const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

    const supportedAlgs = getSupportedJwaSignatureAlgorithms(agentContext) as string[]
    const supportedProofTypes = signatureSuiteRegistry.supportedProofTypes

    // Check: audience must be set to the issuer with dynamic disc otherwise self-issued.me/v2.
    const builder = RP.builder()

    let _clientId = clientId
    if (requestSigner) {
      const suppliedSignature = await getSphereonSuppliedSignatureFromJwtIssuer(agentContext, requestSigner)
      builder.withSignature(suppliedSignature)

      _clientId = suppliedSignature.did
    }

    if (!_clientId) {
      throw new CredoError("Either 'requestSigner' or 'clientId' must be provided.")
    }

    // FIXME: we now manually remove did:peer, we should probably allow the user to configure this
    const supportedDidMethods = agentContext.dependencyManager
      .resolve(DidsApi)
      .supportedResolverMethods.filter((m) => m !== 'peer')

    builder
      .withRedirectUri(authorizationResponseUrl)
      .withIssuer(ResponseIss.SELF_ISSUED_V2)
      .withSupportedVersions([SupportedVersion.SIOPv2_D11, SupportedVersion.SIOPv2_D12_OID4VP_D18])
      // TODO: we should probably allow some dynamic values here
      .withClientMetadata({
        client_id: _clientId,
        passBy: PassBy.VALUE,
        idTokenSigningAlgValuesSupported: supportedAlgs as SigningAlgo[],
        responseTypesSupported: [ResponseType.VP_TOKEN, ResponseType.ID_TOKEN],
        subject_syntax_types_supported: supportedDidMethods.map((m) => `did:${m}`),
        vpFormatsSupported: {
          jwt_vc: {
            alg: supportedAlgs,
          },
          jwt_vc_json: {
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
            kb_jwt_alg_values: supportedAlgs,
            sd_jwt_alg_values: supportedAlgs,
          },
        },
      })
      .withCustomResolver(getSphereonDidResolver(agentContext))
      .withResponseMode(ResponseMode.POST)
      .withResponseType(presentationDefinition ? [ResponseType.ID_TOKEN, ResponseType.VP_TOKEN] : ResponseType.ID_TOKEN)
      .withScope('openid')
      .withHasher(Hasher.hash)
      // TODO: support hosting requests within AFJ and passing it by reference
      .withRequestBy(PassBy.VALUE)
      .withCheckLinkedDomain(CheckLinkedDomain.NEVER)
      // FIXME: should allow verification of revocation
      // .withRevocationVerificationCallback()
      .withRevocationVerification(RevocationVerification.NEVER)
      .withSessionManager(this.config.getSessionManager(agentContext))
      .withEventEmitter(this.config.getEventEmitter(agentContext))

    if (presentationDefinition) {
      builder.withPresentationDefinition({ definition: presentationDefinition }, [PropertyTarget.REQUEST_OBJECT])
    }

    for (const supportedDidMethod of supportedDidMethods) {
      builder.addDidMethod(supportedDidMethod)
    }

    return builder.build()
  }

  private getPresentationVerificationCallback(
    agentContext: AgentContext,
    options: { nonce: string; audience: string }
  ): PresentationVerificationCallback {
    return async (encodedPresentation, presentationSubmission) => {
      this.logger.debug(`Presentation response`, JsonTransformer.toJSON(encodedPresentation))
      this.logger.debug(`Presentation submission`, presentationSubmission)

      if (!encodedPresentation) throw new CredoError('Did not receive a presentation for verification.')

      let isValid: boolean

      // TODO: it might be better here to look at the presentation submission to know
      // If presentation includes a ~, we assume it's an SD-JWT-VC
      if (typeof encodedPresentation === 'string' && encodedPresentation.includes('~')) {
        const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)

        const verificationResult = await sdJwtVcApi.verify({
          compactSdJwtVc: encodedPresentation,
          keyBinding: {
            audience: options.audience,
            nonce: options.nonce,
          },
        })

        isValid = verificationResult.verification.isValid
      } else if (typeof encodedPresentation === 'string') {
        const verificationResult = await this.w3cCredentialService.verifyPresentation(agentContext, {
          presentation: encodedPresentation,
          challenge: options.nonce,
          domain: options.audience,
        })

        isValid = verificationResult.isValid
      } else {
        const verificationResult = await this.w3cCredentialService.verifyPresentation(agentContext, {
          presentation: JsonTransformer.fromJSON(encodedPresentation, W3cJsonLdVerifiablePresentation),
          challenge: options.nonce,
          domain: options.audience,
        })

        isValid = verificationResult.isValid
      }

      // FIXME: we throw an error here as there's a bug in sphereon library where they
      // don't check the returned 'verified' property and only catch errors thrown.
      // Once https://github.com/Sphereon-Opensource/SIOP-OID4VP/pull/70 is merged we
      // can remove this.
      if (!isValid) {
        throw new CredoError('Presentation verification failed.')
      }

      return {
        verified: isValid,
      }
    }
  }
}
