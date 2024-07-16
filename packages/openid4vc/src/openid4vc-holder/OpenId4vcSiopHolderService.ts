import type {
  OpenId4VcSiopAcceptAuthorizationRequestOptions,
  OpenId4VcSiopResolvedAuthorizationRequest,
} from './OpenId4vcSiopHolderServiceOptions'
import type { OpenId4VcJwtIssuer } from '../shared'
import type { AgentContext, VerifiablePresentation } from '@credo-ts/core'
import type { VerifiedAuthorizationRequest, PresentationExchangeResponseOpts } from '@sphereon/did-auth-siop'

import {
  Hasher,
  W3cJwtVerifiablePresentation,
  parseDid,
  CredoError,
  injectable,
  W3cJsonLdVerifiablePresentation,
  asArray,
  DifPresentationExchangeService,
  DifPresentationExchangeSubmissionLocation,
} from '@credo-ts/core'
import { OP, ResponseIss, ResponseMode, SupportedVersion, VPTokenLocation } from '@sphereon/did-auth-siop'

import { getSphereonVerifiablePresentation } from '../shared/transform'
import { getCreateJwtCallback, getVerifyJwtCallback, openIdTokenIssuerToJwtIssuer } from '../shared/utils'

@injectable()
export class OpenId4VcSiopHolderService {
  public constructor(private presentationExchangeService: DifPresentationExchangeService) {}

  public async resolveAuthorizationRequest(
    agentContext: AgentContext,
    requestJwtOrUri: string
  ): Promise<OpenId4VcSiopResolvedAuthorizationRequest> {
    const openidProvider = await this.getOpenIdProvider(agentContext)

    // parsing happens automatically in verifyAuthorizationRequest
    const verifiedAuthorizationRequest = await openidProvider.verifyAuthorizationRequest(requestJwtOrUri)

    agentContext.config.logger.debug(
      `verified SIOP Authorization Request for issuer '${verifiedAuthorizationRequest.issuer}'`
    )
    agentContext.config.logger.debug(`requestJwtOrUri '${requestJwtOrUri}'`)

    if (
      verifiedAuthorizationRequest.presentationDefinitions &&
      verifiedAuthorizationRequest.presentationDefinitions.length > 1
    ) {
      throw new CredoError('Only a single presentation definition is supported.')
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
    if (authorizationRequest.presentationDefinitions && authorizationRequest.presentationDefinitions.length > 0) {
      if (!presentationExchange) {
        throw new CredoError(
          'Authorization request included presentation definition. `presentationExchange` MUST be supplied to accept authorization requests.'
        )
      }

      const nonce = await authorizationRequest.authorizationRequest.getMergedProperty<string>('nonce')
      if (!nonce) {
        throw new CredoError("Unable to extract 'nonce' from authorization request")
      }

      const clientId = await authorizationRequest.authorizationRequest.getMergedProperty<string>('client_id')
      if (!clientId) {
        throw new CredoError("Unable to extract 'client_id' from authorization request")
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
      throw new CredoError(
        '`presentationExchange` was supplied, but no presentation definition was found in the presentation request.'
      )
    }

    if (!openIdTokenIssuer) {
      throw new CredoError(
        'Unable to create authorization response. openIdTokenIssuer MUST be supplied when no presentation is active.'
      )
    }

    this.assertValidTokenIssuer(authorizationRequest, openIdTokenIssuer)
    const openidProvider = await this.getOpenIdProvider(agentContext)

    const authorizationResponseWithCorrelationId = await openidProvider.createAuthorizationResponse(
      authorizationRequest,
      {
        jwtIssuer: await openIdTokenIssuerToJwtIssuer(agentContext, openIdTokenIssuer),
        presentationExchange: presentationExchangeOptions,
        // https://openid.net/specs/openid-connect-self-issued-v2-1_0.html#name-aud-of-a-request-object
        audience: authorizationRequest.authorizationRequestPayload.client_id,
      }
    )

    const response = await openidProvider.submitAuthorizationResponse(authorizationResponseWithCorrelationId)
    let responseDetails: string | Record<string, unknown> | undefined = undefined
    try {
      responseDetails = await response.text()
      if (responseDetails.includes('{')) {
        responseDetails = JSON.parse(responseDetails)
      }
    } catch (error) {
      // no-op
    }

    return {
      serverResponse: {
        status: response.status,
        body: responseDetails,
      },
      submittedResponse: authorizationResponseWithCorrelationId.response.payload,
    }
  }

  private async getOpenIdProvider(agentContext: AgentContext) {
    const builder = OP.builder()
      .withExpiresIn(6000)
      .withIssuer(ResponseIss.SELF_ISSUED_V2)
      .withResponseMode(ResponseMode.POST)
      .withSupportedVersions([
        SupportedVersion.SIOPv2_D11,
        SupportedVersion.SIOPv2_D12_OID4VP_D18,
        SupportedVersion.SIOPv2_D12_OID4VP_D20,
      ])
      .withCreateJwtCallback(getCreateJwtCallback(agentContext))
      .withVerifyJwtCallback(getVerifyJwtCallback(agentContext))
      .withHasher(Hasher.hash)

    const openidProvider = builder.build()

    return openidProvider
  }

  private getOpenIdTokenIssuerFromVerifiablePresentation(
    verifiablePresentation: VerifiablePresentation
  ): OpenId4VcJwtIssuer {
    let openIdTokenIssuer: OpenId4VcJwtIssuer

    if (verifiablePresentation instanceof W3cJsonLdVerifiablePresentation) {
      const [firstProof] = asArray(verifiablePresentation.proof)
      if (!firstProof) throw new CredoError('Verifiable presentation does not contain a proof')

      if (!firstProof.verificationMethod.startsWith('did:')) {
        throw new CredoError(
          'Verifiable presentation proof verificationMethod is not a did. Unable to extract openIdTokenIssuer from verifiable presentation'
        )
      }

      openIdTokenIssuer = {
        method: 'did',
        didUrl: firstProof.verificationMethod,
      }
    } else if (verifiablePresentation instanceof W3cJwtVerifiablePresentation) {
      const kid = verifiablePresentation.jwt.header.kid

      if (!kid) throw new CredoError('Verifiable Presentation does not contain a kid in the jwt header')
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
        throw new CredoError(
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
        throw new CredoError(
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
      throw new CredoError(
        'subject_syntax_types_supported is not supplied in the registration metadata. subject_syntax_types is REQUIRED.'
      )
    }

    let allowedSubjectSyntaxTypes: string[] = []
    if (openIdTokenIssuer.method === 'did') {
      const parsedDid = parseDid(openIdTokenIssuer.didUrl)

      // Either did:<method> or did (for all did methods) is allowed
      allowedSubjectSyntaxTypes = [`did:${parsedDid.method}`, 'did']
    } else {
      throw new CredoError("Only 'did' is supported as openIdTokenIssuer at the moment")
    }

    // At least one of the allowed subject syntax types must be supported by the RP
    if (!allowedSubjectSyntaxTypes.some((allowed) => subjectSyntaxTypesSupported.includes(allowed))) {
      throw new CredoError(
        [
          'The provided openIdTokenIssuer is not supported by the relying party.',
          `Supported subject syntax types: '${subjectSyntaxTypesSupported.join(', ')}'`,
        ].join('\n')
      )
    }
  }
}
