import type {
  AgentContext,
  DifPexInputDescriptorToCredentials,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
  EncodedX509Certificate,
  SubmissionEntryCredential,
  TransactionData,
  TransactionDataRequest,
  VerifiablePresentation,
} from '@credo-ts/core'
import {
  createOpenid4vpAuthorizationResponse,
  parseOpenid4vpRequestParams,
  submitOpenid4vpAuthorizationResponse,
  verifyOpenid4vpAuthRequest,
} from '@openid4vc/oid4vp'
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
  W3cJwtVerifiablePresentation,
} from '@credo-ts/core'

import { getOid4vcCallbacks, getOid4vpX509Callbacks } from '../shared/callbacks'
import { openIdTokenIssuerToJwtIssuer } from '../shared/utils'

@injectable()
export class OpenId4VcSiopHolderService {
  public constructor(private presentationExchangeService: DifPresentationExchangeService) {}

  private async handlePresentationExchangeRequest(
    agentContext: AgentContext,
    _presentationDefinition: unknown,
    transactionData?: TransactionData
  ) {
    const presentationDefinition = _presentationDefinition as DifPresentationExchangeDefinition
    this.presentationExchangeService.validatePresentationDefinition(presentationDefinition)

    const presentationExchange = {
      definition: presentationDefinition,
      credentialsForRequest: await this.presentationExchangeService.getCredentialsForRequest(
        agentContext,
        presentationDefinition
      ),
    }

    let credentialsForTransactionData: TransactionDataRequest | undefined = undefined
    // for each transaction data entry, get all submission entries that can be used to sign the respective transaction
    if (transactionData) {
      credentialsForTransactionData = []

      for (const transactionDataEntry of transactionData) {
        if (!presentationExchange) {
          throw new CredoError('Cannot resolve transaction data. Presentation exchange is not defined.')
        }

        for (const requirement of presentationExchange.credentialsForRequest.requirements) {
          const recordSet: Set<SubmissionEntryCredential> = new Set()
          const filtered = requirement.submissionEntry.filter((submission) =>
            transactionDataEntry.credential_ids.includes(submission.inputDescriptorId)
          )

          for (const submission of filtered) {
            for (const credential of submission.verifiableCredentials) {
              recordSet.add(credential)
            }
          }

          if (recordSet.size === 0) {
            continue
          }

          credentialsForTransactionData.push({
            transactionDataEntry,
            submissionEntry: { ...filtered[0], verifiableCredentials: Array.from(recordSet) },
          })
        }
      }
    }

    return { presentationExchange, credentialsForTransactionData }
  }

  public async resolveAuthorizationRequest(
    agentContext: AgentContext,
    requestJwtOrUri: string,
    trustedCertificates?: EncodedX509Certificate[]
  ): Promise<OpenId4VcSiopResolvedAuthorizationRequest> {
    const { params } = parseOpenid4vpRequestParams(requestJwtOrUri)
    const verifiedAuthRequest = await verifyOpenid4vpAuthRequest(params, {
      callbacks: {
        ...getOid4vcCallbacks(agentContext, trustedCertificates),
        ...getOid4vpX509Callbacks(agentContext),
      },
    })

    const { client, pex, transactionData } = verifiedAuthRequest

    if (client.scheme !== 'x509_san_dns' && client.scheme !== 'x509_san_uri' && client.scheme !== 'did') {
      throw new CredoError(`Client scheme '${client.scheme}' is not supported`)
    }

    const { presentationExchange, credentialsForTransactionData } = pex?.presentation_definition
      ? await this.handlePresentationExchangeRequest(agentContext, pex.presentation_definition, transactionData)
      : { presentationExchange: undefined, credentialsForTransactionData: undefined }

    agentContext.config.logger.debug(`verified SIOP Authorization Request`)
    agentContext.config.logger.debug(`requestJwtOrUri '${requestJwtOrUri}'`)

    return {
      authorizationRequest: verifiedAuthRequest,
      transactionData: credentialsForTransactionData,
      presentationExchange: presentationExchange,
    }
  }

  private async getInputDescriptorsToSignTransactionData(
    presentationExchange: {
      credentials: DifPexInputDescriptorToCredentials
    },
    transactionData: TransactionData
  ) {
    // check if all credentials are present for the transaction data
    // This needs a deep integration into pex and out pex requirements

    let inputDescriptorsToSignTransactionData: string[] | undefined = undefined

    // check if all credentials are present for the transaction data
    // This needs a deep integration into pex and out pex requirements
    if (transactionData && presentationExchange) {
      inputDescriptorsToSignTransactionData = []
      for (const tdEntry of transactionData) {
        // find a inputDescriptor in the credential_ids which is present in the response
        // and use it to sign of the transaction
        const inputDescriptorForCredential = tdEntry.credential_ids.find(
          (credentialId) => presentationExchange.credentials[credentialId]
        )

        if (!inputDescriptorForCredential) {
          throw new CredoError(
            'Cannot create authorization response. No credentials found for signing transaction data.'
          )
        }

        inputDescriptorsToSignTransactionData.push(inputDescriptorForCredential)
      }
    }

    return inputDescriptorsToSignTransactionData
  }

  public async acceptAuthorizationRequest(
    agentContext: AgentContext,
    options: OpenId4VcSiopAcceptAuthorizationRequestOptions
  ) {
    const { authorizationRequest, presentationExchange } = options
    let openIdTokenIssuer = options.openIdTokenIssuer
    let presentationExchangeOptions:
      | {
          presentationSubmission: DifPresentationExchangeSubmission
          verifiablePresentations: (string | W3cJsonLdVerifiablePresentation)[]
        }
      | undefined = undefined

    const wantsIdToken = authorizationRequest.payload.response_type.includes('id_token')
    const authorizationResponseNonce = await agentContext.wallet.generateNonce()

    // Handle presentation exchange part
    if (authorizationRequest.pex) {
      if (!presentationExchange) {
        throw new CredoError(
          'Authorization request included presentation definition. `presentationExchange` MUST be supplied to accept authorization requests.'
        )
      }

      const nonce = authorizationRequest.payload.nonce
      const clientId = authorizationRequest.payload.client_id
      const responseUri = authorizationRequest.payload.response_uri ?? authorizationRequest.payload.redirect_uri
      if (!responseUri) {
        throw new CredoError("Unable to extract 'response_uri' from authorization request")
      }

      let inputDescriptorsToSignTransactionData: string[] | undefined = undefined
      if (authorizationRequest.transactionData && presentationExchange) {
        inputDescriptorsToSignTransactionData = await this.getInputDescriptorsToSignTransactionData(
          presentationExchange,
          authorizationRequest.transactionData
        )
      }

      const { presentationSubmission, encodedVerifiablePresentations, verifiablePresentations } =
        await this.presentationExchangeService.createPresentation(agentContext, {
          credentialsForInputDescriptor: presentationExchange.credentials,
          transactionDataAuthorization:
            authorizationRequest.transactionData && inputDescriptorsToSignTransactionData
              ? {
                  inputDescriptors: inputDescriptorsToSignTransactionData,
                  transactionData: authorizationRequest.transactionData,
                }
              : undefined,
          presentationDefinition: authorizationRequest.pex
            .presentation_definition as unknown as DifPresentationExchangeDefinition,
          challenge: nonce,
          domain: clientId,
          presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.EXTERNAL,
          openid4vp: { mdocGeneratedNonce: authorizationResponseNonce, responseUri },
        })

      presentationExchangeOptions = { verifiablePresentations: encodedVerifiablePresentations, presentationSubmission }

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

    const callbacks = getOid4vcCallbacks(agentContext)

    const response = await createOpenid4vpAuthorizationResponse({
      requestParams: authorizationRequest.payload,
      responseParams: {
        vp_token: vpToken! as any,
        presentation_submission: presentationExchangeOptions?.presentationSubmission,
      },
      jarm: authorizationRequest.payload.response_mode.includes('jwt')
        ? {
            jwtSigner: jwtIssuer!,
            jweEncryptor: { nonce: authorizationResponseNonce },
            serverMetadata: {
              authorization_signing_alg_values_supported: ['RS256'],
              authorization_encryption_alg_values_supported: ['ECDH-ES'],
              authorization_encryption_enc_values_supported: ['A256GCM'],
            },
          }
        : undefined,
      callbacks,
    })

    const result = await submitOpenid4vpAuthorizationResponse({
      request: authorizationRequest.payload,
      response: response.responseParams,
      jarm: response.jarm ? { responseJwt: response.jarm.responseJwt } : undefined,
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
        submittedResponse: response.responseParams as typeof response.responseParams & {
          presentation_submission: DifPresentationExchangeSubmission
        },
      } as const
    }

    return {
      ok: true,
      serverResponse: {
        status: result.response.status,
        body: responseJson ?? {},
      },
      submittedResponse: response.responseParams as typeof response.responseParams & {
        presentation_submission: DifPresentationExchangeSubmission
      },
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
