import type {
  VerifyProofResponseOptions,
  ProofRequestWithMetadata,
  CreateProofRequestOptions,
  ProofRequestMetadata,
  VerifiedProofResponse,
} from './OpenId4VcVerifierServiceOptions'
import type { AgentContext, W3cVerifyPresentationResult } from '@aries-framework/core'
import type {
  AuthorizationResponsePayload,
  ClientMetadataOpts,
  PresentationDefinitionWithLocation,
  PresentationVerificationCallback,
  SigningAlgo,
} from '@sphereon/did-auth-siop'

import {
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
} from '@sphereon/did-auth-siop'

import { staticOpOpenIdConfig, staticOpSiopConfig } from './OpenId4VcVerifierServiceOptions'
import {
  getSupportedDidMethods,
  getSuppliedSignatureFromVerificationMethod,
  getResolver,
  getSupportedJwaSignatureAlgorithms,
} from './shared'

/**
 * @internal
 */
@injectable()
export class OpenId4VcVerifierService {
  private logger: Logger
  private w3cCredentialService: W3cCredentialService

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger, w3cCredentialService: W3cCredentialService) {
    this.w3cCredentialService = w3cCredentialService
    this.logger = logger
  }

  public async getRelyingParty(
    agentContext: AgentContext,
    createProofRequestOptions: CreateProofRequestOptions,
    proofRequestMetadata?: ProofRequestMetadata
  ) {
    const {
      issuer,
      redirectUri,
      presentationDefinition,
      verificationMethod,
      holderClientMetadata: _holderClientMetadata,
    } = createProofRequestOptions

    const isVpRequest = presentationDefinition !== undefined

    let holderClientMetadata: ClientMetadataOpts
    if (_holderClientMetadata) {
      // use the provided client metadata
      holderClientMetadata = _holderClientMetadata
    } else if (issuer) {
      // Use OpenId Discovery to get the client metadata
      let reference_uri = issuer
      if (!issuer.endsWith('/.well-known/openid-configuration')) {
        reference_uri = issuer + '/.well-known/openid-configuration'
      }
      holderClientMetadata = { reference_uri, passBy: PassBy.REFERENCE, targets: PropertyTarget.REQUEST_OBJECT }
    } else if (isVpRequest) {
      // if neither clientMetadata nor issuer is provided, use a static config
      holderClientMetadata = staticOpOpenIdConfig
    } else {
      // if neither clientMetadata nor issuer is provided, use a static config
      holderClientMetadata = staticOpSiopConfig
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
    const rpSupportedSignatureAlgorithms = getSupportedJwaSignatureAlgorithms(agentContext) as unknown as SigningAlgo[]

    if (idTokenSigningAlgValuesSupported) {
      const possibleIdTokenSigningAlgValues = Array.isArray(idTokenSigningAlgValuesSupported)
        ? idTokenSigningAlgValuesSupported.filter((value) => rpSupportedSignatureAlgorithms.includes(value))
        : [idTokenSigningAlgValuesSupported].filter((value) => rpSupportedSignatureAlgorithms.includes(value))

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

    const authorizationEndpoint = holderClientMetadata.authorization_endpoint ?? isVpRequest ? 'openid:' : 'siopv2:'

    // Check: audience must be set to the issuer with dynamic disc otherwise self-issed.me/v2.
    const builder = RP.builder()
      .withClientId(verificationMethod.id)
      .withRedirectUri(redirectUri)
      .withRequestByValue()
      .withIssuer(ResponseIss.SELF_ISSUED_V2)
      .withSuppliedSignature(signature, did, kid, alg)
      .withSupportedVersions([SupportedVersion.SIOPv2_D11, SupportedVersion.SIOPv2_D12_OID4VP_D18])
      .withClientMetadata(holderClientMetadata)
      .withCustomResolver(getResolver(agentContext))
      .withResponseMode(ResponseMode.POST)
      .withResponseType(isVpRequest ? [ResponseType.ID_TOKEN, ResponseType.VP_TOKEN] : ResponseType.ID_TOKEN)
      .withRequestBy(PassBy.VALUE)
      .withAuthorizationEndpoint(authorizationEndpoint)
      .withCheckLinkedDomain(CheckLinkedDomain.NEVER) // check
      .withRevocationVerification(RevocationVerification.NEVER)
    // .withWellknownDIDVerifyCallback
    // .withEventEmitter
    // .withSessionManager // For now we use no session manager

    if (proofRequestMetadata) {
      builder.withPresentationVerification(
        this.handlePresentationResponse(agentContext, { challenge: proofRequestMetadata.challenge })
      )
    }

    if (presentationDefinition) {
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

    const relyingParty = await this.getRelyingParty(agentContext, { ...options })

    const authorizationRequest = await relyingParty.createAuthorizationRequest({
      correlationId,
      nonce: challenge,
      state,
    })

    const authorizationRequestUri = await authorizationRequest.uri()
    const encodedAuthorizationRequestUri = authorizationRequestUri.encodedUri

    return {
      proofRequest: encodedAuthorizationRequestUri,
      proofRequestMetadata: {
        correlationId,
        challenge,
        state,
      },
    }
  }

  public async verifyProofResponse(
    agentContext: AgentContext,
    authorizationResponsePayload: AuthorizationResponsePayload,
    options: VerifyProofResponseOptions
  ): Promise<VerifiedProofResponse> {
    const { createProofRequestOptions, proofRequestMetadata } = options
    const { state, challenge, correlationId } = proofRequestMetadata

    const relyingParty = await this.getRelyingParty(agentContext, createProofRequestOptions, proofRequestMetadata)

    const presentationDefinition = createProofRequestOptions.presentationDefinition

    let presentationDefinitionsWithLocation: [PresentationDefinitionWithLocation] | undefined
    if (presentationDefinition) {
      presentationDefinitionsWithLocation = [
        {
          definition: presentationDefinition,
          location: PresentationDefinitionLocation.CLAIMS_VP_TOKEN, // For now we always use the VP_TOKEN
        },
      ]
    }

    const response = await relyingParty.verifyAuthorizationResponse(authorizationResponsePayload, {
      audience: createProofRequestOptions.verificationMethod.id,
      correlationId,
      nonce: challenge,
      state,
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

  private handlePresentationResponse(
    agentContext: AgentContext,
    options: { challenge: string }
  ): PresentationVerificationCallback {
    const { challenge } = options
    return async (encodedPresentation, presentationSubmission) => {
      this.logger.debug(`Presentation response '${encodedPresentation}'`)
      this.logger.debug(`Presentation submission `, presentationSubmission)

      if (!encodedPresentation) {
        throw new AriesFrameworkError('Did not receive a presentation for verification')
      }

      let verificationResult: W3cVerifyPresentationResult
      if (typeof encodedPresentation === 'string') {
        // the presentation is in jwt format (automatically converted to W3cJwtVerifiablePresentation)
        const presentation = encodedPresentation
        verificationResult = await this.w3cCredentialService.verifyPresentation(agentContext, {
          presentation: presentation,
          challenge,
        })
      } else {
        const presentation = JsonTransformer.fromJSON(encodedPresentation, W3cJsonLdVerifiablePresentation)
        verificationResult = await this.w3cCredentialService.verifyPresentation(agentContext, {
          presentation: presentation,
          challenge,
        })
      }

      return { verified: verificationResult.isValid }
    }
  }
}

async function generateRandomValues(agentContext: AgentContext, count: number) {
  const randomValuesPromises = Array.from({ length: count }, () => agentContext.wallet.generateNonce())
  return await Promise.all(randomValuesPromises)
}
