import type {
  OpenId4VcAuthorizationRequestWithMetadata,
  OpenId4VcCreateAuthorizationRequestOptions,
  OpenId4VcAuthorizationRequestMetadata,
  VerifiedOpenId4VcAuthorizationResponse,
  HolderMetadata,
  OpenId4VcVerifyAuthorizationResponseOptions,
} from './OpenId4VcVerifierServiceOptions'
import type { AgentContext, W3cVerifyPresentationResult } from '@aries-framework/core'
import type { PresentationVerificationCallback, SigningAlgo } from '@sphereon/did-auth-siop'

import {
  utils,
  joinUriParts,
  InjectionSymbols,
  Logger,
  W3cCredentialService,
  inject,
  injectable,
  AriesFrameworkError,
  W3cJsonLdVerifiablePresentation,
  JsonTransformer,
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

import { storeActorIdForContextCorrelationId } from '../shared/router'
import { getVerifiablePresentationFromSphereonWrapped } from '../shared/transform'
import {
  getSupportedDidMethods,
  getSuppliedSignatureFromVerificationMethod,
  getResolver,
  getSupportedJwaSignatureAlgorithms,
} from '../shared/utils'

import { OpenId4VcVerifierModuleConfig } from './OpenId4VcVerifierModuleConfig'
import { OpenId4VcVerifierRecord, OpenId4VcVerifierRepository } from './repository'
import { openidStaticOpConfiguration, siopv2StaticOpConfiguration } from './staticOpConfiguration'

/**
 * @internal
 */
@injectable()
export class OpenId4VcVerifierService {
  public constructor(
    @inject(InjectionSymbols.Logger) private logger: Logger,
    private w3cCredentialService: W3cCredentialService,
    private openId4VcVerifierRepository: OpenId4VcVerifierRepository,
    private config: OpenId4VcVerifierModuleConfig
  ) {}

  public async createAuthorizationRequest(
    agentContext: AgentContext,
    options: OpenId4VcCreateAuthorizationRequestOptions & { verifier: OpenId4VcVerifierRecord }
  ): Promise<OpenId4VcAuthorizationRequestWithMetadata> {
    const nonce = await agentContext.wallet.generateNonce()
    const state = await agentContext.wallet.generateNonce()
    const correlationId = utils.uuid()

    const relyingParty = await this.getRelyingParty(agentContext, options.verifier, options)
    const authorizationRequest = await relyingParty.createAuthorizationRequest({
      correlationId,
      nonce,
      state,
    })

    const authorizationRequestUri = await authorizationRequest.uri()
    const encodedAuthorizationRequestUri = authorizationRequestUri.encodedUri

    const metadata = {
      nonce,
      correlationId,
      state,
    }

    // FIXME: we need to store some state here?
    // Why is the sphereon session manage not enough?
    await this.config.getSessionManager(agentContext).saveVerifyProofResponseOptions(correlationId, {
      createProofRequestOptions: options,
      proofRequestMetadata: metadata,
    })

    return {
      authorizationRequestUri: encodedAuthorizationRequestUri,
      metadata,
    }
  }

  public async verifyAuthorizationResponse(
    agentContext: AgentContext,
    options: OpenId4VcVerifyAuthorizationResponseOptions & { verifier: OpenId4VcVerifierRecord }
  ): Promise<VerifiedOpenId4VcAuthorizationResponse> {
    const authorizationResponse = await AuthorizationResponse.fromPayload(options.authorizationResponse).catch(() => {
      throw new AriesFrameworkError(
        `Unable to parse authorization response payload. ${JSON.stringify(options.authorizationResponse)}`
      )
    })

    // FIXME: we need to rework the custom verification state stuff
    const resNonce = await authorizationResponse.getMergedProperty<string>('nonce', false)
    const resState = await authorizationResponse.getMergedProperty<string>('state', false)
    const sessionManager = this.config.getSessionManager(agentContext)

    const correlationId = resNonce
      ? await sessionManager.getCorrelationIdByNonce(resNonce, false)
      : resState
      ? await sessionManager.getCorrelationIdByState(resState, false)
      : undefined

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

    const relyingParty = await this.getRelyingParty(
      agentContext,
      options.verifier,
      createProofRequestOptions,
      proofRequestMetadata
    )

    const response = await relyingParty.verifyAuthorizationResponse(authorizationResponse.payload, {
      // FIXME: can be extracted from iss of request?
      audience: createProofRequestOptions.verificationMethod.id,
      correlationId,
      // FIXME: can be extracted from request?
      nonce: proofRequestMetadata.nonce,
      // FIXME: can be extracted from request?
      state: proofRequestMetadata.state,
      presentationDefinitions: presentationDefinitionsWithLocation,
      // FIXME: does this verify the VP as well? Or just the id_token and the vp_token submission,
      // but not the actual signature on the VP?
      // -> I think it uses the presentation verification callback
      verification: {
        mode: VerificationMode.INTERNAL,
        resolveOpts: { noUniversalResolverFallback: true, resolver: getResolver(agentContext) },
      },
    })

    const presentationExchange = response.oid4vpSubmission
      ? {
          submission: response.oid4vpSubmission?.submissionData,
          definitions: response.oid4vpSubmission?.presentationDefinitions.map((d) => d.definition),
          presentations: response.oid4vpSubmission?.presentations.map(getVerifiablePresentationFromSphereonWrapped),
        }
      : undefined

    return {
      // FIXME: rename and only extract needed payload, don't want sphereon types to be exposed on AFJ layer
      idTokenPayload: await response.authorizationResponse.idToken.payload(),

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

  public async createVerifier(agentContext: AgentContext) {
    const openId4VcVerifier = new OpenId4VcVerifierRecord({
      verifierId: utils.uuid(),
    })

    await this.openId4VcVerifierRepository.save(agentContext, openId4VcVerifier)
    await storeActorIdForContextCorrelationId(agentContext, openId4VcVerifier.verifierId)
    return openId4VcVerifier
  }

  private async getRelyingParty(
    agentContext: AgentContext,
    verifier: OpenId4VcVerifierRecord,
    createAuthorizationRequestOptions: OpenId4VcCreateAuthorizationRequestOptions,
    proofRequestMetadata?: OpenId4VcAuthorizationRequestMetadata
  ) {
    const { verificationEndpointUrl, presentationDefinition, verificationMethod } = createAuthorizationRequestOptions

    const isVpRequest = presentationDefinition !== undefined
    const openIdConfiguration = this.getOpenIdConfiguration(createAuthorizationRequestOptions)

    const { signature, did, kid, alg } = await getSuppliedSignatureFromVerificationMethod(
      agentContext,
      verificationMethod
    )

    // Check if the OpenId Provider can validate the request signature provided by the Relying Party
    const requestObjectSigningAlgValuesSupported = openIdConfiguration.requestObjectSigningAlgValuesSupported
    if (requestObjectSigningAlgValuesSupported && !requestObjectSigningAlgValuesSupported.includes(alg)) {
      throw new AriesFrameworkError(
        [
          `Cannot sign authorization request with '${alg}' that isn't supported by the OpenId Provider.`,
          `Supported algorithms are ${requestObjectSigningAlgValuesSupported}`,
        ].join('\n')
      )
    }

    // Check if the Relying Party (Verifier) can validate the IdToken provided by the OpenId Provider (Holder)
    // FIXME: This might cause issues as the static configuration is very limited and thus it would
    // prevent any new algorithms from being used.
    const idTokenSigningAlgValuesSupported = openIdConfiguration.idTokenSigningAlgValuesSupported
    if (idTokenSigningAlgValuesSupported) {
      const rpSupportedSignatureAlgorithms = getSupportedJwaSignatureAlgorithms(
        agentContext
      ) as unknown as SigningAlgo[]

      const possibleIdTokenSigningAlgValue = Array.isArray(idTokenSigningAlgValuesSupported)
        ? idTokenSigningAlgValuesSupported.some((value) => rpSupportedSignatureAlgorithms.includes(value))
        : rpSupportedSignatureAlgorithms.includes(idTokenSigningAlgValuesSupported)

      if (!possibleIdTokenSigningAlgValue) {
        throw new AriesFrameworkError(
          [
            `The OpenId Provider supports no signature algorithms that are supported by the Relying Party.`,
            `Relying Party supported algorithms are ${rpSupportedSignatureAlgorithms}.`,
            `OpenId Provider supported algorithms are ${idTokenSigningAlgValuesSupported}.`,
          ].join('\n')
        )
      }
    }

    // FIXME: what do we call this? RP url? There should be an openid name for it
    const relyingPartyUrl = joinUriParts(this.config.baseUrl, [verifier.verifierId])
    // FIXME: is it authorization endpoint? What do you call the endpoint where you
    // submit the authorization response to?
    const redirectUri =
      verificationEndpointUrl ?? joinUriParts(relyingPartyUrl, [this.config.authorizationEndpoint.endpointPath])

    // Check: audience must be set to the issuer with dynamic disc otherwise self-issued.me/v2.
    const builder = RP.builder()
      .withClientId(verificationMethod.id)
      .withRedirectUri(redirectUri)
      .withIssuer(ResponseIss.SELF_ISSUED_V2)
      .withSuppliedSignature(signature, did, kid, alg)
      .withSupportedVersions([SupportedVersion.SIOPv2_D11, SupportedVersion.SIOPv2_D12_OID4VP_D18])
      // FIXME: client metadata is the metadata of the RP
      // but it's being added as OP metadata
      // Is this both OP and Client metadata?
      // RP = Client = verifier
      // OP = holder
      .withClientMetadata(holderMetadata)
      .withCustomResolver(getResolver(agentContext))
      .withResponseMode(ResponseMode.POST)
      .withResponseType(isVpRequest ? [ResponseType.ID_TOKEN, ResponseType.VP_TOKEN] : ResponseType.ID_TOKEN)
      .withScope('openid')
      .withRequestBy(PassBy.VALUE)
      .withCheckLinkedDomain(CheckLinkedDomain.NEVER)
      // FIXME: should allow verification of revocation
      // .withRevocationVerificationCallback()
      .withRevocationVerification(RevocationVerification.NEVER)
      .withSessionManager(this.config.getSessionManager(agentContext))
      .withEventEmitter(this.config.getEventEmitter(agentContext))

    if (openIdConfiguration.authorization_endpoint) {
      builder.withAuthorizationEndpoint(openIdConfiguration.authorization_endpoint)
    }

    // FIXME: we don't want to pass proof request metadata
    // Maybe we can just return the builder, and add it in the caller method?
    // Or we somehow dynamically get the nonce from the request?
    if (proofRequestMetadata) {
      builder.withPresentationVerification(
        this.getPresentationVerificationCallback(agentContext, { challenge: proofRequestMetadata.nonce })
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

  // FIXME: does the higher level check whether the iss of the VP is ok?
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

  private getOpenIdConfiguration(options: OpenId4VcCreateAuthorizationRequestOptions): HolderMetadata {
    const isVpRequest = options.presentationDefinition !== undefined

    // Not provided, use default static configurations
    if (!options.openIdProvider) {
      return isVpRequest ? openidStaticOpConfiguration : siopv2StaticOpConfiguration
    }

    // siopv2: provided or not provided and not vp request
    if (options.openIdProvider === 'siopv2:') {
      if (isVpRequest) {
        throw new AriesFrameworkError(
          "Cannot use 'siopv2:' as OP configuration when a presentation definition is provided. Use 'openid:' instead."
        )
      }
      return siopv2StaticOpConfiguration
    }

    // openid: provided or not provided and vp request
    if (options.openIdProvider === 'openid:') {
      return openidStaticOpConfiguration
    }

    // if string it MUST be an url
    if (typeof options.openIdProvider === 'string') {
      // TODO: add url validation
      const referenceUri = options.openIdProvider.includes('/.well-known/openid-configuration')
        ? options.openIdProvider
        : joinUriParts(options.openIdProvider, ['/.well-known/openid-configuration'])

      return {
        reference_uri: referenceUri,
        passBy: PassBy.REFERENCE,
        targets: PropertyTarget.REQUEST_OBJECT,
      }
    }

    return options.openIdProvider
  }
}
