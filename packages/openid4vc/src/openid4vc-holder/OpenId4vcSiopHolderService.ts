import type {
  AgentContext,
  DifPresentationExchangeDefinition,
  EncodedX509Certificate,
  VerifiablePresentation
} from '@credo-ts/core'
import {
  createOpenid4vpAuthorizationResponse,
  parseOpenid4vpRequestParams,
  processOpenid4vpAuthRequest,
  submitOpenid4vpAuthorizationResponse
} from '@openid4vc/oid4vp'
import type {
  PresentationExchangeResponseOpts
} from '@sphereon/did-auth-siop'
import type { OpenId4VcJwtIssuer } from '../shared'
import type {
  OpenId4VcSiopAcceptAuthorizationRequestOptions,
  OpenId4VcSiopResolvedAuthorizationRequest,
} from './OpenId4vcSiopHolderServiceOptions'

import {
  asArray,
  CredoError,
  DifPresentationExchangeService,
  DifPresentationExchangeSubmissionLocation,
  injectable,
  MdocDeviceResponse,
  W3cJsonLdVerifiablePresentation,
  W3cJwtVerifiablePresentation
} from '@credo-ts/core'
import { VPTokenLocation } from '@sphereon/did-auth-siop'

import { getOid4vciCallbacks } from '../shared/callbacks'
import { getSphereonVerifiablePresentation } from '../shared/transform'
import { openIdTokenIssuerToJwtIssuer } from '../shared/utils'

@injectable()
export class OpenId4VcSiopHolderService {
  public constructor(private presentationExchangeService: DifPresentationExchangeService) {}

  public async resolveAuthorizationRequest(
    agentContext: AgentContext,
    requestJwtOrUri: string,
    trustedCertificates?: EncodedX509Certificate[]
  ): Promise<OpenId4VcSiopResolvedAuthorizationRequest> {
    const {params} = parseOpenid4vpRequestParams(requestJwtOrUri)
    const result = await processOpenid4vpAuthRequest(params, { callbacks: getOid4vciCallbacks(agentContext, trustedCertificates) })

    // TODO: CHECK THE SIGNATURE OF THE JWT, AND IF THE CLIENT IS TRUSTED
    if (result.client.scheme !== 'x509_san_dns') {

    }

    const presentationDefinition = result.pex?.presentation_definition as unknown as
      | DifPresentationExchangeDefinition
      | undefined

    if (presentationDefinition) {
      this.presentationExchangeService.validatePresentationDefinition(presentationDefinition)
    }

    agentContext.config.logger.debug(`verified SIOP Authorization Request`)
    agentContext.config.logger.debug(`requestJwtOrUri '${requestJwtOrUri}'`)

    return {
      authorizationRequest: result,

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

    const wantsIdToken = await authorizationRequest.request.response_type.includes('id_token')
    const authorizationResponseNonce = await agentContext.wallet.generateNonce()

    // Handle presentation exchange part
    if (authorizationRequest.pex) {
      if (!presentationExchange) {
        throw new CredoError(
          'Authorization request included presentation definition. `presentationExchange` MUST be supplied to accept authorization requests.'
        )
      }

      const nonce = authorizationRequest.request.nonce
      const clientId = authorizationRequest.request.client_id
      const responseUri = authorizationRequest.request.response_uri ?? authorizationRequest.request.redirect_uri
      if (!responseUri) {
        throw new CredoError("Unable to extract 'response_uri' from authorization request")
      }

      const { verifiablePresentations, presentationSubmission } =
        await this.presentationExchangeService.createPresentation(agentContext, {
          credentialsForInputDescriptor: presentationExchange.credentials,
          presentationDefinition: authorizationRequest.pex
            .presentation_definition as unknown as DifPresentationExchangeDefinition,
          challenge: nonce,
          domain: clientId,
          presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.EXTERNAL,
          openid4vp: {
            mdocGeneratedNonce: authorizationResponseNonce,
            responseUri,
          },
        })

      presentationExchangeOptions = {
        verifiablePresentations: verifiablePresentations.map((vp) => getSphereonVerifiablePresentation(vp)),
        presentationSubmission,
        vpTokenLocation: VPTokenLocation.AUTHORIZATION_RESPONSE,
      }

      if (wantsIdToken && !openIdTokenIssuer) {
        openIdTokenIssuer = this.getOpenIdTokenIssuerFromVerifiablePresentation(verifiablePresentations[0])
      }
    } else if (options.presentationExchange) {
      throw new CredoError(
        '`presentationExchange` was supplied, but no presentation definition was found in the presentation request.'
      )
    }

    if (wantsIdToken) {
      if (!openIdTokenIssuer) {
        throw new CredoError(
          'Unable to create authorization response. openIdTokenIssuer MUST be supplied when no presentation is active and the ResponseType includes id_token.'
        )
      }
    }

    const jwtIssuer =
      wantsIdToken && openIdTokenIssuer
        ? await openIdTokenIssuerToJwtIssuer(agentContext, openIdTokenIssuer)
        : undefined


    const vpToken =
      presentationExchangeOptions?.verifiablePresentations.length === 1 &&
      presentationExchangeOptions.presentationSubmission?.descriptor_map[0]?.path === '$'
        ? presentationExchangeOptions.verifiablePresentations[0]
        : presentationExchangeOptions?.verifiablePresentations

    const callbacks = getOid4vciCallbacks(agentContext)

    const response = await createOpenid4vpAuthorizationResponse({
      requestParams: authorizationRequest.request,
      responseParams: {
        vp_token: vpToken! as any,
        presentation_submission: presentationExchangeOptions?.presentationSubmission,
      },
      jarm: authorizationRequest.request.response_mode.includes('jwt') ?{
        // TODO: get the correct aud and iss
        // TODO: encrypt the jwt
        aud: authorizationRequest.request.client_id,
        iss: authorizationRequest.request.client_id,
        jwtSigner: jwtIssuer!,
        jweEncryptor: {
          nonce: authorizationResponseNonce,
        },
        serverMetadata: {
          authorization_signing_alg_values_supported: ['RS256'],
          authorization_encryption_alg_values_supported: ['ECDH-ES'],
          authorization_encryption_enc_values_supported: ['A256GCM'],
        },
      } : undefined,
      callbacks,
    })

    const result = await submitOpenid4vpAuthorizationResponse({
      request: authorizationRequest.request,
      response: response.responseParams,
      jarm: response.jarm ? {
        responseJwt: response.jarm.responseJwt,
      } : undefined,
      callbacks,
    })


    const responseText = await result.response
      .clone()
      .text()
      .catch(() => null)
    const responseJson = (await result.response
      .clone()
      .json()
      .catch(() => null)) as null | Record<string, unknown>

    if (!result.response.ok) {
      return {
        ok: false,
        serverResponse: {
          status: result.response.status,
          body: responseJson ?? responseText,
        },
        submittedResponse: response.responseParams,
      } as const
    }

    return {
      ok: true,
      serverResponse: {
        status: result.response.status,
        body: responseJson ?? {},
      },
      submittedResponse: response.responseParams,
      redirectUri: responseJson?.redirect_uri as string | undefined,
      presentationDuringIssuanceSession: responseJson?.presentation_during_issuance_session as string | undefined,
    } as const
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
    } else if (verifiablePresentation instanceof MdocDeviceResponse) {
      throw new CredoError('Mdoc Verifiable Presentations are not yet supported')
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

}
