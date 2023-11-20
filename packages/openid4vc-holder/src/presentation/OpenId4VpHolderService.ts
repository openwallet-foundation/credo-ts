import type {
  AuthenticationRequest,
  PresentationRequest,
  ProofSubmissionResponse,
  ResolvedProofRequest,
} from './OpenId4VpHolderServiceOptions'
import type { PresentationSubmission } from './selection'
import type { InputDescriptorToCredentials } from './selection/types'
import type { AgentContext, VerificationMethod, W3cVerifiablePresentation } from '@aries-framework/core'
import type { VerifiedAuthorizationRequest } from '@sphereon/did-auth-siop'
import type { W3CVerifiablePresentation } from '@sphereon/ssi-types'

import {
  AriesFrameworkError,
  DidsApi,
  injectable,
  W3cJsonLdVerifiablePresentation,
  asArray,
  inject,
  InjectionSymbols,
  Logger,
  parseDid,
} from '@aries-framework/core'
import {
  CheckLinkedDomain,
  OP,
  ResponseIss,
  ResponseMode,
  SupportedVersion,
  VPTokenLocation,
  VerificationMode,
} from '@sphereon/did-auth-siop'

import { getResolver, getSuppliedSignatureFromVerificationMethod, getSupportedDidMethods } from '../shared'

import { PresentationExchangeService } from './PresentationExchangeService'

function isVerifiedAuthorizationRequestWithPresentationDefinition(
  request: VerifiedAuthorizationRequest
): request is PresentationRequest {
  return (
    request.presentationDefinitions !== undefined &&
    request.presentationDefinitions.length === 1 &&
    request.presentationDefinitions?.[0]?.definition !== undefined
  )
}

@injectable()
export class OpenId4VpHolderService {
  private logger: Logger
  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    private presentationExchangeService: PresentationExchangeService
  ) {
    this.logger = logger
  }

  private async getOpenIdProvider(
    agentContext: AgentContext,
    options: {
      verificationMethod?: VerificationMethod
    }
  ) {
    const { verificationMethod } = options

    const builder = OP.builder()
      .withExpiresIn(6000)
      .withIssuer(ResponseIss.SELF_ISSUED_V2)
      .withResponseMode(ResponseMode.POST)
      .withSupportedVersions([SupportedVersion.SIOPv2_D11, SupportedVersion.SIOPv2_D12_OID4VP_D18])
      .withCustomResolver(getResolver(agentContext))
      .withCheckLinkedDomain(CheckLinkedDomain.NEVER)
    // .withPresentationSignCallback
    // .withEventEmitter
    // .withRegistration()

    if (verificationMethod) {
      const { signature, did, kid, alg } = await getSuppliedSignatureFromVerificationMethod(
        agentContext,
        verificationMethod
      )

      builder.withSuppliedSignature(signature, did, kid, alg)
    }

    // Add did methods
    const supportedDidMethods = getSupportedDidMethods(agentContext)
    for (const supportedDidMethod of supportedDidMethods) {
      builder.addDidMethod(supportedDidMethod)
    }

    const openidProvider = builder.build()

    return openidProvider
  }

  public async resolveProofRequest(agentContext: AgentContext, requestJwtOrUri: string): Promise<ResolvedProofRequest> {
    const openidProvider = await this.getOpenIdProvider(agentContext, {})

    // parsing happens automatically in verifyAuthorizationRequest
    const verifiedAuthorizationRequest = await openidProvider.verifyAuthorizationRequest(requestJwtOrUri, {
      verification: {
        mode: VerificationMode.INTERNAL,
        resolveOpts: { resolver: getResolver(agentContext), noUniversalResolverFallback: true },
      },
    })

    this.logger.debug(`verified SIOP Authorization Request for issuer '${verifiedAuthorizationRequest.issuer}'`)
    this.logger.debug(`requestJwtOrUri '${requestJwtOrUri}'`)

    // If the presentationDefinitions array property is present it means the op.verifyAuthorizationRequest
    // already has established that the Presentation Definition(s) itself were valid and present.
    // It has populated the presentationDefinitions array for you.
    // If the definition was not valid, the verify method would have thrown an error,
    // which means you should never continue the authentication flow!
    const presentationDefs = verifiedAuthorizationRequest.presentationDefinitions
    if (!presentationDefs || presentationDefs.length === 0) {
      return { proofType: 'authentication', request: verifiedAuthorizationRequest }
    }

    // FIXME: I don't see any reason why we would support multiple presentation definitions
    // but the library does support it. For now we only support a single presentation definition.
    if (!isVerifiedAuthorizationRequestWithPresentationDefinition(verifiedAuthorizationRequest)) {
      throw new AriesFrameworkError(
        'Only SIOPv2 authorization request including a single presentation definition are supported.'
      )
    }

    const presentationDefinition = verifiedAuthorizationRequest.presentationDefinitions[0].definition

    const presentationSubmission = await this.presentationExchangeService.selectCredentialsForRequest(
      agentContext,
      presentationDefinition
    )

    return { proofType: 'presentation', request: verifiedAuthorizationRequest, presentationSubmission }
  }

  /**
   * Send a SIOPv2 authentication response to the relying party including a verifiable
   * presentation based on OpenID4VP.
   */
  public async acceptAuthenticationRequest(
    agentContext: AgentContext,
    verificationMethod: VerificationMethod,
    authenticationRequest: AuthenticationRequest
  ): Promise<ProofSubmissionResponse> {
    const openidProvider = await this.getOpenIdProvider(agentContext, { verificationMethod })

    // TODO: jwk support
    const subjectSyntaxTypesSupported = authenticationRequest.registrationMetadataPayload.subject_syntax_types_supported
    if (subjectSyntaxTypesSupported) {
      const { method } = parseDid(verificationMethod.id)
      if (subjectSyntaxTypesSupported.includes(`did:${method}`) === false) {
        throw new AriesFrameworkError(
          [
            'The provided verification method is not supported by the issuer.',
            `Supported subject syntax types: '${subjectSyntaxTypesSupported.join(', ')}'`,
          ].join('\n')
        )
      }
    }

    const suppliedSignature = await getSuppliedSignatureFromVerificationMethod(agentContext, verificationMethod)

    const authorizationResponseWithCorrelationId = await openidProvider.createAuthorizationResponse(
      authenticationRequest,
      {
        signature: suppliedSignature,
        issuer: verificationMethod.controller,
        verification: {
          resolveOpts: { resolver: getResolver(agentContext), noUniversalResolverFallback: true },
          mode: VerificationMode.INTERNAL,
        },
        // https://openid.net/specs/openid-connect-self-issued-v2-1_0.html#name-aud-of-a-request-object
        audience: authenticationRequest.authorizationRequestPayload.client_id,
      }
    )

    const response = await openidProvider.submitAuthorizationResponse(authorizationResponseWithCorrelationId)
    return {
      ok: response.status === 200,
      status: response.status,
      submittedResponse: authorizationResponseWithCorrelationId.response.payload,
    }
  }

  /**
   * Send a SIOPv2 authentication response to the relying party including a verifiable
   * presentation based on OpenID4VP.
   */
  public async acceptProofRequest(
    agentContext: AgentContext,
    presentationRequest: PresentationRequest,
    options: {
      submission: PresentationSubmission
      submissionEntryIndexes: number[]
    }
  ): Promise<ProofSubmissionResponse> {
    const { submission, submissionEntryIndexes } = options

    const credentialsForInputDescriptor: InputDescriptorToCredentials = {}

    submission.requirements
      .flatMap((requirement) => requirement.submissionEntry)
      .forEach((submissionEntry, index) => {
        const verifiableCredential = submissionEntry.verifiableCredentials[submissionEntryIndexes[index]]

        const inputDescriptor = credentialsForInputDescriptor[submissionEntry.inputDescriptorId]
        if (!inputDescriptor) {
          credentialsForInputDescriptor[submissionEntry.inputDescriptorId] = [verifiableCredential.credential]
        } else {
          inputDescriptor.push(verifiableCredential.credential)
        }
      })

    const { verifiablePresentations, presentationSubmission } =
      await this.presentationExchangeService.createPresentation(agentContext, {
        credentialsForInputDescriptor,
        presentationDefinition: presentationRequest.presentationDefinitions[0].definition,
        nonce: await presentationRequest.authorizationRequest.getMergedProperty<string>('nonce'),
      })

    const verificationMethod = await this.getVerificationMethodFromVerifiablePresentation(
      agentContext,
      verifiablePresentations[0] as W3cVerifiablePresentation
    )

    const openidProvider = await this.getOpenIdProvider(agentContext, { verificationMethod })

    const suppliedSignature = await getSuppliedSignatureFromVerificationMethod(agentContext, verificationMethod)

    const authorizationResponseWithCorrelationId = await openidProvider.createAuthorizationResponse(
      presentationRequest,
      {
        signature: suppliedSignature,
        issuer: verificationMethod.controller,
        // https://openid.net/specs/openid-connect-self-issued-v2-1_0.html#name-aud-of-a-request-object
        audience: presentationRequest.authorizationRequestPayload.client_id,

        presentationExchange: {
          verifiablePresentations: verifiablePresentations.map((vp) => vp.encoded as W3CVerifiablePresentation),
          presentationSubmission,
          vpTokenLocation: VPTokenLocation.AUTHORIZATION_RESPONSE,
        },
      }
    )

    const response = await openidProvider.submitAuthorizationResponse(authorizationResponseWithCorrelationId)
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      submittedResponse: authorizationResponseWithCorrelationId.response.payload,
    }
  }

  private async getVerificationMethodFromVerifiablePresentation(
    agentContext: AgentContext,
    verifiablePresentation: W3cVerifiablePresentation
  ) {
    const didsApi = agentContext.dependencyManager.resolve(DidsApi)

    let verificationMethodId: string
    if (verifiablePresentation instanceof W3cJsonLdVerifiablePresentation) {
      const [firstProof] = asArray(verifiablePresentation.proof)
      if (!firstProof) throw new AriesFrameworkError('Verifiable presentation does not contain a proof')

      verificationMethodId = firstProof.verificationMethod
    } else {
      const kid = verifiablePresentation.jwt.header.kid
      if (!kid) throw new AriesFrameworkError('Verifiable Presentation does not contain a kid in the jwt header')
      verificationMethodId = kid
    }

    const didDocument = await didsApi.resolveDidDocument(verificationMethodId)
    return didDocument.dereferenceKey(verificationMethodId, ['authentication'])
  }
}
