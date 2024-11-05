import type {
  OpenId4VciAcceptCredentialOfferOptions,
  OpenId4VciAuthCodeFlowOptions,
  OpenId4VciCredentialBindingResolver,
  OpenId4VciCredentialResponse,
  OpenId4VciNotificationEvent,
  OpenId4VciProofOfPossessionRequirements,
  OpenId4VciResolvedAuthorizationRequest,
  OpenId4VciResolvedAuthorizationRequestWithCode,
  OpenId4VciResolvedCredentialOffer,
  OpenId4VciSupportedCredentialFormats,
  OpenId4VciTokenRequestOptions,
} from './OpenId4VciHolderServiceOptions'
import type { OpenId4VciCredentialConfigurationSupported, OpenId4VciIssuerMetadata } from '../shared'
import type { AgentContext, JwaSignatureAlgorithm, Key } from '@credo-ts/core'

import {
  CredoError,
  DidsApi,
  Hasher,
  InjectionSymbols,
  JsonEncoder,
  Jwk,
  JwsService,
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
  getKeyFromVerificationMethod,
  getSupportedVerificationMethodTypesFromKeyType,
  inject,
  injectable,
  parseDid,
} from '@credo-ts/core'

import { OpenId4VciCredentialFormatProfile } from '../shared'
import { getOfferedCredentials } from '../shared/issuerMetadataUtils'
import { getSupportedJwaSignatureAlgorithms } from '../shared/utils'

import { openId4VciSupportedCredentialFormats } from './OpenId4VciHolderServiceOptions'
import { CredentialResponse, IssuerMetadataResult, Oid4vciClient } from '@animo-id/oid4vci'

@injectable()
export class OpenId4VciHolderService {
  private logger: Logger
  private w3cCredentialService: W3cCredentialService
  private jwsService: JwsService

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    w3cCredentialService: W3cCredentialService,
    jwsService: JwsService
  ) {
    this.w3cCredentialService = w3cCredentialService
    this.jwsService = jwsService
    this.logger = logger
  }

  private getClient(agentContext: AgentContext) {
    return new Oid4vciClient({
      callbacks: {
        generateRandom: (length) => agentContext.wallet.getRandomValues(length),
        hash: (data, alg) => Hasher.hash(data, alg.toLowerCase()),
        signJwt: this.jwtSignerCallback(agentContext),
        fetch: agentContext.config.agentDependencies.fetch,
      },
    })
  }

  public async resolveCredentialOffer(
    agentContext: AgentContext,
    credentialOffer: string
  ): Promise<OpenId4VciResolvedCredentialOffer> {
    const client = this.getClient(agentContext)

    const credentialOfferObject = await client.resolveCredentialOffer(credentialOffer)
    const metadata = await client.resolveIssuerMetadata(credentialOfferObject.credential_issuer)
    this.logger.debug('fetched credential offer and issuer metadata', { metadata, credentialOfferObject })

    // TODO: only extract known offers
    const credentialConfigurationsSupported = getOfferedCredentials(
      credentialOfferObject.credential_configuration_ids,
      metadata.credentialIssuer.credential_configurations_supported
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
    // TODO: add support for scope based on metadata
    const { clientId, redirectUri, scope } = authCodeFlowOptions
    const { metadata, credentialOfferPayload } = resolvedCredentialOffer

    const client = this.getClient(agentContext)

    const { authorizationRequestUrl, pkce, authorizationServer } = await client.initiateAuthorization({
      clientId,
      issuerMetadata: metadata,
      credentialOffer: credentialOfferPayload,
      scope: scope?.join(' '),
      redirectUri,
    })

    return {
      ...authCodeFlowOptions,
      authorizationServer,
      codeVerifier: pkce?.codeVerifier,
      authorizationRequestUri: authorizationRequestUrl,
    }
  }

  public async resolveIssuerMetadata(agentContext: AgentContext, { credentialIssuer }: { credentialIssuer: string }) {
    return this.getClient(agentContext).resolveIssuerMetadata(credentialIssuer)
  }

  public async sendNotification(
    agentContext: AgentContext,
    options: {
      metadata: IssuerMetadataResult
      notificationId: string
      notificationEvent: OpenId4VciNotificationEvent
      accessToken: string
      dpop?: { jwk: Jwk; alg: JwaSignatureAlgorithm; nonce?: string }
    }
  ) {
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

  public async requestAccessToken(agentContext: AgentContext, options: OpenId4VciTokenRequestOptions) {
    const { resolvedCredentialOffer, txCode, resolvedAuthorizationRequest, code } = options
    const { metadata, credentialOfferPayload } = resolvedCredentialOffer

    const client = this.getClient(agentContext)

    const authorizationServerMetadata = determineAuthorizationServerForOffer({
      credentialOffer: credentialOfferPayload,
      grantType: resolvedAuthorizationRequest ? authorizationCodeGrantIdentifier : preAuthorizedCodeGrantIdentifier,
      issuerMetadata: metadata,
    })
    const isDpopSupported = client.isDpopSupported({
      authorizationServer: authorizationServerMetadata.issuer,
      issuerMetadata: metadata,
    })
    const dpop = isDpopSupported.supported
      ? await this.getDpopOptions(agentContext, {
          dpopSigningAlgValuesSupported: isDpopSupported.dpopSigningAlgValuesSupported,
        })
      : undefined

    if (resolvedAuthorizationRequest) {
      const { codeVerifier, redirectUri } = resolvedAuthorizationRequest
      const result = await client.retrieveAuthorizationCodeAccessToken({
        issuerMetadata: metadata,
        authorizationCode: code,
        authorizationServer: authorizationServerMetadata.issuer,
        dpop,
        pkceCodeVerifier: codeVerifier,
        redirectUri,
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
    } else {
      const result = await client.retrievePreAuthorizedCodeAccessToken({
        credentialOffer: resolvedCredentialOffer.credentialOfferPayload,
        issuerMetadata: metadata,
        dpop,
        txCode,
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
  }

  public async acceptCredentialOffer(
    agentContext: AgentContext,
    options: {
      resolvedCredentialOffer: OpenId4VciResolvedCredentialOffer
      acceptCredentialOfferOptions: OpenId4VciAcceptCredentialOfferOptions
      resolvedAuthorizationRequestWithCode?: OpenId4VciResolvedAuthorizationRequestWithCode
      accessToken?: string
      cNonce?: string
      dpop?: { jwk: Jwk; alg: JwaSignatureAlgorithm; nonce?: string }
      clientId?: string
    }
  ) {
    const { resolvedCredentialOffer, acceptCredentialOfferOptions } = options
    const { metadata, offeredCredentialConfigurations } = resolvedCredentialOffer
    const { credentialsToRequest, credentialBindingResolver, verifyCredentialStatus } = acceptCredentialOfferOptions

    const client = this.getClient(agentContext)

    if (credentialsToRequest?.length === 0) {
      this.logger.warn(`Accepting 0 credential offers. Returning`)
      return []
    }

    this.logger.info(
      `Accepting the following credential offers '${credentialsToRequest ? credentialsToRequest.join(', ') : 'all'}`
    )

    const supportedJwaSignatureAlgorithms = getSupportedJwaSignatureAlgorithms(agentContext)

    const allowedProofOfPossessionSigAlgs = acceptCredentialOfferOptions.allowedProofOfPossessionSignatureAlgorithms
    const possibleProofOfPossessionSigAlgs = allowedProofOfPossessionSigAlgs
      ? allowedProofOfPossessionSigAlgs.filter((algorithm) => supportedJwaSignatureAlgorithms.includes(algorithm))
      : supportedJwaSignatureAlgorithms

    if (possibleProofOfPossessionSigAlgs.length === 0) {
      throw new CredoError(
        [
          `No possible proof of possession signature algorithm found.`,
          `Signature algorithms supported by the Agent '${supportedJwaSignatureAlgorithms.join(', ')}'`,
          `Allowed Signature algorithms '${allowedProofOfPossessionSigAlgs?.join(', ')}'`,
        ].join('\n')
      )
    }

    const tokenRequestOptions = {
      resolvedCredentialOffer,
      resolvedAuthorizationRequest: options.resolvedAuthorizationRequestWithCode,
      code: options.resolvedAuthorizationRequestWithCode?.code,
      txCode: acceptCredentialOfferOptions.userPin,
    } as OpenId4VciTokenRequestOptions

    const tokenResponse = options.accessToken
      ? { accessTokenResponse: { access_token: options.accessToken, c_nonce: options.cNonce }, dpop: options.dpop }
      : await this.requestAccessToken(agentContext, tokenRequestOptions)

    const receivedCredentials: Array<OpenId4VciCredentialResponse> = []
    let cNonce = tokenResponse.accessTokenResponse.c_nonce
    let dpopNonce = tokenResponse.dpop?.nonce

    const credentialConfigurationToRequest =
      credentialsToRequest?.map((id) => {
        if (!offeredCredentialConfigurations[id]) {
          const offeredCredentialIds = Object.keys(offeredCredentialConfigurations).join(', ')
          throw new CredoError(
            `Credential to request '${id}' is not present in offered credentials. Offered credentials are ${offeredCredentialIds}`
          )
        }
        return [id, offeredCredentialConfigurations[id]] as const
      }) ?? Object.entries(offeredCredentialConfigurations)

    for (const [offeredCredentialId, offeredCredentialConfiguration] of credentialConfigurationToRequest) {
      // Get all options for the credential request (such as which kid to use, the signature algorithm, etc)
      const { credentialBinding, signatureAlgorithm } = await this.getCredentialRequestOptions(agentContext, {
        possibleProofOfPossessionSignatureAlgorithms: possibleProofOfPossessionSigAlgs,
        offeredCredential: {
          id: offeredCredentialId,
          configuration: offeredCredentialConfiguration,
        },
        credentialBindingResolver,
      })

      let jwtSigner: JwtSigner =
        credentialBinding.method === 'did'
          ? {
              method: credentialBinding.method,
              didUrl: credentialBinding.didUrl,
              alg: signatureAlgorithm,
            }
          : {
              method: 'jwk',
              publicJwk: credentialBinding.jwk.toJson(),
              alg: signatureAlgorithm,
            }

      const { jwt } = await client.createCredentialRequestJwtProof({
        credentialConfigurationId: offeredCredentialId,
        issuerMetadata: resolvedCredentialOffer.metadata,
        signer: jwtSigner,
        clientId: options.clientId,
        nonce: cNonce,
      })

      this.logger.debug('Generated credential request proof of possesion jwt', { jwt })

      const { credentialResponse, dpop } = await client.retrieveCredentials({
        issuerMetadata: metadata,
        accessToken: tokenResponse.accessTokenResponse.access_token,
        credentialConfigurationId: offeredCredentialId,
        dpop: tokenResponse.dpop
          ? await this.getDpopOptions(agentContext, {
              ...tokenResponse.dpop,
              nonce: dpopNonce,
              dpopSigningAlgValuesSupported: [tokenResponse.dpop.alg],
            })
          : undefined,
        proof: {
          proof_type: 'jwt',
          jwt,
        },
      })

      // Set new nonce values
      cNonce = credentialResponse.c_nonce
      dpopNonce = dpop?.nonce

      // Create credential, but we don't store it yet (only after the user has accepted the credential)
      const credential = await this.handleCredentialResponse(agentContext, credentialResponse, {
        verifyCredentialStatus: verifyCredentialStatus ?? false,
        credentialIssuerMetadata: metadata.credentialIssuer,
        format: offeredCredentialConfiguration.format as OpenId4VciCredentialFormatProfile,
      })

      this.logger.debug('received credential', credential)
      receivedCredentials.push(credential)
    }

    return receivedCredentials
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
      credentialBindingResolver: OpenId4VciCredentialBindingResolver
      possibleProofOfPossessionSignatureAlgorithms: JwaSignatureAlgorithm[]
      offeredCredential: {
        id: string
        configuration: OpenId4VciCredentialConfigurationSupported
      }
    }
  ) {
    const { signatureAlgorithm, supportedDidMethods, supportsAllDidMethods, supportsJwk } =
      this.getProofOfPossessionRequirements(agentContext, {
        credentialToRequest: options.offeredCredential,
        possibleProofOfPossessionSignatureAlgorithms: options.possibleProofOfPossessionSignatureAlgorithms,
      })

    const JwkClass = getJwkClassFromJwaSignatureAlgorithm(signatureAlgorithm)
    if (!JwkClass) {
      throw new CredoError(`Could not determine JWK key type of the JWA signature algorithm '${signatureAlgorithm}'`)
    }

    const supportedVerificationMethods = getSupportedVerificationMethodTypesFromKeyType(JwkClass.keyType)

    const format = options.offeredCredential.configuration.format as OpenId4VciSupportedCredentialFormats

    // Now we need to determine how the credential will be bound to us
    const credentialBinding = await options.credentialBindingResolver({
      credentialFormat: format,
      signatureAlgorithm,
      supportedVerificationMethods,
      keyType: JwkClass.keyType,
      supportedCredentialId: options.offeredCredential.id,
      supportsAllDidMethods,
      supportedDidMethods,
      supportsJwk,
    })

    // Make sure the issuer of proof of possession is valid according to openid issuer metadata
    if (
      credentialBinding.method === 'did' &&
      !supportsAllDidMethods &&
      // If supportedDidMethods is undefined, it means the issuer didn't include the binding methods in the metadata
      // The user can still select a verification method, but we can't validate it
      supportedDidMethods !== undefined &&
      !supportedDidMethods.find((supportedDidMethod) => credentialBinding.didUrl.startsWith(supportedDidMethod))
    ) {
      const { method } = parseDid(credentialBinding.didUrl)
      const supportedDidMethodsString = supportedDidMethods.join(', ')
      throw new CredoError(
        `Resolved credential binding for proof of possession uses did method '${method}', but issuer only supports '${supportedDidMethodsString}'`
      )
    } else if (credentialBinding.method === 'jwk' && !supportsJwk) {
      throw new CredoError(
        `Resolved credential binding for proof of possession uses jwk, but openid issuer does not support 'jwk' or 'cose_key' cryptographic binding method`
      )
    }

    // FIXME: we don't have the verification method here
    // Make sure the verification method uses a supported verification method type
    // if (!supportedVerificationMethods.includes(verificationMethod.type)) {
    //   const supportedVerificationMethodsString = supportedVerificationMethods.join(', ')
    //   throw new CredoError(
    //     `Verification method uses verification method type '${verificationMethod.type}', but only '${supportedVerificationMethodsString}' verification methods are supported for key type '${JwkClass.keyType}'`
    //   )
    // }

    return { credentialBinding, signatureAlgorithm }
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
      credentialToRequest: {
        id: string
        configuration: OpenId4VciCredentialConfigurationSupported
      }
      possibleProofOfPossessionSignatureAlgorithms: JwaSignatureAlgorithm[]
    }
  ): OpenId4VciProofOfPossessionRequirements {
    const { credentialToRequest } = options

    if (
      !openId4VciSupportedCredentialFormats.includes(
        credentialToRequest.configuration.format as OpenId4VciSupportedCredentialFormats
      )
    ) {
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

    let signatureAlgorithm: JwaSignatureAlgorithm | undefined

    if (credentialToRequest.configuration.proof_types_supported) {
      if (!credentialToRequest.configuration.proof_types_supported.jwt) {
        throw new CredoError(
          `Unsupported proof type(s) ${Object.keys(credentialToRequest.configuration.proof_types_supported).join(
            ', '
          )}. Supported proof type(s) are: jwt`
        )
      }
    }

    const proofSigningAlgsSupported =
      credentialToRequest.configuration.proof_types_supported?.jwt?.proof_signing_alg_values_supported

    // If undefined, it means the issuer didn't include the cryptographic suites in the metadata
    // We just guess that the first one is supported
    if (proofSigningAlgsSupported === undefined) {
      signatureAlgorithm = options.possibleProofOfPossessionSignatureAlgorithms[0]
    } else {
      switch (credentialToRequest.configuration.format) {
        case OpenId4VciCredentialFormatProfile.JwtVcJson:
        case OpenId4VciCredentialFormatProfile.JwtVcJsonLd:
        case OpenId4VciCredentialFormatProfile.SdJwtVc:
        case OpenId4VciCredentialFormatProfile.MsoMdoc:
          signatureAlgorithm = options.possibleProofOfPossessionSignatureAlgorithms.find((signatureAlgorithm) =>
            proofSigningAlgsSupported.includes(signatureAlgorithm)
          )
          break
        case OpenId4VciCredentialFormatProfile.LdpVc:
          signatureAlgorithm = options.possibleProofOfPossessionSignatureAlgorithms.find((signatureAlgorithm) => {
            const JwkClass = getJwkClassFromJwaSignatureAlgorithm(signatureAlgorithm)
            if (!JwkClass) return false

            const matchingSuite = signatureSuiteRegistry.getAllByKeyType(JwkClass.keyType)
            if (matchingSuite.length === 0) return false

            return proofSigningAlgsSupported.includes(matchingSuite[0].proofType)
          })
          break
        default:
          throw new CredoError(`Unsupported credential format.`)
      }
    }

    if (!signatureAlgorithm) {
      throw new CredoError(
        `Could not establish signature algorithm for format ${credentialToRequest.configuration.format} and id ${credentialToRequest.id}`
      )
    }

    const issuerSupportedBindingMethods = credentialToRequest.configuration.cryptographic_binding_methods_supported
    const supportsAllDidMethods = issuerSupportedBindingMethods?.includes('did') ?? false
    const supportedDidMethods = issuerSupportedBindingMethods?.filter((method) => method.startsWith('did:'))

    // The cryptographic_binding_methods_supported describe the cryptographic key material that the issued Credential is bound to.
    const supportsCoseKey = issuerSupportedBindingMethods?.includes('cose_key') ?? false
    const supportsJwk = issuerSupportedBindingMethods?.includes('jwk') || supportsCoseKey

    return {
      signatureAlgorithm,
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
      credentialIssuerMetadata: OpenId4VciIssuerMetadata
      format: OpenId4VciCredentialFormatProfile
    }
  ): Promise<OpenId4VciCredentialResponse> {
    const { verifyCredentialStatus, credentialIssuerMetadata } = options

    this.logger.debug('Credential request response', credentialResponse)

    if (credentialResponse.credentials) {
      throw new CredoError(
        `Credential response returned 'credentials' parameter in credential response which is not supported yet.`
      )
    }

    if (!credentialResponse.credential) {
      throw new CredoError(
        `Did not receive a successful credential response. Missing 'credential' parameter in credential response.`
      )
    }

    const notificationMetadata =
      credentialIssuerMetadata.notification_endpoint && credentialResponse.notification_id
        ? {
            notificationEndpoint: credentialIssuerMetadata.notification_endpoint,
            notificationId: credentialResponse.notification_id,
          }
        : undefined

    const format = options.format
    if (format === OpenId4VciCredentialFormatProfile.SdJwtVc) {
      if (typeof credentialResponse.credential !== 'string')
        throw new CredoError(
          `Received a credential of format ${format}, but the credential is not a string. ${JSON.stringify(
            credentialResponse.credential
          )}`
        )

      const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)
      const verificationResult = await sdJwtVcApi.verify({
        compactSdJwtVc: credentialResponse.credential,
      })

      if (!verificationResult.isValid) {
        agentContext.config.logger.error('Failed to validate credential', { verificationResult })
        throw new CredoError(`Failed to validate sd-jwt-vc credential. Results = ${JSON.stringify(verificationResult)}`)
      }

      return { credential: verificationResult.sdJwtVc, notificationMetadata }
    } else if (
      format === OpenId4VciCredentialFormatProfile.JwtVcJson ||
      format === OpenId4VciCredentialFormatProfile.JwtVcJsonLd
    ) {
      if (typeof credentialResponse.credential !== 'string')
        throw new CredoError(
          `Received a credential of format ${format}, but the credential is not a string. ${JSON.stringify(
            credentialResponse.credential
          )}`
        )

      const credential = W3cJwtVerifiableCredential.fromSerializedJwt(credentialResponse.credential)
      const result = await this.w3cCredentialService.verifyCredential(agentContext, {
        credential,
        verifyCredentialStatus,
      })
      if (!result.isValid) {
        agentContext.config.logger.error('Failed to validate credential', { result })
        throw new CredoError(`Failed to validate credential, error = ${result.error?.message ?? 'Unknown'}`)
      }

      return { credential, notificationMetadata }
    } else if (format === OpenId4VciCredentialFormatProfile.LdpVc) {
      if (typeof credentialResponse.credential === 'string')
        throw new CredoError(
          `Received a credential of format ${format}, but the credential is not an object. ${JSON.stringify(
            credentialResponse.credential
          )}`
        )

      const credential = W3cJsonLdVerifiableCredential.fromJson(credentialResponse.credential)
      const result = await this.w3cCredentialService.verifyCredential(agentContext, {
        credential,
        verifyCredentialStatus,
      })
      if (!result.isValid) {
        agentContext.config.logger.error('Failed to validate credential', { result })
        throw new CredoError(`Failed to validate credential, error = ${result.error?.message ?? 'Unknown'}`)
      }

      return { credential, notificationMetadata }
    } else if (format === OpenId4VciCredentialFormatProfile.MsoMdoc) {
      if (typeof credentialResponse.successBody.credential !== 'string')
        throw new CredoError(
          `Received a credential of format ${
            OpenId4VciCredentialFormatProfile.MsoMdoc
          }, but the credential is not a string. ${JSON.stringify(credentialResponse.successBody.credential)}`
        )

      const mdocApi = agentContext.dependencyManager.resolve(MdocApi)
      const mdoc = Mdoc.fromBase64Url(credentialResponse.successBody.credential)
      const verificationResult = await mdocApi.verify(mdoc, {})

      if (!verificationResult.isValid) {
        agentContext.config.logger.error('Failed to validate credential', { verificationResult })
        throw new CredoError(`Failed to validate mdoc credential. Results = ${verificationResult.error}`)
      }

      return { credential: mdoc, notificationMetadata }
    }

    throw new CredoError(`Unsupported credential format`)
  }

  private jwtSignerCallback(agentContext: AgentContext) {
    const callback: SignJwtCallback = async (signer, { header, payload }) => {
      if (signer.method === 'custom' || signer.method === 'x5c') {
        throw new CredoError(`Jwt signer method 'custom' and 'x5c' are not supported for jwt signer.`)
      }

      let key: Key

      if (signer.method === 'did') {
        const didsApi = agentContext.dependencyManager.resolve(DidsApi)
        const didDocument = await didsApi.resolveDidDocument(signer.didUrl)
        const verificationMethod = didDocument.dereferenceKey(signer.didUrl, ['authentication'])
        key = getKeyFromVerificationMethod(verificationMethod)
      } else {
        key = getJwkFromJson(signer.publicJwk).key
      }

      const jwk = getJwkFromKey(key)
      if (!jwk.supportsSignatureAlgorithm(signer.alg)) {
        throw new CredoError(`key type '${jwk.keyType}', does not support the JWS signature alg '${signer.alg}'`)
      }

      const jws = await this.jwsService.createJwsCompact(agentContext, {
        key,
        payload: JsonEncoder.toBuffer(payload),
        protectedHeaderOptions: {
          ...header,
          // only pass jwk if signer method is jwk
          jwk: signer.method === 'jwk' ? jwk : undefined,
        },
      })

      return jws
    }
    return callback
  }
}
