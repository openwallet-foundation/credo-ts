import type {
  OpenId4VcSiopAcceptAuthorizationRequestOptions,
  OpenId4VcSiopResolvedAuthorizationRequest,
  ResolveSiopAuthorizationRequestOptions,
} from './OpenId4vcSiopHolderServiceOptions'
import type {
  AgentContext,
  DcqlCredentialsForRequest,
  DcqlQuery,
  DcqlTransactionDataRequest,
  DifPexInputDescriptorToCredentials,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
  EncodedX509Certificate,
  SingleOrArray,
  SubmissionEntryCredential,
  TransactionData,
  TransactionDataRequest,
} from '@credo-ts/core'

import {
  CredoError,
  DifPresentationExchangeService,
  DcqlService,
  DifPresentationExchangeSubmissionLocation,
  injectable,
} from '@credo-ts/core'
import { isJarmResponseMode, isOpenid4vpAuthorizationRequestDcApi, Openid4vpClient } from '@openid4vc/openid4vp'

import { getOid4vcCallbacks } from '../shared/callbacks'

@injectable()
export class OpenId4VcSiopHolderService {
  public constructor(
    private presentationExchangeService: DifPresentationExchangeService,
    private dcqlService: DcqlService
  ) {}

  private getOpenid4vpClient(agentContext: AgentContext, trustedCertificates?: EncodedX509Certificate[]) {
    const callbacks = getOid4vcCallbacks(agentContext, trustedCertificates)
    return new Openid4vpClient({ callbacks })
  }

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

    return { pex: { ...presentationExchange, transactionData: credentialsForTransactionData } }
  }

  private async handleDcqlRequest(agentContext: AgentContext, dcql: unknown, transactionData?: TransactionData) {
    const dcqlQuery = this.dcqlService.validateDcqlQuery(dcql as DcqlQuery)
    const dcqlQueryResult = await this.dcqlService.getCredentialsForRequest(agentContext, dcqlQuery)

    let credentialsForTransactionData: DcqlTransactionDataRequest | undefined = undefined
    // for each transaction data entry, get all submission entries that can be used to sign the respective transaction
    if (transactionData) {
      credentialsForTransactionData = []

      for (const transactionDataEntry of transactionData) {
        const result = transactionDataEntry.credential_ids
          .map((credentialId) => {
            const match = dcqlQueryResult.credential_matches[credentialId]
            if (!match.success) return undefined
            return {
              transactionDataEntry,
              dcql: {
                record: match.record,
                credentialQueryId: match.input_credential_index,
                claimSetId: match.claim_set_index,
              },
            }
          })
          .filter((r): r is DcqlTransactionDataRequest[number] => r !== undefined)

        credentialsForTransactionData.push(...result)
      }
    }

    return { dcql: { queryResult: dcqlQueryResult, transactionData: credentialsForTransactionData } }
  }

  public async resolveAuthorizationRequest(
    agentContext: AgentContext,
    /**
     * Can be:
     * - JWT
     * - URI containing request or request_uri param
     * - Request payload
     */
    request: string | Record<string, unknown>,
    options?: ResolveSiopAuthorizationRequestOptions
  ): Promise<OpenId4VcSiopResolvedAuthorizationRequest> {
    const openid4vpClient = this.getOpenid4vpClient(agentContext, options?.trustedCertificates)
    const { params } = openid4vpClient.parseOpenid4vpAuthorizationRequestPayload({ authorizationRequest: request })
    const verifiedAuthRequest = await openid4vpClient.resolveOpenId4vpAuthorizationRequest({
      request: params,
      origin: options?.origin,
    })

    const { client, pex, transactionData, dcql } = verifiedAuthRequest

    if (
      client.scheme !== 'x509_san_dns' &&
      client.scheme !== 'x509_san_uri' &&
      client.scheme !== 'did' &&
      client.scheme !== 'web-origin'
    ) {
      throw new CredoError(`Client scheme '${client.scheme}' is not supported`)
    }

    const { pex: pexResult } = pex?.presentation_definition
      ? await this.handlePresentationExchangeRequest(agentContext, pex.presentation_definition, transactionData)
      : { pex: undefined }

    const { dcql: dcqlResult } = dcql?.query
      ? await this.handleDcqlRequest(agentContext, dcql.query, transactionData)
      : { dcql: undefined }

    agentContext.config.logger.debug(`verified Authorization Request`)
    agentContext.config.logger.debug(`request '${request}'`)

    return {
      authorizationRequest: verifiedAuthRequest,
      presentationExchange: pexResult,
      dcql: dcqlResult,
      origin: options?.origin,
    }
  }

  private async getCredentialQueryIdsToSignTransactionData(
    dcql: {
      credentials: DcqlCredentialsForRequest
    },
    transactionData: TransactionData
  ) {
    // check if all credentials are present for the transaction data
    // This needs a deep integration into pex and out pex requirements
    const dcqlCredentialQueryIds: string[] = []
    for (const tdEntry of transactionData) {
      // find a inputDescriptor in the credential_ids which is present in the response
      // and use it to sign of the transaction
      const dcqlCredentialForRequest = tdEntry.credential_ids.find((credentialId) => dcql.credentials[credentialId])

      if (!dcqlCredentialForRequest) {
        throw new CredoError('Cannot create authorization response. No credentials found for signing transaction data.')
      }

      dcqlCredentialQueryIds.push(dcqlCredentialForRequest)
    }

    return dcqlCredentialQueryIds
  }

  private async getInputDescriptorsToSignTransactionData(
    presentationExchange: {
      credentials: DifPexInputDescriptorToCredentials
    },
    transactionData: TransactionData
  ) {
    // check if all credentials are present for the transaction data
    // This needs a deep integration into pex and out pex requirements
    const inputDescriptorsToSignTransactionData: string[] = []
    for (const tdEntry of transactionData) {
      // find a inputDescriptor in the credential_ids which is present in the response
      // and use it to sign of the transaction
      const inputDescriptorForCredential = tdEntry.credential_ids.find(
        (credentialId) => presentationExchange.credentials[credentialId]
      )

      if (!inputDescriptorForCredential) {
        throw new CredoError('Cannot create authorization response. No credentials found for signing transaction data.')
      }

      inputDescriptorsToSignTransactionData.push(inputDescriptorForCredential)
    }

    return inputDescriptorsToSignTransactionData
  }

  public async acceptAuthorizationRequest(
    agentContext: AgentContext,
    options: OpenId4VcSiopAcceptAuthorizationRequestOptions
  ) {
    const { authorizationRequest, presentationExchange, dcql, origin } = options

    const isDcApiRequest = isOpenid4vpAuthorizationRequestDcApi(authorizationRequest.payload)
    const nonce = authorizationRequest.payload.nonce
    const clientId = authorizationRequest.client.originalValue

    let responseUri: string
    if (isOpenid4vpAuthorizationRequestDcApi(authorizationRequest.payload)) {
      const _responseUri = authorizationRequest.client.identifier ?? options.origin
      if (!_responseUri) {
        throw new CredoError('Missing required parameter `origin` parameter for accepting openid4vp dc api requests.')
      }
      responseUri = _responseUri
    } else {
      const _responseUri = authorizationRequest.payload.response_uri ?? authorizationRequest.payload.redirect_uri
      if (!_responseUri) {
        throw new CredoError(
          'Missing required parameter `response_uri` or `redirect_uri` in the authorization request.'
        )
      }
      responseUri = _responseUri
    }

    const authorizationResponseNonce = await agentContext.wallet.generateNonce()

    let vpToken: SingleOrArray<string | Record<string, unknown>> | Record<string, string | Record<string, unknown>>
    let presentationSubmission: DifPresentationExchangeSubmission | undefined = undefined

    // Handle presentation exchange part
    if (authorizationRequest.pex || presentationExchange) {
      if (!presentationExchange) {
        throw new CredoError(
          'Authorization request included presentation definition. `presentationExchange` MUST be supplied to accept authorization requests.'
        )
      }
      if (!authorizationRequest.pex) {
        throw new CredoError(
          '`presentationExchange` was supplied, but no presentation definition was found in the presentation request.'
        )
      }

      const { presentationSubmission: _presentationSubmission, encodedVerifiablePresentations } =
        await this.presentationExchangeService.createPresentation(agentContext, {
          credentialsForInputDescriptor: presentationExchange.credentials,
          transactionDataAuthorization: authorizationRequest.transactionData
            ? {
                credentials: await this.getInputDescriptorsToSignTransactionData(
                  presentationExchange,
                  authorizationRequest.transactionData
                ),
                transactionData: authorizationRequest.transactionData,
              }
            : undefined,
          presentationDefinition: authorizationRequest.pex
            .presentation_definition as unknown as DifPresentationExchangeDefinition,
          challenge: nonce,
          domain: clientId,
          presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.EXTERNAL,
          openid4vp:
            isDcApiRequest && origin
              ? { type: 'openId4VpDcApi', clientId, origin }
              : { type: 'openId4Vp', mdocGeneratedNonce: authorizationResponseNonce, responseUri, clientId },
        })

      vpToken =
        encodedVerifiablePresentations.length === 1 && _presentationSubmission?.descriptor_map[0]?.path === '$'
          ? encodedVerifiablePresentations[0]
          : encodedVerifiablePresentations
      presentationSubmission = _presentationSubmission
    } else if (authorizationRequest.dcql || dcql) {
      if (!authorizationRequest.dcql) {
        throw new CredoError('`dcql` was supplied, but no dcql request was found in the presentation request.')
      }
      if (!dcql) {
        throw new CredoError(
          'Authorization request included dcql request. `dcql` MUST be supplied to accept authorization requests.'
        )
      }

      const { encodedDcqlPresentation } = await this.dcqlService.createPresentation(agentContext, {
        credentialQueryToCredential: dcql.credentials,
        transactionDataAuthorization: authorizationRequest.transactionData
          ? {
              credentials: await this.getCredentialQueryIdsToSignTransactionData(
                dcql,
                authorizationRequest.transactionData
              ),
              transactionData: authorizationRequest.transactionData,
            }
          : undefined,
        challenge: nonce,
        domain: clientId,
        openid4vp:
          isDcApiRequest && origin
            ? { type: 'openId4VpDcApi', clientId, origin }
            : { type: 'openId4Vp', mdocGeneratedNonce: authorizationResponseNonce, responseUri, clientId },
      })

      vpToken = encodedDcqlPresentation
    } else {
      throw new CredoError('Either pex or dcql must be provided')
    }

    const openid4vpClient = this.getOpenid4vpClient(agentContext)
    const response = await openid4vpClient.createOpenid4vpAuthorizationResponse({
      requestParams: authorizationRequest.payload,
      responseParams: {
        vp_token: vpToken,
        presentation_submission: presentationSubmission,
      },
      jarm:
        authorizationRequest.payload.response_mode && isJarmResponseMode(authorizationRequest.payload.response_mode)
          ? {
              encryption: { nonce: authorizationResponseNonce },
              serverMetadata: {
                authorization_signing_alg_values_supported: ['RS256'],
                authorization_encryption_alg_values_supported: ['ECDH-ES'],
                authorization_encryption_enc_values_supported: ['A128GCM', 'A256GCM', 'A128CBC-HS256'],
              },
            }
          : undefined,
    })

    // TODO: we should include more typing here that the user
    // still needs to submit the resposne. or as we discussed, split
    // this method up in create and submit
    if (isOpenid4vpAuthorizationRequestDcApi(authorizationRequest.payload)) {
      return {
        ok: true,
        authorizationResponse: response.responseParams as typeof response.responseParams & {
          presentation_submission?: DifPresentationExchangeSubmission
        },
      } as const
    }

    const result = await openid4vpClient.submitOpenid4vpAuthorizationResponse({
      request: authorizationRequest.payload,
      response: response.responseParams,
      jarm: response.jarm ? { responseJwt: response.jarm.responseJwt } : undefined,
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
        authorizationResponse: response.responseParams as typeof response.responseParams & {
          presentation_submission?: DifPresentationExchangeSubmission
        },
      } as const
    }

    return {
      ok: true,
      serverResponse: {
        status: result.response.status,
        body: responseJson ?? {},
      },
      authorizationResponse: response.responseParams as typeof response.responseParams & {
        presentation_submission?: DifPresentationExchangeSubmission
      },
      redirectUri: responseJson?.redirect_uri as string | undefined,
      presentationDuringIssuanceSession: responseJson?.presentation_during_issuance_session as string | undefined,
    } as const
  }
}
