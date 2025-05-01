import type { AgentContext, JwaSignatureAlgorithm } from '@credo-ts/core'
import {
  CredoError,
  InjectionSymbols,
  Jwk,
  Logger,
  Mdoc,
  MdocApi,
  SdJwtVcApi,
  SignatureSuiteRegistry,
  W3cCredentialService,
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
  getJwkClassFromJwaSignatureAlgorithm,
  getJwkFromJson,
  getJwkFromKey,
  inject,
  injectable,
  parseDid,
} from '@credo-ts/core'
import {
  Oauth2Client,
  RequestDpopOptions,
  authorizationCodeGrantIdentifier,
  clientAuthenticationAnonymous,
  clientAuthenticationClientAttestationJwt,
  clientAuthenticationNone,
  getAuthorizationServerMetadataFromList,
  preAuthorizedCodeGrantIdentifier,
} from '@openid4vc/oauth2'
import { determineAuthorizationServerForCredentialOffer, parseKeyAttestationJwt } from '@openid4vc/openid4vci'
import {
  AuthorizationFlow,
  CredentialResponse,
  IssuerMetadataResult,
  Openid4vciClient,
  Openid4vciDraftVersion,
  Openid4vciRetrieveCredentialsError,
} from '@openid4vc/openid4vci'
import type {
  OpenId4VciCredentialConfigurationSupportedWithFormats,
  OpenId4VciCredentialIssuerMetadata,
  OpenId4VciMetadata,
} from '../shared'
import type {
  OpenId4VciAcceptCredentialOfferOptions,
  OpenId4VciAuthCodeFlowOptions,
  OpenId4VciCredentialBindingResolver,
  OpenId4VciCredentialResponse,
  OpenId4VciDpopRequestOptions,
  OpenId4VciProofOfPossessionRequirements,
  OpenId4VciResolvedAuthorizationRequest,
  OpenId4VciResolvedCredentialOffer,
  OpenId4VciRetrieveAuthorizationCodeUsingPresentationOptions,
  OpenId4VciSendNotificationOptions,
  OpenId4VciSupportedCredentialFormats,
  OpenId4VciTokenRequestOptions,
} from './OpenId4VciHolderServiceOptions'

import { OpenId4VciCredentialFormatProfile } from '../shared'
import { getOid4vcCallbacks } from '../shared/callbacks'
import { getOfferedCredentials, getScopesFromCredentialConfigurationsSupported } from '../shared/issuerMetadataUtils'
import { getKeyFromDid, getSupportedJwaSignatureAlgorithms } from '../shared/utils'

import { openId4VciSupportedCredentialFormats } from './OpenId4VciHolderServiceOptions'

@injectable()
export class OpenId4VciHolderService {
  private logger: Logger
  private w3cCredentialService: W3cCredentialService

  public constructor(@inject(InjectionSymbols.Logger) logger: Logger, w3cCredentialService: W3cCredentialService) {
    this.w3cCredentialService = w3cCredentialService
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
      client.getKnownCredentialConfigurationsSupported(metadata.credentialIssuer),
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
              alg: dpop.signer.alg as JwaSignatureAlgorithm,
              jwk: getJwkFromJson(dpop.signer.publicJwk),
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
            alg: dpop.signer.alg as JwaSignatureAlgorithm,
            jwk: getJwkFromJson(dpop.signer.publicJwk),
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
    }: { dpopSigningAlgValuesSupported: string[]; jwk?: Jwk; nonce?: string }
  ): Promise<RequestDpopOptions> {
    if (jwk) {
      const alg = dpopSigningAlgValuesSupported.find((alg) =>
        jwk.supportedSignatureAlgorithms.includes(alg as JwaSignatureAlgorithm)
      )

      if (!alg) {
        throw new CredoError(
          `No supported dpop signature algorithms found in dpop_signing_alg_values_supported '${dpopSigningAlgValuesSupported.join(
            ', '
          )}' matching key type ${jwk.keyType}`
        )
      }

      return {
        signer: {
          method: 'jwk',
          alg,
          publicJwk: jwk.toJson(),
        },
        nonce,
      }
    }

    const alg = dpopSigningAlgValuesSupported.find((alg) => getJwkClassFromJwaSignatureAlgorithm(alg))
    const JwkClass = alg ? getJwkClassFromJwaSignatureAlgorithm(alg) : undefined

    if (!alg || !JwkClass) {
      throw new CredoError(
        `No supported dpop signature algorithms found in dpop_signing_alg_values_supported '${dpopSigningAlgValuesSupported.join(
          ', '
        )}'`
      )
    }

    const key = await agentContext.wallet.createKey({ keyType: JwkClass.keyType })
    return {
      signer: {
        method: 'jwk',
        alg,
        publicJwk: getJwkFromKey(key).toJson(),
      },
      nonce,
    }
  }

  public async retrieveAuthorizationCodeUsingPresentation(
    agentContext: AgentContext,
    options: OpenId4VciRetrieveAuthorizationCodeUsingPresentationOptions
  ) {
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
            alg: dpop.signer.alg as JwaSignatureAlgorithm,
            jwk: getJwkFromJson(dpop.signer.publicJwk),
          }
        : undefined,
    }
  }

  public async requestAccessToken(agentContext: AgentContext, options: OpenId4VciTokenRequestOptions) {
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
        // provide the DPoP from the auth response. In whic case different DPoP will be used
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
            alg: dpop.signer.alg as JwaSignatureAlgorithm,
            jwk: getJwkFromJson(dpop.signer.publicJwk),
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
  ) {
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
      const proofs = await this.getCredentialRequestOptions(agentContext, {
        allowedProofOfPossesionAlgorithms:
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

      this.logger.debug('Generated credential request proof of possesion', { proofs })

      const proof =
        // Draft 11 ALWAYS uses proof
        (metadata.originalDraftVersion === Openid4vciDraftVersion.Draft11 ||
          // Draft 14 allows both proof and proofs. Try to use proof when it makes to improve interoperability
          (metadata.originalDraftVersion === Openid4vciDraftVersion.Draft14 &&
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

      // Create credential, but we don't store it yet (only after the user has accepted the credential)
      const credential = await this.handleCredentialResponse(agentContext, credentialResponse, {
        verifyCredentialStatus: verifyCredentialStatus ?? false,
        credentialIssuerMetadata: metadata.credentialIssuer,
        format: offeredCredentialConfiguration.format as OpenId4VciCredentialFormatProfile,
        credentialConfigurationId: offeredCredentialId,
        credentialConfiguration: offeredCredentialConfiguration,
      })

      this.logger.debug(
        'received credential',
        credential.credentials.map((c) =>
          c instanceof Mdoc ? { issuerSignedNamespaces: c.issuerSignedNamespaces, base64Url: c.base64Url } : c
        )
      )
      receivedCredentials.push(credential)
    }

    return {
      credentials: receivedCredentials,
      dpop: options.dpop
        ? {
            ...options.dpop,
            nonce: dpopNonce,
          }
        : undefined,
      cNonce,
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
      allowedProofOfPossesionAlgorithms: JwaSignatureAlgorithm[]
      clientId?: string
      cNonce: string
      offeredCredential: {
        id: string
        configuration: OpenId4VciCredentialConfigurationSupportedWithFormats
      }
    }
  ) {
    const { allowedProofOfPossesionAlgorithms, offeredCredential } = options
    const { configuration, id: configurationId } = offeredCredential
    const supportedJwaSignatureAlgorithms = getSupportedJwaSignatureAlgorithms(agentContext)

    const possibleProofOfPossessionSignatureAlgorithms = allowedProofOfPossesionAlgorithms
      ? allowedProofOfPossesionAlgorithms.filter((algorithm) => supportedJwaSignatureAlgorithms.includes(algorithm))
      : supportedJwaSignatureAlgorithms

    if (possibleProofOfPossessionSignatureAlgorithms.length === 0) {
      throw new CredoError(
        [
          'No possible proof of possession signature algorithm found.',
          `Signature algorithms supported by the Agent '${supportedJwaSignatureAlgorithms.join(', ')}'`,
          `Allowed Signature algorithms '${allowedProofOfPossesionAlgorithms?.join(', ')}'`,
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

      const firstKey = await getKeyFromDid(agentContext, firstDid.didUrl)
      if (!proofTypes.jwt.supportedKeyTypes.includes(firstKey.keyType)) {
        throw new CredoError(
          `Credential binding returned did url that points to key with type '${
            firstKey.keyType
          }', but one of '${proofTypes.jwt.supportedKeyTypes.join(', ')}' was expected`
        )
      }

      // This will/should leverage the caching, so it's ok to resolve the did here
      const keys = await Promise.all(
        credentialBinding.didUrls.map(async (didUrl, index) =>
          index === 0
            ? // We already fetched the first did
              { key: firstKey, didUrl: firstDid.didUrl }
            : { key: await getKeyFromDid(agentContext, didUrl), didUrl }
        )
      )
      if (!keys.every((key) => key.key.keyType === firstKey.keyType)) {
        throw new CredoError('Expected all did urls to point to the same key type')
      }

      const alg = getJwkFromKey(firstKey).supportedSignatureAlgorithms[0]
      if (!alg) {
        // Should not happen, to make ts happy
        throw new CredoError(`Unable to determine alg for key type ${firstKey.keyType}`)
      }

      return {
        jwt: await Promise.all(
          keys.map((key) =>
            client
              .createCredentialRequestJwtProof({
                credentialConfigurationId: configurationId,
                issuerMetadata: options.metadata,
                signer: {
                  method: 'did',
                  didUrl: key.didUrl,
                  alg,
                },
                nonce: options.cNonce,
                clientId: options.clientId,
              })
              .then(({ jwt }) => jwt)
          )
        ),
      }
    }

    if (credentialBinding.method === 'jwk') {
      if (!supportsJwk && supportsAnyMethod) {
        throw new CredoError(
          `Resolved credential binding for proof of possession uses jwk, but openid issuer does not support 'jwk' or 'cose_key' cryptographic binding method`
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
      if (!credentialBinding.keys.every((key) => key.keyType === firstJwk.keyType)) {
        throw new CredoError('Expected all keys for binding method jwk to use the same key type')
      }
      if (!proofTypes.jwt.supportedKeyTypes.includes(firstJwk.keyType)) {
        throw new CredoError(
          `Credential binding returned jwk with key with type '${
            firstJwk.keyType
          }', but one of '${proofTypes.jwt.supportedKeyTypes.join(', ')}' was expected`
        )
      }

      const alg = firstJwk.supportedSignatureAlgorithms[0]
      if (!alg) {
        // Should not happen, to make ts happy
        throw new CredoError(`Unable to determine alg for key type ${firstJwk.keyType}`)
      }

      return {
        jwt: await Promise.all(
          credentialBinding.keys.map((jwk) =>
            client
              .createCredentialRequestJwtProof({
                credentialConfigurationId: configurationId,
                issuerMetadata: options.metadata,
                signer: {
                  method: 'jwk',
                  publicJwk: jwk.toJson(),
                  alg,
                },
                nonce: options.cNonce,
                clientId: options.clientId,
              })
              .then(({ jwt }) => jwt)
          )
        ),
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

      // TODO: check nonce matches cNonce
      if (proofTypes.attestation && payload.nonce) {
        // If attestation is supported and the attestation contains a nonce, we can use the attestation directly
        return {
          attestation: [credentialBinding.keyAttestationJwt],
        }
      }

      if (proofTypes.jwt) {
        const jwk = getJwkFromJson(payload.attested_keys[0])

        return {
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
                nonce: options.cNonce,
                clientId: options.clientId,
              })
              .then(({ jwt }) => jwt),
          ],
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
      possibleProofOfPossessionSignatureAlgorithms: JwaSignatureAlgorithm[]
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
      if (metadata.originalDraftVersion !== Openid4vciDraftVersion.Draft11) {
        throw new CredoError(
          `Credential configuration '${configurationId}' does not specifcy proof_types_supported. Credentials not bound to keys are not supported at the moment`
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

      let signatureAlgorithms: JwaSignatureAlgorithm[] = []

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
          case OpenId4VciCredentialFormatProfile.LdpVc:
            signatureAlgorithms = options.possibleProofOfPossessionSignatureAlgorithms.filter((signatureAlgorithm) => {
              const JwkClass = getJwkClassFromJwaSignatureAlgorithm(signatureAlgorithm)
              if (!JwkClass) return false

              const matchingSuite = signatureSuiteRegistry.getAllByKeyType(JwkClass.keyType)
              if (matchingSuite.length === 0) return false

              return proofSigningAlgsSupported.includes(matchingSuite[0].proofType)
            })
            break
          default:
            throw new CredoError('Unsupported credential format.')
        }
      }

      proofTypes[proofType] = {
        supportedSignatureAlgorithms: signatureAlgorithms,
        supportedKeyTypes: signatureAlgorithms
          .map((algorithm) => getJwkClassFromJwaSignatureAlgorithm(algorithm)?.keyType)
          .filter((keyType) => keyType !== undefined),
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
    credentialResponse: CredentialResponse,
    options: {
      verifyCredentialStatus: boolean
      credentialIssuerMetadata: OpenId4VciCredentialIssuerMetadata
      format: OpenId4VciCredentialFormatProfile
      credentialConfigurationId: string
      credentialConfiguration: OpenId4VciCredentialConfigurationSupportedWithFormats
    }
  ): Promise<OpenId4VciCredentialResponse> {
    const { verifyCredentialStatus, credentialConfigurationId, credentialConfiguration } = options
    this.logger.debug('Credential response', credentialResponse)

    const credentials =
      credentialResponse.credentials ?? (credentialResponse.credential ? [credentialResponse.credential] : undefined)
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

      const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)
      const verificationResults = await Promise.all(
        credentials.map((compactSdJwtVc, index) =>
          sdJwtVcApi.verify({
            compactSdJwtVc,
            // Only load and verify it for the first instance
            fetchTypeMetadata: index === 0,
          })
        )
      )

      if (!verificationResults.every((result) => result.isValid)) {
        agentContext.config.logger.error('Failed to validate credential(s)', { verificationResults })
        throw new CredoError(
          `Failed to validate sd-jwt-vc credentials. Results = ${JSON.stringify(verificationResults)}`
        )
      }

      return {
        credentials: verificationResults.map((result) => result.sdJwtVc),
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
        credentials: result.map((r) => r.credential),
        notificationId,
        credentialConfigurationId,
        credentialConfiguration,
      }
    }
    if (format === OpenId4VciCredentialFormatProfile.LdpVc) {
      if (!credentials.every((c) => typeof c === 'object')) {
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

      return {
        credentials: result.map((r) => r.credential),
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
        credentials: result.map((c) => c.mdoc),
        notificationId,
        credentialConfigurationId,
        credentialConfiguration,
      }
    }

    throw new CredoError(`Unsupported credential format ${options.format}`)
  }

  private getClient(
    agentContext: AgentContext,
    { clientAttestation, clientId }: { clientAttestation?: string; clientId?: string } = {}
  ) {
    const callbacks = getOid4vcCallbacks(agentContext)
    return new Openid4vciClient({
      callbacks: {
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

          // TODO: We should still look at auth_methods_supported
          // If there is an auth session for the auth challenge endpoint, we don't have to include the client_id
          if (url === authorizationServerMetadata.authorization_challenge_endpoint && body.auth_session) {
            return clientAuthenticationAnonymous()(options)
          }

          throw new CredoError('Unable to perform client authentication.')
        },
      },
    })
  }

  private getOauth2Client(agentContext: AgentContext) {
    return new Oauth2Client({
      callbacks: getOid4vcCallbacks(agentContext),
    })
  }
}
