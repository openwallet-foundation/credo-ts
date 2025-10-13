import type {
  AgentContext,
  DcqlCredentialsForRequest,
  DifPexInputDescriptorToCredentials,
  DifPresentationExchangeDefinition,
  DifPresentationExchangeSubmission,
  EncodedX509Certificate,
  HashName,
  MdocSessionTranscriptOptions,
} from '@credo-ts/core'
import {
  ClaimFormat,
  CredoError,
  DcqlService,
  DifPresentationExchangeService,
  DifPresentationExchangeSubmissionLocation,
  Hasher,
  injectable,
  Kms,
  TypedArrayEncoder,
} from '@credo-ts/core'
import type { Jwk } from '@openid4vc/oauth2'
import {
  extractEncryptionJwkFromJwks,
  getOpenid4vpClientId,
  isJarmResponseMode,
  isOpenid4vpAuthorizationRequestDcApi,
  type Openid4vpAuthorizationResponse,
  Openid4vpClient,
  parseAuthorizationRequestVersion,
  parseTransactionData,
  type VpToken,
} from '@openid4vc/openid4vp'
import type { OpenId4VpVersion } from '../openid4vc-verifier'
import { getOid4vcCallbacks } from '../shared/callbacks'
import type {
  OpenId4VpAcceptAuthorizationRequestOptions,
  OpenId4VpResolvedAuthorizationRequest,
  ParsedTransactionDataEntry,
  ResolveOpenId4VpAuthorizationRequestOptions,
} from './OpenId4vpHolderServiceOptions'

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

    // for each transaction data entry, get all credentials that can fore used to sign the respective transaction
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

    // Prefix on client is normalized, so also includes did/web-orgin
    if (
      client.prefix !== 'x509_san_dns' &&
      client.prefix !== 'x509_hash' &&
      client.prefix !== 'decentralized_identifier' &&
      client.prefix !== 'origin' &&
      client.prefix !== 'redirect_uri'
    ) {
      throw new CredoError(`Client id prefix '${client.prefix}' is not supported`)
    }

    const returnValue = {
      authorizationRequestPayload: verifiedAuthorizationRequest.authorizationRequestPayload,
      origin: options?.origin,
      signedAuthorizationRequest: verifiedAuthorizationRequest.jar
        ? {
            signer: verifiedAuthorizationRequest.jar?.signer,
            payload: verifiedAuthorizationRequest.jar.jwt.payload,
            header: verifiedAuthorizationRequest.jar.jwt.header,
          }
        : undefined,
    }

    const pexResult = pex?.presentation_definition
      ? await this.handlePresentationExchangeRequest(agentContext, pex.presentation_definition, transactionData)
      : undefined

    const dcqlResult = dcql?.query ? await this.handleDcqlRequest(agentContext, dcql.query, transactionData) : undefined

    agentContext.config.logger.debug('verified Authorization Request')
    agentContext.config.logger.debug(`request '${authorizationRequest}'`)

    return {
      ...returnValue,
      verifier: {
        clientIdPrefix: client.prefix,
        effectiveClientId: client.effective,
      },
      transactionData: pexResult?.matchedTransactionData ?? dcqlResult?.matchedTransactionData,
      presentationExchange: pexResult?.pex,
      dcql: dcqlResult?.dcql,
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

    transactionData.forEach((transactionDataEntry, transactionDataIndex) => {
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

      const unsupportedFormats = selectedCredentials[credentialId]
        .filter((c) => c.claimFormat !== ClaimFormat.SdJwtDc)
        .map((c) => c.claimFormat)

      if (unsupportedFormats.length > 0) {
        throw new CredoError(
          `Credential id '${credentialId}' selected to sign transaction data with index '${transactionDataIndex}' unsupported format(s) ${unsupportedFormats.join(', ')}. Only '${ClaimFormat.SdJwtDc}' is supported for transaction data signing in Credo at the moment.`
        )
      }

      if (!credentialsToTransactionData[credentialId]) {
        credentialsToTransactionData[credentialId] = []
      }
      credentialsToTransactionData[credentialId].push(transactionDataEntry)
    })

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

      updatedCredentials[credentialId] = updatedCredentials[credentialId].map((credential) => {
        if (credential.claimFormat !== ClaimFormat.SdJwtDc) {
          // We already verified this above
          throw new CredoError(
            `Unexpected claim format '${credential.claimFormat}' for transaction data, expected '${ClaimFormat.SdJwtDc}'`
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
    }

    return updatedCredentials
  }

  public async acceptAuthorizationRequest(
    agentContext: AgentContext,
    options: OpenId4VpAcceptAuthorizationRequestOptions
  ) {
    const kms = agentContext.resolve(Kms.KeyManagementApi)
    const { authorizationRequestPayload, presentationExchange, dcql, transactionData } = options

    const openid4vpClient = this.getOpenid4vpClient(agentContext)
    const authorizationResponseNonce = TypedArrayEncoder.toBase64URL(kms.randomBytes({ length: 32 }))
    const { nonce } = authorizationRequestPayload

    let openid4vpVersionNumber = parseAuthorizationRequestVersion(authorizationRequestPayload)

    // It's hard to detect draft 24 for x509_san_dns/unsigned dc-api. In draft 27 a new vp_formats structure was introduced
    // so if the client id prefix is 'x509_san_dns' or there's no client_id and still uses the old vp_formats structure, we parse it
    // as draft 24 (to at least ensure compatibility with credo)
    if (
      openid4vpVersionNumber >= 24 &&
      openid4vpVersionNumber < 27 &&
      (!authorizationRequestPayload.client_id || authorizationRequestPayload.client_id?.startsWith('x509_san_dns:'))
    ) {
      openid4vpVersionNumber = 24
    }

    // We mainly support draft 21/24 and 1.0, but we try to parse in-between versions
    // as one of the supported versions, to not throw errors even before trying.
    const openid4vpVersion: OpenId4VpVersion =
      openid4vpVersionNumber > 24 ? 'v1' : openid4vpVersionNumber <= 21 ? 'v1.draft21' : 'v1.draft24'

    const parsedClientId = getOpenid4vpClientId({
      responseMode: authorizationRequestPayload.response_mode,
      clientId: authorizationRequestPayload.client_id,
      legacyClientIdScheme: authorizationRequestPayload.client_id_scheme,
      origin: options.origin,
      version: openid4vpVersionNumber,
    })

    const clientId = parsedClientId.effectiveClientId
    const isDcApiRequest = isOpenid4vpAuthorizationRequestDcApi(authorizationRequestPayload)

    const shouldEncryptResponse =
      authorizationRequestPayload.response_mode && isJarmResponseMode(authorizationRequestPayload.response_mode)

    // TODO: we should return the effectiveAudience in the returned value of openid4vp lib
    // Since it differs based on the version of openid4vp used
    // NOTE: in v1 DC API request the audience is always origin: (not the client id)
    const audience = openid4vpVersion === 'v1' && isDcApiRequest ? `origin:${options.origin}` : clientId

    let encryptionJwk: Jwk | undefined
    if (shouldEncryptResponse) {
      // NOTE: Once we add support for federation we need to require the clientMetadata as input to the accept method.
      const clientMetadata = authorizationRequestPayload.client_metadata

      if (!clientMetadata) {
        throw new CredoError(
          "Authorization request payload does not contain 'client_metadata' needed to extract response encryption JWK."
        )
      }
      if (!clientMetadata.jwks) {
        throw new CredoError(
          "Authorization request payload 'client_metadata' does not contain 'jwks' needed to extract response encryption JWK."
        )
      }

      encryptionJwk = extractEncryptionJwkFromJwks(clientMetadata.jwks, {
        supportedAlgValues: ['ECDH-ES'],
      })

      if (!encryptionJwk) {
        throw new CredoError("Unable to extract encryption JWK from 'client_metadata' for supported alg 'ECDH-ES'")
      }
    }

    let mdocSessionTranscript: MdocSessionTranscriptOptions
    if (isOpenid4vpAuthorizationRequestDcApi(authorizationRequestPayload)) {
      if (!options.origin) {
        throw new CredoError('Missing required parameter `origin` parameter for accepting openid4vp dc api requests.')
      }

      if (openid4vpVersion === 'v1') {
        mdocSessionTranscript = {
          type: 'openId4VpDcApi',
          origin: options.origin,
          verifierGeneratedNonce: nonce,
          encryptionJwk: encryptionJwk ? Kms.PublicJwk.fromUnknown(encryptionJwk) : undefined,
        }
      } else {
        mdocSessionTranscript = {
          type: 'openId4VpDcApiDraft24',
          clientId,
          origin: options.origin,
          verifierGeneratedNonce: nonce,
        }
      }
    } else {
      const responseUri = authorizationRequestPayload.response_uri ?? authorizationRequestPayload.redirect_uri
      if (!responseUri) {
        throw new CredoError(
          'Missing required parameter `response_uri` or `redirect_uri` in the authorization request.'
        )
      }

      if (openid4vpVersion === 'v1') {
        mdocSessionTranscript = {
          type: 'openId4Vp',
          responseUri,
          clientId,
          verifierGeneratedNonce: nonce,
          encryptionJwk: encryptionJwk ? Kms.PublicJwk.fromUnknown(encryptionJwk) : undefined,
        }
      } else {
        mdocSessionTranscript = {
          type: 'openId4VpDraft18',
          mdocGeneratedNonce: authorizationResponseNonce,
          responseUri,
          clientId,
          verifierGeneratedNonce: nonce,
        }
      }
    }

    let vpToken: VpToken
    let presentationSubmission: DifPresentationExchangeSubmission | undefined

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
          domain: audience,
          presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.EXTERNAL,
          mdocSessionTranscript: mdocSessionTranscript,
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
        domain: audience,
        mdocSessionTranscript: mdocSessionTranscript,
      })

      vpToken = encodedDcqlPresentation

      // Pre 1.0 the vp_token directly maps from query id to presentation instead of array
      if (openid4vpVersion !== 'v1') {
        vpToken = Object.fromEntries(
          Object.entries(encodedDcqlPresentation).map(([credentialQueryId, presentations]) => {
            if (presentations.length > 1) {
              throw new CredoError(
                `Multiple presentations for a single dcql query credential are not supported when using OpenID4VP version '${openid4vpVersion}'.`
              )
            }

            return [credentialQueryId, presentations[0]]
          })
        )
      }
    } else {
      throw new CredoError('Either pex or dcql must be provided')
    }

    const response = await openid4vpClient.createOpenid4vpAuthorizationResponse({
      authorizationRequestPayload,
      origin: options.origin,
      authorizationResponsePayload: {
        vp_token: vpToken,
        presentation_submission: presentationSubmission,
      },
      jarm: encryptionJwk
        ? {
            encryption: { nonce: authorizationResponseNonce, jwk: encryptionJwk },
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
