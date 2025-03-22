import type {
  AgentContext,
  DcqlCredentialsForRequest,
  DifPexInputDescriptorToCredentials,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
  EncodedX509Certificate,
  HashName,
  MdocOpenId4VpDcApiSessionTranscriptOptions,
  MdocOpenId4VpSessionTranscriptOptions,
} from '@credo-ts/core'
import type {
  OpenId4VpAcceptAuthorizationRequestOptions,
  OpenId4VpResolvedAuthorizationRequest,
  ParsedTransactionDataEntry,
  ResolveOpenId4VpAuthorizationRequestOptions,
} from './OpenId4vpHolderServiceOptions'

import {
  ClaimFormat,
  CredoError,
  DcqlService,
  DifPresentationExchangeService,
  DifPresentationExchangeSubmissionLocation,
  Hasher,
  TypedArrayEncoder,
  injectable,
} from '@credo-ts/core'
import {
  Openid4vpAuthorizationResponse,
  Openid4vpClient,
  VpToken,
  getOpenid4vpClientId,
  isJarmResponseMode,
  isOpenid4vpAuthorizationRequestDcApi,
  parseTransactionData,
} from '@openid4vc/openid4vp'

import { getOid4vcCallbacks } from '../shared/callbacks'

@injectable()
export class OpenId4VpHolderService {
  public constructor(
    private presentationExchangeService: DifPresentationExchangeService,
    private dcqlService: DcqlService
  ) {}

  private getOpenid4vpClient(
    agentContext: AgentContext,
    options?: { trustedCertificates?: EncodedX509Certificate[]; isVerifyOpenId4VpAuthorizationRequest?: boolean }
  ) {
    const callbacks = getOid4vcCallbacks(agentContext, {
      trustedCertificates: options?.trustedCertificates,
      isVerifyOpenId4VpAuthorizationRequest: options?.isVerifyOpenId4VpAuthorizationRequest,
    })
    return new Openid4vpClient({ callbacks })
  }

  private async handlePresentationExchangeRequest(
    agentContext: AgentContext,
    _presentationDefinition: unknown,
    transactionData?: ParsedTransactionDataEntry[]
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

    const availableCredentialIds = presentationExchange.credentialsForRequest.requirements.flatMap((requirement) =>
      requirement.submissionEntry.map((entry) => entry.inputDescriptorId)
    )

    // for each transaction data entry, get all credentials that can be used to sign the respective transaction
    const matchedTransactionData = transactionData?.map((entry) => ({
      entry,
      matchedCredentialIds: entry.transactionData.credential_ids.filter((credentialId) =>
        availableCredentialIds.includes(credentialId)
      ),
    }))

    return { pex: presentationExchange, matchedTransactionData }
  }

  private async handleDcqlRequest(
    agentContext: AgentContext,
    dcql: unknown,
    transactionData?: ParsedTransactionDataEntry[]
  ) {
    const dcqlQuery = this.dcqlService.validateDcqlQuery(dcql)
    const dcqlQueryResult = await this.dcqlService.getCredentialsForRequest(agentContext, dcqlQuery)

    // for each transaction data entry, get all credentials that can be used to sign the respective transaction
    const matchedTransactionData = transactionData?.map((entry) => ({
      entry,
      matchedCredentialIds: entry.transactionData.credential_ids.filter(
        (credentialId) => dcqlQueryResult.credential_matches[credentialId].success
      ),
    }))

    return { dcql: { queryResult: dcqlQueryResult }, matchedTransactionData }
  }

  public async resolveAuthorizationRequest(
    agentContext: AgentContext,
    /**
     * Can be:
     * - JWT
     * - URI containing request or request_uri param
     * - Request payload
     */
    authorizationRequest: string | Record<string, unknown>,
    options?: ResolveOpenId4VpAuthorizationRequestOptions
  ): Promise<OpenId4VpResolvedAuthorizationRequest> {
    const openid4vpClient = this.getOpenid4vpClient(agentContext, {
      trustedCertificates: options?.trustedCertificates,
      isVerifyOpenId4VpAuthorizationRequest: true,
    })
    const { params } = openid4vpClient.parseOpenid4vpAuthorizationRequest({ authorizationRequest })

    const verifiedAuthorizationRequest = await openid4vpClient.resolveOpenId4vpAuthorizationRequest({
      authorizationRequestPayload: params,
      origin: options?.origin,
    })

    const { client, pex, transactionData, dcql } = verifiedAuthorizationRequest

    if (client.scheme !== 'x509_san_dns' && client.scheme !== 'did' && client.scheme !== 'web-origin') {
      throw new CredoError(`Client scheme '${client.scheme}' is not supported`)
    }

    const pexResult = pex?.presentation_definition
      ? await this.handlePresentationExchangeRequest(agentContext, pex.presentation_definition, transactionData)
      : undefined

    const dcqlResult = dcql?.query ? await this.handleDcqlRequest(agentContext, dcql.query, transactionData) : undefined

    agentContext.config.logger.debug('verified Authorization Request')
    agentContext.config.logger.debug(`request '${authorizationRequest}'`)

    return {
      authorizationRequestPayload: verifiedAuthorizationRequest.authorizationRequestPayload,
      transactionData: pexResult?.matchedTransactionData ?? dcqlResult?.matchedTransactionData,
      presentationExchange: pexResult?.pex,
      dcql: dcqlResult?.dcql,
      origin: options?.origin,
      signedAuthorizationRequest: verifiedAuthorizationRequest.jar
        ? {
            signer: verifiedAuthorizationRequest.jar?.signer,
            payload: verifiedAuthorizationRequest.jar.jwt.payload,
            header: verifiedAuthorizationRequest.jar.jwt.header,
          }
        : undefined,
    }
  }

  private extendCredentialsWithTransactionDataHashes<
    T extends DifPexInputDescriptorToCredentials | DcqlCredentialsForRequest,
  >(
    // Either PEX or DCQL
    selectedCredentials: T,
    transactionData?: ParsedTransactionDataEntry[],
    selectedTransactionDataCredentials?: Array<{ credentialId: string }>
  ): T {
    // TODO: it would make sense for oid4vc to also handle this validation logic, but it would require
    // knowledge of PEX / DCQL...
    if (!transactionData && !selectedTransactionDataCredentials) return selectedCredentials

    if (!selectedTransactionDataCredentials) {
      throw new CredoError(
        'Autohrization request contains transaction data entries, but no credential ids to sign transaction data hashes provided in acceptAuthorizationRequest method.'
      )
    }

    if (!transactionData) {
      throw new CredoError(
        'Autohrization request doe not contains transaction data entries, but credentail ids were provided to sign transaction data hashes in acceptAuthorizationRequest method.'
      )
    }

    if (transactionData.length !== selectedTransactionDataCredentials.length) {
      throw new CredoError(
        'Credential ids to sign transaction data hashes provided in acceptAuthorizationRequest method, but the length does not match the number of transaction data entries from the authorization request.'
      )
    }

    const credentialsToTransactionData: Record<string, ParsedTransactionDataEntry[]> = {}
    for (const transactionDataIndex in transactionData) {
      const transactionDataEntry = transactionData[transactionDataIndex]
      const { credentialId } = selectedTransactionDataCredentials[transactionDataIndex]

      if (!transactionDataEntry.transactionData.credential_ids.includes(credentialId)) {
        throw new CredoError(
          `Credential id '${credentialId}' selected to sign transaction data with index '${transactionDataIndex}' is not present in allowed credential ids for transaction. Allowed credential ids are ${transactionDataEntry.transactionData.credential_ids.join(', ')}`
        )
      }

      if (!selectedCredentials[credentialId]) {
        throw new CredoError(
          `Credential id '${credentialId}' selected to sign transaction data with index '${transactionDataIndex}', but credential is not included in the credentials for the presentation.`
        )
      }

      // NOTE: in the next releaes of DCQL this will also be an array, so this code can soon be simplified
      const credentialsForId = Array.isArray(selectedCredentials[credentialId])
        ? selectedCredentials[credentialId]
        : [selectedCredentials[credentialId]]

      const unsupportedFormats = credentialsForId
        .filter((c) => c.claimFormat !== ClaimFormat.SdJwtVc)
        .map((c) => c.claimFormat)

      if (unsupportedFormats.length > 0) {
        throw new CredoError(
          `Credential id '${credentialId}' selected to sign transaction data with index '${transactionDataIndex}' unsupported format(s) ${unsupportedFormats.join(', ')}. Only '${ClaimFormat.SdJwtVc}' is supported for transaction data signing in Credo at the moment.`
        )
      }

      if (!credentialsToTransactionData[credentialId]) {
        credentialsToTransactionData[credentialId] = []
      }
      credentialsToTransactionData[credentialId].push(transactionDataEntry)
    }

    const updatedCredentials = {
      ...selectedCredentials,
    }
    for (const [credentialId, entries] of Object.entries(credentialsToTransactionData)) {
      const allowedHashAlgs = entries.reduce<string[] | undefined>(
        (allowedHashValues, entry) =>
          (entry.transactionData.transaction_data_hashes_alg ?? ['sha-256']).filter(
            (value) => !allowedHashValues || allowedHashValues.includes(value)
          ),
        undefined
      )

      if (!allowedHashAlgs || allowedHashAlgs.length === 0) {
        throw new CredoError(
          `Unable to determine hash alg for credential with id '${credentialId}' and transaction data indexes ${entries.map((e) => e.transactionDataIndex).join(' ')}, no common 'transaction_data_hashes_alg' value found.`
        )
      }

      const supportedHashAlgs = ['sha-1', 'sha-256'] satisfies HashName[]
      const supportedAllowedHashAlgs = supportedHashAlgs.filter((alg) => allowedHashAlgs.includes(alg))
      if (supportedAllowedHashAlgs.length === 0) {
        throw new CredoError(
          `Unable to create transaction data hash for credential with id '${credentialId}' and transaction data indexes ${entries.map((e) => e.transactionDataIndex).join(' ')}. None of the common allowed hash algorithms is supported by Credo: ${allowedHashAlgs.join(', ')}. Supported hash algs are ${supportedHashAlgs.join(', ')}.`
        )
      }

      // Not required, but we include it by default as otherwise we need to look at all entries to
      // see if any specified an alg array
      const [transactionDataHahsesAlg] = supportedAllowedHashAlgs
      const transactionDataHashes = entries.map((entry) =>
        TypedArrayEncoder.toBase64URL(Hasher.hash(entry.encoded, transactionDataHahsesAlg))
      )

      const credentialsForId = Array.isArray(updatedCredentials[credentialId])
        ? updatedCredentials[credentialId]
        : [updatedCredentials[credentialId]]

      const updatedCredentialsForId = credentialsForId.map((credential) => {
        if (credential.claimFormat !== ClaimFormat.SdJwtVc) {
          // We already verified this above
          throw new CredoError(
            `Unexpected claim format '${credential.claimFormat}' for transaction data, expected '${ClaimFormat.SdJwtVc}'`
          )
        }

        return {
          ...credential,
          additionalPayload: {
            ...(credential.additionalPayload ?? {}),
            transaction_data_hashes: transactionDataHashes,
            transaction_data_hashes_alg: transactionDataHahsesAlg,
          },
        }
      })

      // Will soon be simplified once DCQL also uses array
      updatedCredentials[credentialId] = Array.isArray(updatedCredentials[credentialId])
        ? updatedCredentialsForId
        : updatedCredentialsForId[0]
    }

    return updatedCredentials
  }

  public async acceptAuthorizationRequest(
    agentContext: AgentContext,
    options: OpenId4VpAcceptAuthorizationRequestOptions
  ) {
    const { authorizationRequestPayload, presentationExchange, dcql, transactionData } = options

    const openid4vpClient = this.getOpenid4vpClient(agentContext)
    const authorizationResponseNonce = await agentContext.wallet.generateNonce()
    const { nonce } = authorizationRequestPayload
    const parsedClientId = getOpenid4vpClientId({ authorizationRequestPayload, origin: options.origin })
    // If client_id_scheme was used we need to use the legacy client id.
    const clientId = parsedClientId.legacyClientId ?? parsedClientId.clientId

    let openid4vpOptions: MdocOpenId4VpSessionTranscriptOptions | MdocOpenId4VpDcApiSessionTranscriptOptions
    if (isOpenid4vpAuthorizationRequestDcApi(authorizationRequestPayload)) {
      if (!options.origin) {
        throw new CredoError('Missing required parameter `origin` parameter for accepting openid4vp dc api requests.')
      }
      openid4vpOptions = { type: 'openId4VpDcApi', clientId, origin: options.origin, verifierGeneratedNonce: nonce }
    } else {
      const responseUri = authorizationRequestPayload.response_uri ?? authorizationRequestPayload.redirect_uri
      if (!responseUri) {
        throw new CredoError(
          'Missing required parameter `response_uri` or `redirect_uri` in the authorization request.'
        )
      }

      openid4vpOptions = {
        type: 'openId4Vp',
        mdocGeneratedNonce: authorizationResponseNonce,
        responseUri,
        clientId,
        verifierGeneratedNonce: nonce,
      }
    }

    let vpToken: VpToken
    let presentationSubmission: DifPresentationExchangeSubmission | undefined = undefined

    const parsedTransactionData = authorizationRequestPayload.transaction_data
      ? parseTransactionData({
          transactionData: authorizationRequestPayload.transaction_data,
        })
      : undefined

    // Handle presentation exchange part
    if (authorizationRequestPayload.presentation_definition || presentationExchange) {
      if (!presentationExchange) {
        throw new CredoError(
          'Authorization request included presentation definition. `presentationExchange` MUST be supplied to accept authorization requests.'
        )
      }
      if (!authorizationRequestPayload.presentation_definition) {
        throw new CredoError(
          '`presentationExchange` was supplied, but no presentation definition was found in the presentation request.'
        )
      }

      const credentialsWithTransactionData = this.extendCredentialsWithTransactionDataHashes(
        presentationExchange.credentials,
        parsedTransactionData,
        transactionData
      )

      const { presentationSubmission: _presentationSubmission, encodedVerifiablePresentations } =
        await this.presentationExchangeService.createPresentation(agentContext, {
          credentialsForInputDescriptor: credentialsWithTransactionData,
          presentationDefinition:
            authorizationRequestPayload.presentation_definition as unknown as DifPresentationExchangeDefinition,
          challenge: nonce,
          domain: clientId,
          presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.EXTERNAL,
          openid4vp: openid4vpOptions,
        })

      vpToken =
        encodedVerifiablePresentations.length === 1 && _presentationSubmission?.descriptor_map[0]?.path === '$'
          ? encodedVerifiablePresentations[0]
          : encodedVerifiablePresentations
      presentationSubmission = _presentationSubmission
    } else if (authorizationRequestPayload.dcql_query || dcql) {
      if (!authorizationRequestPayload.dcql_query) {
        throw new CredoError(`'dcql' was supplied, but no dcql request was found in the presentation request.`)
      }
      if (!dcql) {
        throw new CredoError(
          `Authorization request included dcql request. 'dcql' MUST be supplied to accept authorization requests.`
        )
      }

      const credentialsWithTransactionData = this.extendCredentialsWithTransactionDataHashes(
        dcql.credentials,
        parsedTransactionData,
        transactionData
      )

      const { encodedDcqlPresentation } = await this.dcqlService.createPresentation(agentContext, {
        credentialQueryToCredential: credentialsWithTransactionData,
        challenge: nonce,
        domain: clientId,
        openid4vp: openid4vpOptions,
      })

      vpToken = encodedDcqlPresentation
    } else {
      throw new CredoError('Either pex or dcql must be provided')
    }

    const response = await openid4vpClient.createOpenid4vpAuthorizationResponse({
      authorizationRequestPayload,
      authorizationResponsePayload: {
        vp_token: vpToken,
        presentation_submission: presentationSubmission,
      },
      jarm:
        authorizationRequestPayload.response_mode && isJarmResponseMode(authorizationRequestPayload.response_mode)
          ? {
              encryption: { nonce: authorizationResponseNonce },
              serverMetadata: {
                authorization_signing_alg_values_supported: [],
                authorization_encryption_alg_values_supported: ['ECDH-ES'],
                authorization_encryption_enc_values_supported: ['A128GCM', 'A256GCM', 'A128CBC-HS256'],
              },
            }
          : undefined,
    })

    const authorizationResponsePayload = response.authorizationResponsePayload as Openid4vpAuthorizationResponse & {
      presentation_submission?: DifPresentationExchangeSubmission
    }
    const authorizationResponse = response.jarm?.responseJwt
      ? { response: response.jarm.responseJwt }
      : authorizationResponsePayload

    // TODO: we should include more typing here that the user
    // still needs to submit the response. or as we discussed, split
    // this method up in create and submit
    if (isOpenid4vpAuthorizationRequestDcApi(authorizationRequestPayload)) {
      return {
        ok: true,
        authorizationResponse,
        authorizationResponsePayload,
      } as const
    }

    // TODO: parse response in openi4vp library so we can have typed error
    // as well as typed response (with redirect_uri/presentation_during_issuance_session)
    const result = await openid4vpClient.submitOpenid4vpAuthorizationResponse({
      authorizationRequestPayload,
      authorizationResponsePayload: response.authorizationResponsePayload,
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
        authorizationResponse,
        authorizationResponsePayload,
      } as const
    }

    return {
      ok: true,
      serverResponse: {
        status: result.response.status,
        body: responseJson ?? {},
      },
      authorizationResponse,
      authorizationResponsePayload,
      redirectUri: responseJson?.redirect_uri as string | undefined,
      presentationDuringIssuanceSession: responseJson?.presentation_during_issuance_session as string | undefined,
    } as const
  }
}
