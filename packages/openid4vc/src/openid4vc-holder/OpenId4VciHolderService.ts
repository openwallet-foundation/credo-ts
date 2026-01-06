import {
  AgentContext,
  CredoError,
  DidsApi,
  InjectionSymbols,
  inject,
  injectable,
  Kms,
  type Logger,
  Mdoc,
  MdocApi,
  MdocRecord,
  type MdocRecordInstances,
  parseDid,
  replaceError,
  SdJwtVcApi,
  SdJwtVcRecord,
  type SdJwtVcRecordInstances,
  SignatureSuiteRegistry,
  TypedArrayEncoder,
  W3cCredentialRecord,
  type W3cCredentialRecordInstances,
  W3cCredentialService,
  W3cJsonLdCredentialService,
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
  W3cV2CredentialRecord,
  type W3cV2CredentialRecordInstances,
  W3cV2CredentialService,
  W3cV2SdJwtVerifiableCredential,
} from '@credo-ts/core'
import {
  type AccessTokenResponse,
  type AuthorizationErrorResponse,
  authorizationCodeGrantIdentifier,
  type CallbackContext,
  clientAuthenticationAnonymous,
  clientAuthenticationClientAttestationJwt,
  clientAuthenticationNone,
  getAuthorizationServerMetadataFromList,
  type Jwk,
  Oauth2Client,
  Oauth2ServerErrorResponseError,
  preAuthorizedCodeGrantIdentifier,
  type RequestDpopOptions,
  refreshTokenGrantIdentifier,
} from '@openid4vc/oauth2'
import {
  AuthorizationFlow,
  type CredentialResponse,
  type DeferredCredentialResponse,
  determineAuthorizationServerForCredentialOffer,
  type IssuerMetadataResult,
  Openid4vciClient,
  Openid4vciRetrieveCredentialsError,
  Openid4vciVersion,
  parseKeyAttestationJwt,
} from '@openid4vc/openid4vci'
import type { OpenId4VciCredentialConfigurationSupportedWithFormats, OpenId4VciMetadata } from '../shared'

import { OpenId4VciCredentialFormatProfile } from '../shared'
import { getOid4vcCallbacks } from '../shared/callbacks'
import { getOfferedCredentials, getScopesFromCredentialConfigurationsSupported } from '../shared/issuerMetadataUtils'
import { getSupportedJwaSignatureAlgorithms } from '../shared/utils'
import type {
  OpenId4VciAcceptCredentialOfferOptions,
  OpenId4VciAuthCodeFlowOptions,
  OpenId4VciCredentialBindingResolver,
  OpenId4VciCredentialResponse,
  OpenId4VciDeferredCredentialRequestOptions,
  OpenId4VciDeferredCredentialResponse,
  OpenId4VciDpopRequestOptions,
  OpenId4VciProofOfPossessionRequirements,
  OpenId4VciResolvedAuthorizationRequest,
  OpenId4VciResolvedCredentialOffer,
  OpenId4VciRetrieveAuthorizationCodeUsingPresentationOptions,
  OpenId4VciSendNotificationOptions,
  OpenId4VciSupportedCredentialFormats,
  OpenId4VciTokenRefreshOptions,
  OpenId4VciTokenRequestOptions,
  OpenId4VcParseAndVerifyAuthorizationResponseOptions,
} from './OpenId4VciHolderServiceOptions'
import { openId4VciSupportedCredentialFormats } from './OpenId4VciHolderServiceOptions'

@injectable()
export class OpenId4VciHolderService {
  private logger: Logger
  private w3cCredentialService: W3cCredentialService
  private w3cV2CredentialService: W3cV2CredentialService

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    w3cCredentialService: W3cCredentialService,
    w3cV2CredentialService: W3cV2CredentialService
  ) {
    this.w3cCredentialService = w3cCredentialService
    this.w3cV2CredentialService = w3cV2CredentialService
    this.logger = logger
  }

  public async resolveIssuerMetadata(
    agentContext: AgentContext,
    credentialIssuer: string
  ): Promise<OpenId4VciMetadata> {
    const client = this.getClient(agentContext)

    const metadata = await client.resolveIssuerMetadata(credentialIssuer)
    this.logger.debug('fetched credential issuer metadata', { metadata })

    return metadata
  }

  public async resolveCredentialOffer(
    agentContext: AgentContext,
    credentialOffer: string
  ): Promise<OpenId4VciResolvedCredentialOffer> {
    const client = this.getClient(agentContext)

    const credentialOfferObject = await client.resolveCredentialOffer(credentialOffer)
    const metadata = await client.resolveIssuerMetadata(credentialOfferObject.credential_issuer)
    this.logger.debug('fetched credential offer and issuer metadata', { metadata, credentialOfferObject })

    const credentialConfigurationsSupported = getOfferedCredentials(
      credentialOfferObject.credential_configuration_ids,
      metadata.knownCredentialConfigurations,
      // We only filter for known configurations, so it's ok if not found
      { ignoreNotFoundIds: true }
    )

    return {
      metadata,
      offeredCredentialConfigurations: credentialConfigurationsSupported,
      credentialOfferPayload: credentialOfferObject,
    }
  }

  public async resolveAuthorizationRequest(
    agentContext: AgentContext,
    resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer,
    authCodeFlowOptions: OpenId4VciAuthCodeFlowOptions
  ): Promise<OpenId4VciResolvedAuthorizationRequest> {
    const { clientId, redirectUri } = authCodeFlowOptions
    const { metadata, credentialOfferPayload, offeredCredentialConfigurations } = resolvedCredentialOffer

    const oauth2Client = this.getOauth2Client(agentContext)
    const client = this.getClient(agentContext, {
      clientId: authCodeFlowOptions.clientId,
      clientAttestation: authCodeFlowOptions.walletAttestationJwt,
    })

    // If scope is not provided, we request scope for all offered credentials
    const scope =
      authCodeFlowOptions.scope ?? getScopesFromCredentialConfigurationsSupported(offeredCredentialConfigurations)

    if (!credentialOfferPayload.grants?.[authorizationCodeGrantIdentifier]) {
      throw new CredoError(`Provided credential offer does not include the 'authorization_code' grant.`)
    }

    const authorizationCodeGrant = credentialOfferPayload.grants[authorizationCodeGrantIdentifier]
    const authorizationServer = determineAuthorizationServerForCredentialOffer({
      issuerMetadata: metadata,
      grantAuthorizationServer: authorizationCodeGrant.authorization_server,
    })

    const authorizationServerMetadata = getAuthorizationServerMetadataFromList(
      metadata.authorizationServers,
      authorizationServer
    )

    // TODO: should we allow key reuse between dpop and wallet attestation?
    const isDpopSupported = oauth2Client.isDpopSupported({ authorizationServerMetadata })
    const dpop = isDpopSupported.supported
      ? await this.getDpopOptions(agentContext, {
          dpopSigningAlgValuesSupported: isDpopSupported.dpopSigningAlgValuesSupported,
        })
      : undefined

    const authorizationResult = await client.initiateAuthorization({
      clientId,
      issuerMetadata: metadata,
      credentialOffer: credentialOfferPayload,
      scope: scope.join(' '),
      redirectUri,
      dpop,
    })

    if (authorizationResult.authorizationFlow === AuthorizationFlow.PresentationDuringIssuance) {
      return {
        authorizationFlow: AuthorizationFlow.PresentationDuringIssuance,
        openid4vpRequestUrl: authorizationResult.openid4vpRequestUrl,
        authSession: authorizationResult.authSession,
        // FIXME: return dpop result from this endpoint (dpop nonce)
        dpop: dpop
          ? {
              alg: dpop.signer.alg as Kms.KnownJwaSignatureAlgorithm,
              jwk: Kms.PublicJwk.fromUnknown(dpop.signer.publicJwk),
            }
          : undefined,
      }
    }

    // Normal Oauth2Redirect flow
    return {
      authorizationFlow: AuthorizationFlow.Oauth2Redirect,
      codeVerifier: authorizationResult.pkce?.codeVerifier,
      authorizationRequestUrl: authorizationResult.authorizationRequestUrl,
      // FIXME: return dpop result from this endpoint (dpop nonce)
      dpop: dpop
        ? {
            alg: dpop.signer.alg as Kms.KnownJwaSignatureAlgorithm,
            jwk: Kms.PublicJwk.fromUnknown(dpop.signer.publicJwk),
          }
        : undefined,
    }
  }

  public async sendNotification(agentContext: AgentContext, options: OpenId4VciSendNotificationOptions) {
    const client = this.getClient(agentContext)
    await client.sendNotification({
      accessToken: options.accessToken,
      dpop: options.dpop
        ? await this.getDpopOptions(agentContext, {
            ...options.dpop,
            dpopSigningAlgValuesSupported: [options.dpop.alg],
          })
        : undefined,
      issuerMetadata: options.metadata,
      notification: {
        event: options.notificationEvent,
        notificationId: options.notificationId,
      },
    })
  }

  private async getDpopOptions(
    agentContext: AgentContext,
    {
      jwk,
      dpopSigningAlgValuesSupported,
      nonce,
    }: { dpopSigningAlgValuesSupported: string[]; jwk?: Kms.PublicJwk; nonce?: string }
  ): Promise<RequestDpopOptions> {
    const kms = agentContext.resolve(Kms.KeyManagementApi)

    if (jwk) {
      const alg = dpopSigningAlgValuesSupported.find((alg) =>
        jwk.supportedSignatureAlgorithms.includes(alg as Kms.KnownJwaSignatureAlgorithm)
      )

      if (!alg) {
        throw new CredoError(
          `No supported dpop signature algorithms found in dpop_signing_alg_values_supported '${dpopSigningAlgValuesSupported.join(
            ', '
          )}' matching jwk ${jwk.jwkTypeHumanDescription}`
        )
      }

      return {
        signer: {
          method: 'jwk',
          alg,
          publicJwk: jwk.toJson() as Jwk,
        },
        nonce,
      }
    }

    const alg = dpopSigningAlgValuesSupported.find((algorithm): algorithm is Kms.KnownJwaSignatureAlgorithm => {
      try {
        Kms.PublicJwk.supportedPublicJwkClassForSignatureAlgorithm(algorithm as Kms.KnownJwaSignatureAlgorithm)

        // TODO: we should allow providing allowed backends to OID4VC API so you can limit which
        // KMS backends can be used for DPOP
        const supportedBackends = kms.supportedBackendsForOperation({
          operation: 'sign',
          algorithm: algorithm as Kms.KnownJwaSignatureAlgorithm,
        })
        return supportedBackends.length > 0
      } catch {
        return false
      }
    })

    if (!alg) {
      throw new CredoError(
        `No supported dpop signature algorithms found in dpop_signing_alg_values_supported '${dpopSigningAlgValuesSupported.join(
          ', '
        )}'`
      )
    }

    const key = await kms.createKeyForSignatureAlgorithm({ algorithm: alg })
    return {
      signer: {
        method: 'jwk',
        alg,
        publicJwk: key.publicJwk as Jwk,
      },
      nonce,
    }
  }

  public async retrieveAuthorizationCodeUsingPresentation(
    agentContext: AgentContext,
    options: OpenId4VciRetrieveAuthorizationCodeUsingPresentationOptions
  ): Promise<{
    authorizationCode: string
    dpop?: OpenId4VciDpopRequestOptions
  }> {
    const client = this.getClient(agentContext, {
      clientAttestation: options.walletAttestationJwt,
    })
    const dpop = options.dpop
      ? await this.getDpopOptions(agentContext, {
          ...options.dpop,
          dpopSigningAlgValuesSupported: [options.dpop.alg],
        })
      : undefined

    const { authorizationChallengeResponse, dpop: dpopResult } =
      await client.retrieveAuthorizationCodeUsingPresentation({
        authSession: options.authSession,
        presentationDuringIssuanceSession: options.presentationDuringIssuanceSession,
        credentialOffer: options.resolvedCredentialOffer.credentialOfferPayload,
        issuerMetadata: options.resolvedCredentialOffer.metadata,
        dpop,
      })

    return {
      authorizationCode: authorizationChallengeResponse.authorization_code,
      dpop: dpop
        ? {
            ...dpopResult,
            alg: dpop.signer.alg as Kms.KnownJwaSignatureAlgorithm,
            jwk: Kms.PublicJwk.fromUnknown(dpop.signer.publicJwk),
          }
        : undefined,
    }
  }

  public parseAuthorizationCodeFromAuthorizationResponse(
    agentContext: AgentContext,
    options: OpenId4VcParseAndVerifyAuthorizationResponseOptions
  ) {
    const { metadata, credentialOfferPayload } = options.resolvedCredentialOffer
    const client = this.getClient(agentContext)

    const authorizationServer = credentialOfferPayload.grants?.authorization_code?.authorization_server
    const authorizationServerMetadata = getAuthorizationServerMetadataFromList(
      metadata.authorizationServers,
      authorizationServer ?? metadata.authorizationServers[0].issuer
    )

    const authorizationResponse = client.parseAndVerifyAuthorizationResponseRedirectUrl({
      authorizationServerMetadata,
      url: options.authorizationResponseRedirectUrl,
    })

    if (!authorizationResponse.code) {
      throw new Oauth2ServerErrorResponseError(authorizationResponse as AuthorizationErrorResponse, {
        internalMessage: 'Error response received from the authorization server',
      })
    }

    return { authorizationCode: authorizationResponse.code }
  }

  public async requestAccessToken(
    agentContext: AgentContext,
    options: OpenId4VciTokenRequestOptions
  ): Promise<{
    authorizationServer: string
    accessTokenResponse: AccessTokenResponse
    dpop?: OpenId4VciDpopRequestOptions
  }> {
    const { metadata, credentialOfferPayload } = options.resolvedCredentialOffer
    const client = this.getClient(agentContext, {
      clientAttestation: options.walletAttestationJwt,
      clientId: 'clientId' in options ? options.clientId : undefined,
    })
    const oauth2Client = this.getOauth2Client(agentContext)

    const authorizationServer = options.code
      ? credentialOfferPayload.grants?.authorization_code?.authorization_server
      : credentialOfferPayload.grants?.[preAuthorizedCodeGrantIdentifier]?.authorization_server
    const authorizationServerMetadata = getAuthorizationServerMetadataFromList(
      metadata.authorizationServers,
      authorizationServer ?? metadata.authorizationServers[0].issuer
    )

    const isDpopSupported = oauth2Client.isDpopSupported({
      authorizationServerMetadata,
    })

    const dpop = options.dpop
      ? await this.getDpopOptions(agentContext, {
          ...options.dpop,
          dpopSigningAlgValuesSupported: [options.dpop.alg],
        })
      : // We should be careful about this case. It could just be the user didn't correctly
        // provide the DPoP from the auth response. In which case different DPoP will be used
        // However it might be that they only use DPoP for the token request (esp in pre-auth case)
        isDpopSupported.supported
        ? await this.getDpopOptions(agentContext, {
            dpopSigningAlgValuesSupported: isDpopSupported.dpopSigningAlgValuesSupported,
          })
        : undefined

    const result = options.code
      ? await client.retrieveAuthorizationCodeAccessTokenFromOffer({
          issuerMetadata: metadata,
          credentialOffer: credentialOfferPayload,
          authorizationCode: options.code,
          dpop,
          pkceCodeVerifier: options.codeVerifier,
          redirectUri: options.redirectUri,
        })
      : await client.retrievePreAuthorizedCodeAccessTokenFromOffer({
          credentialOffer: credentialOfferPayload,
          issuerMetadata: metadata,
          dpop,
          txCode: options.txCode,
        })

    return {
      ...result,
      dpop: dpop
        ? {
            ...result.dpop,
            alg: dpop.signer.alg as Kms.KnownJwaSignatureAlgorithm,
            jwk: Kms.PublicJwk.fromUnknown(dpop.signer.publicJwk),
          }
        : undefined,
    }
  }

  public async refreshAccessToken(
    agentContext: AgentContext,
    options: OpenId4VciTokenRefreshOptions
  ): Promise<
    // FIXME: export type in oid4vc library
    Omit<Awaited<ReturnType<Oauth2Client['retrieveRefreshTokenAccessToken']>>, 'dpop'> & {
      dpop?: OpenId4VciDpopRequestOptions
    }
  > {
    const oauth2Client = this.getOauth2Client(agentContext, {
      clientAttestation: options.walletAttestationJwt,
      clientId: options.clientId,
    })

    const dpop = options.dpop
      ? await this.getDpopOptions(agentContext, {
          ...options.dpop,
          dpopSigningAlgValuesSupported: [options.dpop.alg],
        })
      : undefined

    const authorizationServerMetadata = getAuthorizationServerMetadataFromList(
      options.issuerMetadata.authorizationServers,
      options.authorizationServer ?? options.issuerMetadata.authorizationServers[0].issuer
    )

    const result = await oauth2Client.retrieveRefreshTokenAccessToken({
      authorizationServerMetadata,
      refreshToken: options.refreshToken,
      dpop,
      resource: options.issuerMetadata.credentialIssuer.credential_issuer,
    })

    return {
      ...result,
      dpop: dpop
        ? {
            ...result.dpop,
            alg: dpop.signer.alg as Kms.KnownJwaSignatureAlgorithm,
            jwk: Kms.PublicJwk.fromUnknown(dpop.signer.publicJwk),
          }
        : undefined,
    }
  }

  public async acceptCredentialOffer(
    agentContext: AgentContext,
    options: {
      resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer
      acceptCredentialOfferOptions: OpenId4VciAcceptCredentialOfferOptions
      accessToken: string
      cNonce?: string
      dpop?: OpenId4VciDpopRequestOptions
      clientId?: string
    }
  ): Promise<{
    credentials: OpenId4VciCredentialResponse[]
    deferredCredentials: OpenId4VciDeferredCredentialResponse[]
    dpop?: OpenId4VciDpopRequestOptions
    cNonce?: string
  }> {
    const { resolvedCredentialOffer, acceptCredentialOfferOptions } = options
    const { metadata, offeredCredentialConfigurations } = resolvedCredentialOffer
    const {
      credentialConfigurationIds,
      credentialBindingResolver,
      verifyCredentialStatus,
      allowedProofOfPossessionSignatureAlgorithms,
    } = acceptCredentialOfferOptions
    const client = this.getClient(agentContext)

    if (credentialConfigurationIds?.length === 0) {
      throw new CredoError(`'credentialConfigurationIds' may not be empty`)
    }

    const receivedCredentials: Array<OpenId4VciCredentialResponse> = []
    const deferredCredentials: Array<OpenId4VciDeferredCredentialResponse> = []
    let cNonce = options.cNonce
    let dpopNonce = options.dpop?.nonce

    const credentialConfigurationsToRequest =
      credentialConfigurationIds?.map((id) => {
        if (!offeredCredentialConfigurations[id]) {
          const offeredCredentialIds = Object.keys(offeredCredentialConfigurations).join(', ')
          throw new CredoError(
            `Credential to request '${id}' is not present in offered credentials. Offered credentials are ${offeredCredentialIds}`
          )
        }
        return [id, offeredCredentialConfigurations[id]] as const
      }) ?? Object.entries(offeredCredentialConfigurations)

    // If we don't have a nonce yet, we need to first get one
    if (!cNonce) {
      // Best option is to use nonce endpoint (draft 14+)
      if (metadata.credentialIssuer.nonce_endpoint) {
        const nonceResponse = await client.requestNonce({ issuerMetadata: metadata })
        cNonce = nonceResponse.c_nonce
      } else {
        // Otherwise we will send a dummy request
        await client
          .retrieveCredentials({
            issuerMetadata: metadata,
            accessToken: options.accessToken,
            credentialConfigurationId: credentialConfigurationsToRequest[0][0],
            dpop: options.dpop
              ? await this.getDpopOptions(agentContext, {
                  ...options.dpop,
                  nonce: dpopNonce,
                  dpopSigningAlgValuesSupported: [options.dpop.alg],
                })
              : undefined,
          })
          .catch((e) => {
            if (e instanceof Openid4vciRetrieveCredentialsError && e.response.credentialErrorResponseResult?.success) {
              cNonce = e.response.credentialErrorResponseResult.data.c_nonce
            }
          })
      }
    }

    if (!cNonce) {
      throw new CredoError('No cNonce provided and unable to acquire cNonce from the credential issuer')
    }

    for (const [offeredCredentialId, offeredCredentialConfiguration] of credentialConfigurationsToRequest) {
      const { proofs, jwkThumbprintKmsKeyIdMapping } = await this.getCredentialRequestOptions(agentContext, {
        allowedProofOfPossessionAlgorithms:
          allowedProofOfPossessionSignatureAlgorithms ?? getSupportedJwaSignatureAlgorithms(agentContext),
        metadata,
        offeredCredential: {
          id: offeredCredentialId,
          configuration: offeredCredentialConfiguration,
        },
        clientId: options.clientId,
        // We already checked whether nonce exists above
        cNonce: cNonce as string,
        credentialBindingResolver,
      })

      this.logger.debug('Generated credential request proof of possession', { proofs })

      const proof =
        // Draft 11 ALWAYS uses proof
        (metadata.originalDraftVersion === Openid4vciVersion.Draft11 ||
          // Draft 14 allows both proof and proofs. Try to use proof when it makes to improve interoperability
          (metadata.originalDraftVersion === Openid4vciVersion.Draft14 &&
            metadata.credentialIssuer.batch_credential_issuance === undefined)) &&
        proofs.jwt?.length === 1
          ? ({
              proof_type: 'jwt',
              jwt: proofs.jwt[0],
            } as const)
          : undefined

      const { credentialResponse, dpop } = await client.retrieveCredentials({
        issuerMetadata: metadata,
        accessToken: options.accessToken,
        credentialConfigurationId: offeredCredentialId,
        dpop: options.dpop
          ? await this.getDpopOptions(agentContext, {
              ...options.dpop,
              nonce: dpopNonce,
              dpopSigningAlgValuesSupported: [options.dpop.alg],
            })
          : undefined,
        // Only include proofs if we don't add proof
        proofs: !proof ? proofs : undefined,
        proof,
      })

      // Set new nonce values
      cNonce = credentialResponse.c_nonce
      dpopNonce = dpop?.nonce

      if (credentialResponse.transaction_id) {
        const deferredCredential = {
          credentialConfigurationId: offeredCredentialId,
          credentialConfiguration: offeredCredentialConfiguration,
          transactionId: credentialResponse.transaction_id,
          interval: credentialResponse.interval,
          notificationId: credentialResponse.notification_id,
          jwkThumbprintKmsKeyIdMapping,
        }

        this.logger.debug('received deferred credential', deferredCredential)
        deferredCredentials.push(deferredCredential)
      } else {
        // Create credential, but we don't store it yet (only after the user has accepted the credential)
        const credential = await this.handleCredentialResponse(agentContext, credentialResponse, {
          verifyCredentialStatus: verifyCredentialStatus ?? false,
          format: offeredCredentialConfiguration.format as OpenId4VciCredentialFormatProfile,
          credentialConfigurationId: offeredCredentialId,
          credentialConfiguration: offeredCredentialConfiguration,
          jwkThumbprintKmsKeyIdMapping,
        })

        const firstCredential = credential.record.firstCredential
        this.logger.debug('received credential response', {
          firstCredential:
            firstCredential instanceof Mdoc
              ? {
                  issuerSignedNamespaces: firstCredential.issuerSignedNamespaces,
                  base64Url: firstCredential.base64Url,
                }
              : firstCredential,
          totalNumberOfCredentials: credential.record.credentialInstances.length,
        })
        receivedCredentials.push(credential)
      }
    }

    return {
      credentials: receivedCredentials,
      deferredCredentials,
      dpop: options.dpop
        ? {
            ...options.dpop,
            nonce: dpopNonce,
          }
        : undefined,
      cNonce,
    }
  }

  public async retrieveDeferredCredentials(
    agentContext: AgentContext,
    options: OpenId4VciDeferredCredentialRequestOptions
  ): Promise<{
    credentials: OpenId4VciCredentialResponse[]
    deferredCredentials: OpenId4VciDeferredCredentialResponse[]
    dpop?: OpenId4VciDpopRequestOptions
  }> {
    const {
      issuerMetadata,
      transactionId,
      credentialConfigurationId,
      credentialConfiguration,
      verifyCredentialStatus,
      accessToken,
      jwkThumbprintKmsKeyIdMapping,
    } = options
    const client = this.getClient(agentContext)

    const receivedCredentials: Array<OpenId4VciCredentialResponse> = []
    const deferredCredentials: Array<OpenId4VciDeferredCredentialResponse> = []
    let dpopNonce = options.dpop?.nonce

    const { deferredCredentialResponse, dpop } = await client.retrieveDeferredCredentials({
      issuerMetadata,
      accessToken,
      transactionId,
      dpop: options.dpop
        ? await this.getDpopOptions(agentContext, {
            ...options.dpop,
            nonce: dpopNonce,
            dpopSigningAlgValuesSupported: [options.dpop.alg],
          })
        : undefined,
    })

    // Set new nonce values
    dpopNonce = dpop?.nonce

    if (deferredCredentialResponse.interval) {
      const deferredCredential: OpenId4VciDeferredCredentialResponse = {
        credentialConfigurationId,
        credentialConfiguration,
        transactionId,
        interval: deferredCredentialResponse.interval,
        notificationId: deferredCredentialResponse.notification_id,
      }

      this.logger.debug('received deferred credential', deferredCredential)
      deferredCredentials.push(deferredCredential)
    } else {
      // Create credential, but we don't store it yet (only after the user has accepted the credential)
      const credential = await this.handleCredentialResponse(agentContext, deferredCredentialResponse, {
        verifyCredentialStatus: verifyCredentialStatus ?? false,
        format: credentialConfiguration.format as OpenId4VciCredentialFormatProfile,
        credentialConfigurationId: credentialConfigurationId,
        credentialConfiguration: credentialConfiguration,
        jwkThumbprintKmsKeyIdMapping,
      })

      const firstCredential = credential.record.firstCredential
      this.logger.debug('received credential response', {
        firstCredential:
          firstCredential instanceof Mdoc
            ? {
                issuerSignedNamespaces: firstCredential.issuerSignedNamespaces,
                base64Url: firstCredential.base64Url,
              }
            : firstCredential,
        totalNumberOfCredentials: credential.record.credentialInstances.length,
      })
      receivedCredentials.push(credential)
    }

    return {
      credentials: receivedCredentials,
      deferredCredentials,
      dpop: options.dpop
        ? {
            ...options.dpop,
            nonce: dpopNonce,
          }
        : undefined,
    }
  }

  /**
   * Get the options for the credential request. Internally this will resolve the proof of possession
   * requirements, and based on that it will call the proofOfPossessionVerificationMethodResolver to
   * allow the caller to select the correct verification method based on the requirements for the proof
   * of possession.
   */
  private async getCredentialRequestOptions(
    agentContext: AgentContext,
    options: {
      metadata: OpenId4VciResolvedCredentialOffer['metadata']
      credentialBindingResolver: OpenId4VciCredentialBindingResolver
      allowedProofOfPossessionAlgorithms: Kms.KnownJwaSignatureAlgorithm[]
      clientId?: string
      cNonce: string
      offeredCredential: {
        id: string
        configuration: OpenId4VciCredentialConfigurationSupportedWithFormats
      }
    }
  ) {
    const dids = agentContext.resolve(DidsApi)
    const { allowedProofOfPossessionAlgorithms, offeredCredential } = options
    const { configuration, id: configurationId } = offeredCredential
    const supportedJwaSignatureAlgorithms = getSupportedJwaSignatureAlgorithms(agentContext)

    const possibleProofOfPossessionSignatureAlgorithms = allowedProofOfPossessionAlgorithms
      ? allowedProofOfPossessionAlgorithms.filter((algorithm) => supportedJwaSignatureAlgorithms.includes(algorithm))
      : supportedJwaSignatureAlgorithms

    if (possibleProofOfPossessionSignatureAlgorithms.length === 0) {
      throw new CredoError(
        [
          'No possible proof of possession signature algorithm found.',
          `Signature algorithms supported by the Agent '${supportedJwaSignatureAlgorithms.join(', ')}'`,
          `Allowed Signature algorithms '${allowedProofOfPossessionAlgorithms?.join(', ')}'`,
        ].join('\n')
      )
    }

    const { proofTypes, supportedDidMethods, supportsAllDidMethods, supportsJwk } =
      this.getProofOfPossessionRequirements(agentContext, {
        credentialToRequest: options.offeredCredential,
        metadata: options.metadata,
        possibleProofOfPossessionSignatureAlgorithms,
      })

    const format = configuration.format satisfies `${OpenId4VciSupportedCredentialFormats}`
    const supportsAnyMethod = supportedDidMethods !== undefined || supportsAllDidMethods || supportsJwk
    const issuerMaxBatchSize = options.metadata.credentialIssuer.batch_credential_issuance?.batch_size ?? 1

    // Now we need to determine how the credential will be bound to us
    const credentialBinding = await options.credentialBindingResolver({
      agentContext,
      credentialFormat: format as OpenId4VciSupportedCredentialFormats,
      credentialConfigurationId: configurationId,
      credentialConfiguration: configuration,
      metadata: options.metadata,
      issuerMaxBatchSize,
      proofTypes,
      supportsAllDidMethods,
      supportedDidMethods,
      supportsJwk,
      cNonce: options.cNonce,
    })

    const client = this.getClient(agentContext)

    // Make sure the issuer of proof of possession is valid according to openid issuer metadata
    if (credentialBinding.method === 'did') {
      if (!proofTypes.jwt) {
        throw new CredoError(
          `JWT proof type is not supported for configuration '${configurationId}', which is required for did based credential binding.`
        )
      }

      if (proofTypes.jwt.keyAttestationsRequired) {
        throw new CredoError(
          `Credential binding returned list of DID urls, but credential configuration '${configurationId}' requires key attestations. Key attestations and DIDs are not compatible.`
        )
      }

      if (credentialBinding.didUrls.length > issuerMaxBatchSize) {
        throw new CredoError(
          `Issuer supports issuing a batch of maximum ${issuerMaxBatchSize} credential(s). Binding resolver returned ${credentialBinding.didUrls.length} DID urls. Make sure the returned value does not exceed the max batch issuance.`
        )
      }

      if (credentialBinding.didUrls.length === 0) {
        throw new CredoError('Credential binding with method did returned empty didUrls list')
      }

      const firstDid = parseDid(credentialBinding.didUrls[0])
      if (!credentialBinding.didUrls.every((didUrl) => parseDid(didUrl).method === firstDid.method)) {
        throw new CredoError('Expected all did urls for binding method did to use the same did method')
      }

      if (
        !supportsAllDidMethods &&
        // If supportedDidMethods is undefined, it means the issuer didn't include the binding methods in the metadata
        // The user can still select a verification method, but we can't validate it
        supportedDidMethods !== undefined &&
        !supportedDidMethods.find(
          (supportedDidMethod) => firstDid.did.startsWith(supportedDidMethod) && supportsAnyMethod
        )
      ) {
        // Test binding method
        const supportedDidMethodsString = supportedDidMethods.join(', ')
        throw new CredoError(
          `Resolved credential binding for proof of possession uses did method '${firstDid.method}', but issuer only supports '${supportedDidMethodsString}'`
        )
      }

      // DIDs and mDOC are not compatible
      if (configuration.format === 'mso_mdoc') {
        throw new CredoError("Using a did for credential binding is not supported for the 'mso_mdoc' format.")
      }

      const { publicJwk: firstKey } = await dids.resolveVerificationMethodFromCreatedDidRecord(firstDid.didUrl)
      const algorithm = proofTypes.jwt.supportedSignatureAlgorithms.find((algorithm) =>
        firstKey.supportedSignatureAlgorithms.includes(algorithm)
      )
      if (!algorithm) {
        throw new CredoError(
          `Credential binding returned did url that points to key '${firstKey.jwkTypeHumanDescription}' that supports signature algorithms ${firstKey.supportedSignatureAlgorithms.join(', ')}, but one of '${proofTypes.jwt.supportedSignatureAlgorithms.join(', ')}' was expected`
        )
      }

      // This will/should leverage the caching, so it's ok to resolve the did here
      const keys = await Promise.all(
        credentialBinding.didUrls.map(async (didUrl, index) =>
          index === 0
            ? // We already fetched the first did
              { jwk: firstKey, didUrl: firstDid.didUrl }
            : { jwk: (await dids.resolveVerificationMethodFromCreatedDidRecord(didUrl)).publicJwk, didUrl }
        )
      )
      if (!keys.every((key) => Kms.assymetricJwkKeyTypeMatches(key.jwk.toJson(), firstKey.toJson()))) {
        throw new CredoError('Expected all did urls to point to the same key type')
      }

      return {
        proofs: {
          jwt: await Promise.all(
            keys.map((key) =>
              client
                .createCredentialRequestJwtProof({
                  credentialConfigurationId: configurationId,
                  issuerMetadata: options.metadata,
                  signer: {
                    method: 'did',
                    didUrl: key.didUrl,
                    alg: algorithm,
                    kid: key.jwk.keyId,
                  },
                  nonce: options.cNonce,
                  clientId: options.clientId,
                })
                .then(({ jwt }) => jwt)
            )
          ),
        },
      }
    }

    if (credentialBinding.method === 'jwk') {
      if (!supportsJwk && supportsAnyMethod) {
        throw new CredoError(
          `Resolved credential binding for proof of possession uses jwk, but openid issuer does not support 'jwk' or 'cose_key' cryptographic binding method`
        )
      }

      // For W3C credentials (any variant) we only support binding to a DID.
      if (
        configuration.format === 'jwt_vc_json' ||
        configuration.format === 'jwt_vc_json-ld' ||
        configuration.format === 'ldp_vc' ||
        (configuration.format === 'vc+sd-jwt' && !configuration.vct)
      ) {
        throw new CredoError(
          `Using a JWK for credential binding is not supported for the '${configuration.format}' format.`
        )
      }

      if (!proofTypes.jwt) {
        throw new CredoError(
          `JWT proof type is not supported for configuration '${configurationId}', which is required for jwk based credential binding.`
        )
      }

      if (proofTypes.jwt.keyAttestationsRequired) {
        throw new CredoError(
          `Credential binding returned list of JWK keys, but credential configuration '${configurationId}' requires key attestations. Return a key attestation with binding method 'attestation'.`
        )
      }

      if (credentialBinding.keys.length > issuerMaxBatchSize) {
        throw new CredoError(
          `Issuer supports issuing a batch of maximum ${issuerMaxBatchSize} credential(s). Binding resolver returned ${credentialBinding.keys.length} keys. Make sure the returned value does not exceed the max batch issuance.`
        )
      }

      if (credentialBinding.keys.length === 0) {
        throw new CredoError('Credential binding with method jwk returned empty keys list')
      }

      const firstJwk = credentialBinding.keys[0]

      if (!credentialBinding.keys.every((key) => Kms.assymetricJwkKeyTypeMatches(key.toJson(), firstJwk.toJson()))) {
        throw new CredoError('Expected all keys for binding method jwk to use the same key type')
      }

      const algorithm = proofTypes.jwt.supportedSignatureAlgorithms.find((algorithm) =>
        firstJwk.supportedSignatureAlgorithms.includes(algorithm)
      )
      if (!algorithm) {
        throw new CredoError(
          `Credential binding returned jwk that points to key '${firstJwk.jwkTypeHumanDescription}' that supports signature algorithms ${firstJwk.supportedSignatureAlgorithms.join(', ')}, but one of '${proofTypes.jwt.supportedSignatureAlgorithms.join(', ')}' was expected`
        )
      }

      const jwkThumbprintKmsKeyIdMapping = Object.fromEntries(
        credentialBinding.keys.map((jwk) => [TypedArrayEncoder.toBase64(jwk.getJwkThumbprint()), jwk.keyId])
      )

      return {
        jwkThumbprintKmsKeyIdMapping,
        proofs: {
          jwt: await Promise.all(
            credentialBinding.keys.map((jwk) =>
              client
                .createCredentialRequestJwtProof({
                  credentialConfigurationId: configurationId,
                  issuerMetadata: options.metadata,
                  signer: {
                    method: 'jwk',
                    publicJwk: jwk.toJson() as Jwk,
                    alg: algorithm,
                  },
                  nonce: options.cNonce,
                  clientId: options.clientId,
                })
                .then(({ jwt }) => jwt)
            )
          ),
        },
      }
    }

    if (credentialBinding.method === 'attestation') {
      const { payload } = parseKeyAttestationJwt({ keyAttestationJwt: credentialBinding.keyAttestationJwt })

      // TODO: check client_id matches in payload

      if (payload.attested_keys.length > issuerMaxBatchSize) {
        throw new CredoError(
          `Issuer supports issuing a batch of maximum ${issuerMaxBatchSize} credential(s). Binding resolver returned key attestation with ${payload.attested_keys.length} attested keys. Make sure the returned value does not exceed the max batch issuance.`
        )
      }

      // NOTE: for now we require the attested_keys to include the `kid`. If that's not the case
      // it won't work. We can adjust this later to allow separately providing the jwkThumbprintKmsKeyIdMapping
      const jwkThumbprintKmsKeyIdMapping = Object.fromEntries(
        payload.attested_keys.map((jwk) => {
          const jwkInstance = Kms.PublicJwk.fromUnknown(jwk)
          return [TypedArrayEncoder.toBase64(jwkInstance.getJwkThumbprint()), jwkInstance.keyId]
        })
      )

      // TODO: check nonce matches cNonce. However you could separately fetch the nonce endpoint
      // (even from another server) when creating the key attestation, so it's maybe too limiting
      if (proofTypes.attestation && payload.nonce) {
        // If attestation is supported and the attestation contains a nonce, we can use the attestation directly
        return {
          proofs: {
            attestation: [credentialBinding.keyAttestationJwt],
          },
          jwkThumbprintKmsKeyIdMapping,
        }
      }

      if (proofTypes.jwt) {
        // NOTE: the nonce in the key attestation and the jwt proof MUST match, if the key attestation has a nonce.
        // To prevent errors we use the nonce from the key attestation if present, also for the jwt proof
        // It might be that during the creation on the key attestation the nonce endpoint was fetched separately.
        const nonce = payload.nonce ?? options.cNonce
        const jwk = Kms.PublicJwk.fromUnknown(payload.attested_keys[0])

        return {
          jwkThumbprintKmsKeyIdMapping,
          proofs: {
            jwt: [
              await client
                .createCredentialRequestJwtProof({
                  credentialConfigurationId: configurationId,
                  issuerMetadata: options.metadata,
                  signer: {
                    method: 'jwk',
                    publicJwk: payload.attested_keys[0],
                    // TODO: we should probably use the 'alg' from the jwk
                    alg: jwk.supportedSignatureAlgorithms[0],
                  },
                  keyAttestationJwt: credentialBinding.keyAttestationJwt,
                  nonce,
                  clientId: options.clientId,
                })
                .then(({ jwt }) => jwt),
            ],
          },
        }
      }

      throw new CredoError(
        `Unable to create credential request proofs. Configuration supports 'attestation' proof type, but attestation did not contain a 'nonce' value`
      )
    }

    // @ts-expect-error currently if/else if exhaustive, but once we add new option it will give ts error
    throw new CredoError(`Unsupported credential binding method ${credentialBinding.method}`)
  }

  /**
   * Get the requirements for creating the proof of possession. Based on the allowed
   * credential formats, the allowed proof of possession signature algorithms, and the
   * credential type, this method will select the best credential format and signature
   * algorithm to use, based on the order of preference.
   */
  private getProofOfPossessionRequirements(
    agentContext: AgentContext,
    options: {
      metadata: IssuerMetadataResult
      credentialToRequest: {
        id: string
        configuration: OpenId4VciCredentialConfigurationSupportedWithFormats
      }
      possibleProofOfPossessionSignatureAlgorithms: Kms.KnownJwaSignatureAlgorithm[]
    }
  ): OpenId4VciProofOfPossessionRequirements {
    const { credentialToRequest, possibleProofOfPossessionSignatureAlgorithms, metadata } = options
    const { configuration, id: configurationId } = credentialToRequest

    if (!openId4VciSupportedCredentialFormats.includes(configuration.format as OpenId4VciSupportedCredentialFormats)) {
      throw new CredoError(
        [
          `Requested credential with format '${credentialToRequest.configuration.format}',`,
          `for the credential with id '${credentialToRequest.id},`,
          `but the wallet only supports the following formats '${openId4VciSupportedCredentialFormats.join(', ')}'`,
        ].join('\n')
      )
    }

    // For each of the supported algs, find the key types, then find the proof types
    const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

    let proofTypesSupported = configuration.proof_types_supported
    if (!proofTypesSupported) {
      // For draft above 11 we do not allow no proof_type (we do not support no key binding for now)
      if (metadata.originalDraftVersion !== Openid4vciVersion.Draft11) {
        throw new CredoError(
          `Credential configuration '${configurationId}' does not specify proof_types_supported. Credentials not bound to keys are not supported at the moment`
        )
      }

      // For draft 11 we fall back to jwt proof type
      proofTypesSupported = {
        jwt: {
          proof_signing_alg_values_supported: possibleProofOfPossessionSignatureAlgorithms,
        },
      }
    }

    const proofTypes: OpenId4VciProofOfPossessionRequirements['proofTypes'] = {
      jwt: undefined,
      attestation: undefined,
    }

    for (const [proofType, proofTypeConfig] of Object.entries(proofTypesSupported)) {
      if (proofType !== 'jwt' && proofType !== 'attestation') continue

      let signatureAlgorithms: Kms.KnownJwaSignatureAlgorithm[] = []

      const proofSigningAlgsSupported = proofTypeConfig?.proof_signing_alg_values_supported
      if (proofSigningAlgsSupported === undefined) {
        // If undefined, it means the issuer didn't include the cryptographic suites in the metadata
        // We just guess that the first one is supported
        signatureAlgorithms = options.possibleProofOfPossessionSignatureAlgorithms
      } else {
        switch (credentialToRequest.configuration.format) {
          case OpenId4VciCredentialFormatProfile.JwtVcJson:
          case OpenId4VciCredentialFormatProfile.JwtVcJsonLd:
          case OpenId4VciCredentialFormatProfile.SdJwtVc:
          case OpenId4VciCredentialFormatProfile.SdJwtDc:
          case OpenId4VciCredentialFormatProfile.MsoMdoc:
            signatureAlgorithms = options.possibleProofOfPossessionSignatureAlgorithms.filter((signatureAlgorithm) =>
              proofSigningAlgsSupported.includes(signatureAlgorithm)
            )
            break
          // FIXME: this is wrong, as the proof type is separate from the credential signing alg
          // But there might be some draft 11 logic that depends on this, can be removed soon
          case OpenId4VciCredentialFormatProfile.LdpVc:
            signatureAlgorithms = options.possibleProofOfPossessionSignatureAlgorithms.filter((signatureAlgorithm) => {
              try {
                const jwkClass = Kms.PublicJwk.supportedPublicJwkClassForSignatureAlgorithm(signatureAlgorithm)
                const matchingSuites = signatureSuiteRegistry.getAllByPublicJwkType(jwkClass)
                if (matchingSuites.length === 0) return false

                return proofSigningAlgsSupported.includes(matchingSuites[0].proofType)
              } catch {
                return false
              }
            })
            break
          default:
            throw new CredoError('Unsupported credential format.')
        }
      }

      proofTypes[proofType] = {
        supportedSignatureAlgorithms: signatureAlgorithms,
        keyAttestationsRequired: proofTypeConfig.key_attestations_required
          ? {
              keyStorage: proofTypeConfig.key_attestations_required.key_storage,
              userAuthentication: proofTypeConfig.key_attestations_required.user_authentication,
            }
          : undefined,
      }
    }

    const { jwt, attestation } = proofTypes
    if (!jwt && !attestation) {
      const supported = Object.keys(proofTypesSupported).join(', ')
      throw new CredoError(`Unsupported proof type(s) ${supported}. Supported proof type(s) are: jwt, attestation`)
    }

    const issuerSupportedBindingMethods = credentialToRequest.configuration.cryptographic_binding_methods_supported
    const supportsAllDidMethods = issuerSupportedBindingMethods?.includes('did') ?? false
    const supportedDidMethods = issuerSupportedBindingMethods?.filter((method) => method.startsWith('did:'))

    // The cryptographic_binding_methods_supported describe the cryptographic key material that the issued Credential is bound to.
    const supportsCoseKey = issuerSupportedBindingMethods?.includes('cose_key') ?? false
    const supportsJwk = issuerSupportedBindingMethods?.includes('jwk') || supportsCoseKey

    return {
      proofTypes,
      supportedDidMethods,
      supportsAllDidMethods,
      supportsJwk,
    }
  }

  private async handleCredentialResponse(
    agentContext: AgentContext,
    credentialResponse: CredentialResponse | DeferredCredentialResponse,
    options: {
      verifyCredentialStatus: boolean
      format: OpenId4VciCredentialFormatProfile
      credentialConfigurationId: string
      credentialConfiguration: OpenId4VciCredentialConfigurationSupportedWithFormats
      jwkThumbprintKmsKeyIdMapping?: Record<string, string>
    }
  ): Promise<OpenId4VciCredentialResponse> {
    const { verifyCredentialStatus, credentialConfigurationId, credentialConfiguration } = options
    this.logger.debug('Credential response', credentialResponse)

    const credentials = credentialResponse.credentials
      ? credentialResponse.credentials.every((c) => typeof c === 'object' && c !== null && 'credential' in c)
        ? credentialResponse.credentials.map((c) => (c as { credential: string | Record<string, unknown> }).credential)
        : (credentialResponse.credentials as (string | Record<string, unknown>)[])
      : credentialResponse.credential
        ? [credentialResponse.credential as CredentialResponse['credential']]
        : undefined

    if (!credentials) {
      throw new CredoError(`Credential response returned neither 'credentials' nor 'credential' parameter.`)
    }

    const notificationId = credentialResponse.notification_id

    const format = options.format
    if (format === OpenId4VciCredentialFormatProfile.SdJwtVc || format === OpenId4VciCredentialFormatProfile.SdJwtDc) {
      if (!credentials.every((c) => typeof c === 'string')) {
        throw new CredoError(
          `Received credential(s) of format ${format}, but not all credential(s) are a string. ${JSON.stringify(
            credentials
          )}`
        )
      }
      // FIXME: we need to link the credential bound key back to the credential request
      // so we can store the correct `kmsKeyId` along with the SD-JWT VC for presentations
      if (format === OpenId4VciCredentialFormatProfile.SdJwtDc || credentialConfiguration.vct) {
        const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)
        const verificationResults = await Promise.all(
          credentials.map(async (compactSdJwtVc, index) => {
            const result = await sdJwtVcApi.verify({
              compactSdJwtVc,
              // Only load and verify it for the first instance
              fetchTypeMetadata: index === 0,
            })

            // Link key id with credential
            if (result.sdJwtVc?.holder?.method === 'jwk') {
              const jwkThumbprint = TypedArrayEncoder.toBase64(result.sdJwtVc.holder.jwk.getJwkThumbprint())
              const kmsKeyId = options.jwkThumbprintKmsKeyIdMapping?.[jwkThumbprint]
              if (!kmsKeyId) {
                throw new CredoError(
                  `Missing kmsKeyId for jwk with thumbprint ${jwkThumbprint}. A credential was issued for a key that was not in the credential request.`
                )
              }

              result.sdJwtVc.kmsKeyId = kmsKeyId
            }

            return result
          })
        )

        if (!verificationResults.every((result) => result.isValid)) {
          agentContext.config.logger.error('Failed to validate credential(s)', { verificationResults })
          throw new CredoError(
            `Failed to validate sd-jwt-vc credentials. Results = ${JSON.stringify(verificationResults, replaceError)}`
          )
        }

        return {
          record: new SdJwtVcRecord({
            credentialInstances: verificationResults.map((r) => ({
              compactSdJwtVc: r.sdJwtVc.compact,
              kmsKeyId: r.sdJwtVc.kmsKeyId,
            })) as SdJwtVcRecordInstances,
            typeMetadata: verificationResults[0].sdJwtVc.typeMetadata,
          }),
          notificationId,
          credentialConfigurationId,
          credentialConfiguration,
        }
      }

      const result = await Promise.all(
        credentials.map(async (c) => {
          const credential = W3cV2SdJwtVerifiableCredential.fromCompact(c)
          const result = await this.w3cV2CredentialService.verifyCredential(agentContext, {
            credential,
          })

          return { credential, result }
        })
      )

      if (!result.every((c) => c.result.isValid)) {
        agentContext.config.logger.error('Failed to validate credentials', { result })
        throw new CredoError(
          `Failed to validate credential, error = ${result
            .map((e) => e.result.error?.message)
            .filter(Boolean)
            .join(', ')}`
        )
      }

      return {
        record: new W3cV2CredentialRecord({
          credentialInstances: result.map((r) => ({
            credential: r.credential.encoded,
          })) as W3cV2CredentialRecordInstances,
        }),
        notificationId,
        credentialConfigurationId,
        credentialConfiguration,
      }
    }

    if (
      options.format === OpenId4VciCredentialFormatProfile.JwtVcJson ||
      options.format === OpenId4VciCredentialFormatProfile.JwtVcJsonLd
    ) {
      if (!credentials.every((c) => typeof c === 'string')) {
        throw new CredoError(
          `Received credential(s) of format ${format}, but not all credential(s) are a string. ${JSON.stringify(
            credentials
          )}`
        )
      }

      const result = await Promise.all(
        credentials.map(async (c) => {
          const credential = W3cJwtVerifiableCredential.fromSerializedJwt(c)
          const result = await this.w3cCredentialService.verifyCredential(agentContext, {
            credential,
            verifyCredentialStatus,
          })

          return { credential, result }
        })
      )

      if (!result.every((c) => c.result.isValid)) {
        agentContext.config.logger.error('Failed to validate credentials', { result })
        throw new CredoError(
          `Failed to validate credential, error = ${result
            .map((e) => e.result.error?.message)
            .filter(Boolean)
            .join(', ')}`
        )
      }

      return {
        record: new W3cCredentialRecord({
          credentialInstances: result.map((r) => ({
            credential: r.credential.encoded,
          })) as W3cCredentialRecordInstances,
          tags: {},
        }),
        notificationId,
        credentialConfigurationId,
        credentialConfiguration,
      }
    }

    if (format === OpenId4VciCredentialFormatProfile.LdpVc) {
      if (!credentials.every((c) => typeof c === 'object' && c !== null)) {
        throw new CredoError(
          `Received credential(s) of format ${format}, but not all credential(s) are an object. ${JSON.stringify(
            credentials
          )}`
        )
      }
      const result = await Promise.all(
        credentials.map(async (c) => {
          const credential = W3cJsonLdVerifiableCredential.fromJson(c)
          const result = await this.w3cCredentialService.verifyCredential(agentContext, {
            credential,
            verifyCredentialStatus,
          })

          return { credential, result }
        })
      )

      if (!result.every((c) => c.result.isValid)) {
        agentContext.config.logger.error('Failed to validate credentials', { result })
        throw new CredoError(
          `Failed to validate credential, error = ${result
            .map((e) => e.result.error?.message)
            .filter(Boolean)
            .join(', ')}`
        )
      }

      const w3cJsonLdCredentialService = agentContext.resolve(W3cJsonLdCredentialService)
      return {
        record: new W3cCredentialRecord({
          credentialInstances: result.map((r) => ({
            credential: r.credential.encoded,
          })) as W3cCredentialRecordInstances,
          tags: {
            // Fetch it directly
            expandedTypes: await w3cJsonLdCredentialService.getExpandedTypesForCredential(
              agentContext,
              result[0].credential
            ),
          },
        }),
        notificationId,
        credentialConfigurationId,
        credentialConfiguration,
      }
    }

    if (format === OpenId4VciCredentialFormatProfile.MsoMdoc) {
      if (!credentials.every((c) => typeof c === 'string')) {
        throw new CredoError(
          `Received credential(s) of format ${format}, but not all credential(s) are a string. ${JSON.stringify(
            credentials
          )}`
        )
      }
      const mdocApi = agentContext.dependencyManager.resolve(MdocApi)
      const result = await Promise.all(
        credentials.map(async (credential) => {
          const mdoc = Mdoc.fromBase64Url(credential)
          const result = await mdocApi.verify(mdoc, {})

          const jwkThumbprint = TypedArrayEncoder.toBase64(mdoc.deviceKey.getJwkThumbprint())
          const kmsKeyId = options.jwkThumbprintKmsKeyIdMapping?.[jwkThumbprint]
          if (!kmsKeyId) {
            throw new CredoError(
              `Missing kmsKeyId for jwk with thumbprint ${jwkThumbprint}. A credential was issued for a key that was not in the credential request.`
            )
          }

          mdoc.deviceKeyId = kmsKeyId
          return {
            result,
            mdoc,
          }
        })
      )

      if (!result.every((r) => r.result.isValid)) {
        agentContext.config.logger.error('Failed to validate credentials', { result })
        throw new CredoError(
          `Failed to validate mdoc credential(s). \n - ${result
            .map((r, i) => (r.result.isValid ? undefined : `(${i}) ${r.result.error}`))
            .filter(Boolean)
            .join('\n - ')}`
        )
      }

      return {
        record: new MdocRecord({
          credentialInstances: result.map((c) => ({
            issuerSignedBase64Url: c.mdoc.base64Url,
            kmsKeyId: c.mdoc.deviceKeyId,
          })) as MdocRecordInstances,
        }),
        notificationId,
        credentialConfigurationId,
        credentialConfiguration,
      }
    }

    throw new CredoError(`Unsupported credential format ${options.format}`)
  }

  private getCallbacks(
    agentContext: AgentContext,
    { clientAttestation, clientId }: { clientAttestation?: string; clientId?: string } = {}
  ) {
    const callbacks = getOid4vcCallbacks(agentContext)

    return {
      ...callbacks,
      clientAuthentication: (options) => {
        const { authorizationServerMetadata, url, body } = options
        const oauth2Client = this.getOauth2Client(agentContext)
        const clientAttestationSupported = oauth2Client.isClientAttestationSupported({
          authorizationServerMetadata,
        })

        // Client attestations
        if (clientAttestation && clientAttestationSupported) {
          return clientAuthenticationClientAttestationJwt({
            clientAttestationJwt: clientAttestation,
            callbacks,
          })(options)
        }

        // Pre auth flow
        if (
          url === authorizationServerMetadata.token_endpoint &&
          authorizationServerMetadata['pre-authorized_grant_anonymous_access_supported'] &&
          body.grant_type === preAuthorizedCodeGrantIdentifier
        ) {
          return clientAuthenticationAnonymous()(options)
        }

        // Just a client id (no auth)
        if (clientId) {
          return clientAuthenticationNone({ clientId })(options)
        }

        // NOTE: we fall back to anonymous authentication for pre-auth for now, as there's quite some
        // issuers that do not have pre-authorized_grant_anonymous_access_supported defined
        if (
          url === authorizationServerMetadata.token_endpoint &&
          body.grant_type === preAuthorizedCodeGrantIdentifier
        ) {
          return clientAuthenticationAnonymous()(options)
        }

        // Refresh token flow defaults to anonymous auth if there is neither a client attestation or client id
        // is present.
        if (body.grant_type === refreshTokenGrantIdentifier) {
          return clientAuthenticationAnonymous()(options)
        }

        // TODO: We should still look at auth_methods_supported
        // If there is an auth session for the auth challenge endpoint, we don't have to include the client_id
        if (url === authorizationServerMetadata.authorization_challenge_endpoint && body.auth_session) {
          return clientAuthenticationAnonymous()(options)
        }

        throw new CredoError('Unable to perform client authentication.')
      },
    } satisfies Partial<CallbackContext>
  }

  private getClient(agentContext: AgentContext, options: { clientAttestation?: string; clientId?: string } = {}) {
    return new Openid4vciClient({
      callbacks: this.getCallbacks(agentContext, options),
    })
  }

  private getOauth2Client(agentContext: AgentContext, options?: { clientAttestation?: string; clientId?: string }) {
    return new Oauth2Client({
      callbacks: options ? this.getCallbacks(agentContext, options) : getOid4vcCallbacks(agentContext),
    })
  }
}
