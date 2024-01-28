import type {
  OpenId4VcSiopAcceptAuthorizationRequestOptions,
  OpenId4VcSiopResolvedAuthorizationRequest,
} from './OpenId4vcSiopHolderServiceOptions'
import type { OpenId4VcJwtIssuer } from '../shared'
import type { AgentContext, SdJwtVc, W3cVerifiablePresentation } from '@aries-framework/core'
import type { VerifiedAuthorizationRequest, PresentationExchangeResponseOpts } from '@sphereon/did-auth-siop'

import {
  Hasher,
  W3cJwtVerifiablePresentation,
  parseDid,
  AriesFrameworkError,
  DidsApi,
  injectable,
  W3cJsonLdVerifiablePresentation,
  asArray,
  DifPresentationExchangeService,
  DifPresentationExchangeSubmissionLocation,
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

import { getSphereonVerifiablePresentation } from '../shared/transform'
import { getSphereonDidResolver, getSphereonSuppliedSignatureFromJwtIssuer } from '../shared/utils'

@injectable()
export class OpenId4VcSiopHolderService {
  public constructor(private presentationExchangeService: DifPresentationExchangeService) {}

  public async resolveAuthorizationRequest(
    agentContext: AgentContext,
    requestJwtOrUri: string
  ): Promise<OpenId4VcSiopResolvedAuthorizationRequest> {
    const openidProvider = await this.getOpenIdProvider(agentContext, {})

    // parsing happens automatically in verifyAuthorizationRequest
    const verifiedAuthorizationRequest = await openidProvider.verifyAuthorizationRequest(requestJwtOrUri, {
      verification: {
        // FIXME: we want custom verification, but not supported currently
        // https://github.com/Sphereon-Opensource/SIOP-OID4VP/issues/55
        mode: VerificationMode.INTERNAL,
        resolveOpts: { resolver: getSphereonDidResolver(agentContext), noUniversalResolverFallback: true },
      },
    })

    agentContext.config.logger.debug(
      `verified SIOP Authorization Request for issuer '${verifiedAuthorizationRequest.issuer}'`
    )
    agentContext.config.logger.debug(`requestJwtOrUri '${requestJwtOrUri}'`)

    if (
      verifiedAuthorizationRequest.presentationDefinitions &&
      verifiedAuthorizationRequest.presentationDefinitions.length > 1
    ) {
      throw new AriesFrameworkError('Only a single presentation definition is supported.')
    }

    const presentationDefinition = verifiedAuthorizationRequest.presentationDefinitions?.[0]?.definition

    return {
      authorizationRequest: verifiedAuthorizationRequest,

      // Parameters related to DIF Presentation Exchange
      presentationExchange: presentationDefinition
        ? {
            definition: presentationDefinition,
            credentialsForRequest: await this.presentationExchangeService.getCredentialsForRequest(
              agentContext,
              presentationDefinition
            ),
          }
        : undefined,
    }
  }

  public async acceptAuthorizationRequest(
    agentContext: AgentContext,
    options: OpenId4VcSiopAcceptAuthorizationRequestOptions
  ) {
    const { authorizationRequest, presentationExchange } = options
    let openIdTokenIssuer = options.openIdTokenIssuer
    let presentationExchangeOptions: PresentationExchangeResponseOpts | undefined = undefined

    // Handle presentation exchange part
    if (authorizationRequest.presentationDefinitions) {
      if (!presentationExchange) {
        throw new AriesFrameworkError(
          'Authorization request included presentation definition. `presentationExchange` MUST be supplied to accept authorization requests.'
        )
      }

      const nonce = await authorizationRequest.authorizationRequest.getMergedProperty<string>('nonce')
      if (!nonce) {
        throw new AriesFrameworkError("Unable to extract 'nonce' from authorization request")
      }

      const clientId = await authorizationRequest.authorizationRequest.getMergedProperty<string>('client_id')
      if (!clientId) {
        throw new AriesFrameworkError("Unable to extract 'client_id' from authorization request")
      }

      const { verifiablePresentations, presentationSubmission } =
        await this.presentationExchangeService.createPresentation(agentContext, {
          credentialsForInputDescriptor: presentationExchange.credentials,
          presentationDefinition: authorizationRequest.presentationDefinitions[0].definition,
          challenge: nonce,
          domain: clientId,
          presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.EXTERNAL,
        })

      presentationExchangeOptions = {
        verifiablePresentations: verifiablePresentations.map((vp) => getSphereonVerifiablePresentation(vp)),
        presentationSubmission,
        vpTokenLocation: VPTokenLocation.AUTHORIZATION_RESPONSE,
      }

      if (!openIdTokenIssuer) {
        openIdTokenIssuer = this.getOpenIdTokenIssuerFromVerifiablePresentation(verifiablePresentations[0])
      }
    } else if (options.presentationExchange) {
      throw new AriesFrameworkError(
        '`presentationExchange` was supplied, but no presentation definition was found in the presentaiton request.'
      )
    }

    if (!openIdTokenIssuer) {
      throw new AriesFrameworkError(
        'Unable to create authorization response. openIdTokenIssuer MUST be supplied when no presentation is active.'
      )
    }

    this.assertValidTokenIssuer(authorizationRequest, openIdTokenIssuer)
    const openidProvider = await this.getOpenIdProvider(agentContext, {
      openIdTokenIssuer,
    })

    const suppliedSignature = await getSphereonSuppliedSignatureFromJwtIssuer(agentContext, openIdTokenIssuer)
    const authorizationResponseWithCorrelationId = await openidProvider.createAuthorizationResponse(
      authorizationRequest,
      {
        signature: suppliedSignature,
        issuer: suppliedSignature.did,
        verification: {
          resolveOpts: { resolver: getSphereonDidResolver(agentContext), noUniversalResolverFallback: true },
          mode: VerificationMode.INTERNAL,
        },
        presentationExchange: presentationExchangeOptions,
        // https://openid.net/specs/openid-connect-self-issued-v2-1_0.html#name-aud-of-a-request-object
        audience: authorizationRequest.authorizationRequestPayload.client_id,
      }
    )

    const response = await openidProvider.submitAuthorizationResponse(authorizationResponseWithCorrelationId)
    return {
      ok: response.status === 200,
      status: response.status,
      submittedResponse: authorizationResponseWithCorrelationId.response.payload,
    }
  }

  private async getOpenIdProvider(
    agentContext: AgentContext,
    options: {
      openIdTokenIssuer?: OpenId4VcJwtIssuer
    } = {}
  ) {
    const { openIdTokenIssuer } = options

    const builder = OP.builder()
      .withExpiresIn(6000)
      .withIssuer(ResponseIss.SELF_ISSUED_V2)
      .withResponseMode(ResponseMode.POST)
      .withSupportedVersions([SupportedVersion.SIOPv2_D11, SupportedVersion.SIOPv2_D12_OID4VP_D18])
      .withCustomResolver(getSphereonDidResolver(agentContext))
      .withCheckLinkedDomain(CheckLinkedDomain.NEVER)
      .withHasher(Hasher.hash)

    if (openIdTokenIssuer) {
      const suppliedSignature = await getSphereonSuppliedSignatureFromJwtIssuer(agentContext, openIdTokenIssuer)
      builder.withSignature(suppliedSignature)
    }

    // Add did methods
    const supportedDidMethods = agentContext.dependencyManager.resolve(DidsApi).supportedResolverMethods
    for (const supportedDidMethod of supportedDidMethods) {
      builder.addDidMethod(supportedDidMethod)
    }

    const openidProvider = builder.build()

    return openidProvider
  }

  private getOpenIdTokenIssuerFromVerifiablePresentation(
    verifiablePresentation: W3cVerifiablePresentation | SdJwtVc
  ): OpenId4VcJwtIssuer {
    let openIdTokenIssuer: OpenId4VcJwtIssuer

    if (verifiablePresentation instanceof W3cJsonLdVerifiablePresentation) {
      const [firstProof] = asArray(verifiablePresentation.proof)
      if (!firstProof) throw new AriesFrameworkError('Verifiable presentation does not contain a proof')

      if (!firstProof.verificationMethod.startsWith('did:')) {
        throw new AriesFrameworkError(
          'Verifiable presentation proof verificationMethod is not a did. Unable to extract openIdTokenIssuer from verifiable presentation'
        )
      }

      openIdTokenIssuer = {
        method: 'did',
        didUrl: firstProof.verificationMethod,
      }
    } else if (verifiablePresentation instanceof W3cJwtVerifiablePresentation) {
      const kid = verifiablePresentation.jwt.header.kid

      if (!kid) throw new AriesFrameworkError('Verifiable Presentation does not contain a kid in the jwt header')
      if (kid.startsWith('#') && verifiablePresentation.presentation.holderId) {
        openIdTokenIssuer = {
          didUrl: `${verifiablePresentation.presentation.holderId}${kid}`,
          method: 'did',
        }
      } else if (kid.startsWith('did:')) {
        openIdTokenIssuer = {
          didUrl: kid,
          method: 'did',
        }
      } else {
        throw new AriesFrameworkError(
          "JWT W3C Verifiable presentation does not include did in JWT header 'kid'. Unable to extract openIdTokenIssuer from verifiable presentation"
        )
      }
    } else {
      const cnf = verifiablePresentation.payload.cnf
      // FIXME: SD-JWT VC should have better payload typing, so this doesn't become so ugly
      if (
        !cnf ||
        typeof cnf !== 'object' ||
        !('kid' in cnf) ||
        typeof cnf.kid !== 'string' ||
        !cnf.kid.startsWith('did:') ||
        !cnf.kid.includes('#')
      ) {
        throw new AriesFrameworkError(
          "SD-JWT Verifiable presentation has no 'cnf' claim or does not include 'cnf' claim where 'kid' is a didUrl pointing to a key. Unable to extract openIdTokenIssuer from verifiable presentation"
        )
      }

      openIdTokenIssuer = {
        didUrl: cnf.kid,
        method: 'did',
      }
    }

    return openIdTokenIssuer
  }

  private assertValidTokenIssuer(
    authorizationRequest: VerifiedAuthorizationRequest,
    openIdTokenIssuer: OpenId4VcJwtIssuer
  ) {
    // TODO: jwk thumbprint support
    const subjectSyntaxTypesSupported = authorizationRequest.registrationMetadataPayload.subject_syntax_types_supported
    if (!subjectSyntaxTypesSupported) {
      throw new AriesFrameworkError(
        'subject_syntax_types_supported is not supplied in the registration metadata. subject_syntax_types is REQUIRED.'
      )
    }

    let allowedSubjectSyntaxTypes: string[] = []
    if (openIdTokenIssuer.method === 'did') {
      const parsedDid = parseDid(openIdTokenIssuer.didUrl)

      // Either did:<method> or did (for all did methods) is allowed
      allowedSubjectSyntaxTypes = [`did:${parsedDid.method}`, 'did']
    } else {
      throw new AriesFrameworkError("Only 'did' is supported as openIdTokenIssuer at the moment")
    }

    // At least one of the allowed subject syntax types must be supported by the RP
    if (!allowedSubjectSyntaxTypes.some((allowed) => subjectSyntaxTypesSupported.includes(allowed))) {
      throw new AriesFrameworkError(
        [
          'The provided openIdTokenIssuer is not supported by the relying party.',
          `Supported subject syntax types: '${subjectSyntaxTypesSupported.join(', ')}'`,
        ].join('\n')
      )
    }
  }
}
