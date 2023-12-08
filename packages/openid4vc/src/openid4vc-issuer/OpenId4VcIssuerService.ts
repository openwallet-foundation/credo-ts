import type {
  AuthorizationCodeFlowConfig,
  CreateCredentialOfferAndRequestOptions,
  CreateIssueCredentialResponseOptions,
  CredentialOfferAndRequest,
  CredentialSupported,
  IssuerEndpointConfig,
  IssuerMetadata,
  OfferedCredential,
  PreAuthorizedCodeFlowConfig,
} from './OpenId4VcIssuerServiceOptions'
import type { IssuanceRequest } from './router/OpenId4VcIEndpointConfiguration'
import type { OfferedCredentialWithMetadata } from '../openid4vc-holder/reception/utils/IssuerMetadataUtils'
import type {
  AgentContext,
  DidDocument,
  JwaSignatureAlgorithm,
  VerificationMethod,
  W3cVerifiableCredential,
} from '@aries-framework/core'
import type { SdJwtCredential, SdJwtVcModule } from '@aries-framework/sd-jwt-vc'
import type {
  CredentialOfferPayloadV1_0_11,
  CredentialRequestV1_0_11,
  Grant,
  JWTVerifyCallback,
} from '@sphereon/oid4vci-common'
import type {
  CredentialDataSupplier,
  CredentialDataSupplierArgs,
  CredentialSignerCallback,
} from '@sphereon/oid4vci-issuer'
import type { ICredential } from '@sphereon/ssi-types'
import type { NextFunction, Response, Router } from 'express'

import {
  AgentContextProvider,
  AriesFrameworkError,
  ClaimFormat,
  DidsApi,
  InjectionSymbols,
  JsonTransformer,
  JwsService,
  Jwt,
  Logger,
  W3cCredential,
  W3cCredentialService,
  equalsIgnoreOrder,
  getApiForModuleByName,
  getJwkFromKey,
  getKeyFromVerificationMethod,
  inject,
  injectable,
} from '@aries-framework/core'
import { IssueStatus } from '@sphereon/oid4vci-common'
import { VcIssuerBuilder } from '@sphereon/oid4vci-issuer'
import bodyParser from 'body-parser'

import { OpenIdCredentialFormatProfile } from '../openid4vc-holder'
import { getOfferedCredentialsWithMetadata } from '../openid4vc-holder/reception/utils/IssuerMetadataUtils'
import { getEndpointUrl, initializeAgentFromContext, getRequestContext } from '../shared/router'
import { getSphereonW3cVerifiableCredential } from '../shared/transform'
import { getProofTypeFromVerificationMethod } from '../shared/utils'

import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import { configureAccessTokenEndpoint, configureCredentialEndpoint } from './router/OpenId4VcIEndpointConfiguration'
import { configureIssuerMetadataEndpoint } from './router/metadataEndpoint'

/**
 * @internal
 */
@injectable()
export class OpenId4VcIssuerService {
  private logger: Logger
  private w3cCredentialService: W3cCredentialService
  private jwsService: JwsService
  private _openId4VcIssuerModuleConfig: OpenId4VcIssuerModuleConfig
  private agentContextProvider: AgentContextProvider

  public get openId4VcIssuerModuleConfig() {
    return this._openId4VcIssuerModuleConfig
  }

  public get issuerMetadata() {
    return this.openId4VcIssuerModuleConfig.issuerMetadata
  }

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    @inject(InjectionSymbols.AgentContextProvider) agentContextProvider: AgentContextProvider,
    openId4VcIssuerModuleConfig: OpenId4VcIssuerModuleConfig,
    w3cCredentialService: W3cCredentialService,
    jwsService: JwsService
  ) {
    this.agentContextProvider = agentContextProvider
    this.w3cCredentialService = w3cCredentialService
    this.logger = logger
    this._openId4VcIssuerModuleConfig = openId4VcIssuerModuleConfig
    this.jwsService = jwsService
  }

  public expandEndpointsWithBase(agentContext: AgentContext): IssuerMetadata {
    const issuerMetadata = this.issuerMetadata
    const basePath = this.openId4VcIssuerModuleConfig.getBasePath(agentContext)

    const credentialIssuer = getEndpointUrl(issuerMetadata.issuerBaseUrl, basePath)
    const tokenEndpoint = getEndpointUrl(credentialIssuer, basePath, issuerMetadata.tokenEndpointPath)
    const credentialEndpoint = getEndpointUrl(credentialIssuer, basePath, issuerMetadata.credentialEndpointPath)

    return {
      ...issuerMetadata,
      issuerBaseUrl: credentialIssuer,
      tokenEndpointPath: tokenEndpoint,
      credentialEndpointPath: credentialEndpoint,
    }
  }

  private getJwtVerifyCallback = (agentContext: AgentContext): JWTVerifyCallback<DidDocument> => {
    return async (opts) => {
      const { jwt } = opts

      const { header, payload } = Jwt.fromSerializedJwt(jwt)
      const { alg, kid } = header

      // kid: JOSE Header containing the key ID. If the Credential shall be bound to a DID,
      // the kid refers to a DID URL which identifies a particular key in the DID Document that
      // the Credential shall be bound to. MUST NOT be present if jwk or x5c is present.
      if (!kid) throw new AriesFrameworkError('No KID is present for verifying the proof of possession.')

      const didsApi = agentContext.dependencyManager.resolve(DidsApi)
      const didDocument = await didsApi.resolveDidDocument(kid)
      const verificationMethod = didDocument.dereferenceKey(kid, ['authentication', 'assertionMethod'])
      const key = getKeyFromVerificationMethod(verificationMethod)
      const jwk = getJwkFromKey(key)

      if (!jwk.supportsSignatureAlgorithm(alg)) {
        throw new AriesFrameworkError(
          `The signature algorithm '${alg}' is not supported by keys of type '${jwk.keyType}'.`
        )
      }

      const { isValid } = await this.jwsService.verifyJws(agentContext, {
        jws: jwt,
        jwkResolver: () => jwk,
      })

      if (!isValid) throw new AriesFrameworkError('Could not verify JWT signature.')

      return {
        jwt: { header, payload: payload.toJson() },
        kid,
        did: didDocument.id,
        alg,
        didDocument,
      }
    }
  }

  private getVcIssuer(agentContext: AgentContext) {
    const issuerMetadata = this.expandEndpointsWithBase(agentContext)
    const {
      issuerBaseUrl: credentialIssuer,
      tokenEndpointPath: tokenEndpoint,
      credentialEndpointPath: credentialEndpoint,
      credentialsSupported,
    } = issuerMetadata

    const builder = new VcIssuerBuilder()
      .withCredentialIssuer(credentialIssuer.toString())
      .withCredentialEndpoint(credentialEndpoint.toString())
      .withTokenEndpoint(tokenEndpoint.toString())
      .withCredentialsSupported(credentialsSupported)
      .withCNonceExpiresIn(this.openId4VcIssuerModuleConfig.cNonceExpiresIn)
      .withCNonceStateManager(this.openId4VcIssuerModuleConfig.getCNonceStateManager(agentContext))
      .withCredentialOfferStateManager(
        this.openId4VcIssuerModuleConfig.getCredentialOfferSessionStateManager(agentContext)
      )
      .withCredentialOfferURIStateManager(this.openId4VcIssuerModuleConfig.getUriStateManager(agentContext))
      .withJWTVerifyCallback(this.getJwtVerifyCallback(agentContext))
      .withCredentialSignerCallback(() => {
        throw new AriesFrameworkError('this should never ba called')
      })

    if (issuerMetadata.authorizationServerUrl) {
      builder.withAuthorizationServer(issuerMetadata.authorizationServerUrl.toString())
    }

    if (issuerMetadata.issuerDisplay) {
      builder.withIssuerDisplay(issuerMetadata.issuerDisplay)
    }

    return builder.build()
  }

  private async getGrantsFromConfig(
    agentContext: AgentContext,
    preAuthorizedCodeFlowConfig?: PreAuthorizedCodeFlowConfig,
    authorizationCodeFlowConfig?: AuthorizationCodeFlowConfig
  ) {
    if (!preAuthorizedCodeFlowConfig && !authorizationCodeFlowConfig) {
      throw new AriesFrameworkError(
        `Either preAuthorizedCodeFlowConfig or authorizationCodeFlowConfig must be provided.`
      )
    }

    const grants: Grant = {
      'urn:ietf:params:oauth:grant-type:pre-authorized_code': preAuthorizedCodeFlowConfig && {
        'pre-authorized_code':
          preAuthorizedCodeFlowConfig.preAuthorizedCode ?? (await agentContext.wallet.generateNonce()),
        user_pin_required: preAuthorizedCodeFlowConfig.userPinRequired ?? false,
      },

      authorization_code: authorizationCodeFlowConfig && {
        issuer_state: authorizationCodeFlowConfig.issuerState ?? (await agentContext.wallet.generateNonce()),
      },
    }

    return grants
  }

  public async createCredentialOfferAndRequest(
    agentContext: AgentContext,
    offeredCredentials: OfferedCredential[],
    options: CreateCredentialOfferAndRequestOptions
  ): Promise<CredentialOfferAndRequest> {
    const { preAuthorizedCodeFlowConfig, authorizationCodeFlowConfig } = options

    // this checks if the structure of the credentials is correct
    // it throws an error if a offered credential cannot be found in the credentialsSupported
    getOfferedCredentialsWithMetadata(offeredCredentials, this.issuerMetadata.credentialsSupported)

    const vcIssuer = this.getVcIssuer(agentContext)

    const { uri, session } = await vcIssuer.createCredentialOfferURI({
      grants: await this.getGrantsFromConfig(agentContext, preAuthorizedCodeFlowConfig, authorizationCodeFlowConfig),
      credentials: offeredCredentials,
      credentialOfferUri: options.credentialOfferUri,
      scheme: options.scheme ?? 'https',
      baseUri: options.baseUri ?? '',
      // credentialDefinition,
    })

    return {
      credentialOfferPayload: session.credentialOffer.credential_offer,
      credentialOfferRequest: uri,
    }
  }

  private async getCredentialOfferSessionFromUri(agentContext: AgentContext, uri: string) {
    const uriState = await this.openId4VcIssuerModuleConfig.getUriStateManager(agentContext).get(uri)
    if (!uriState) throw new AriesFrameworkError(`Credential offer uri '${uri}' not found.`)

    const credentialOfferSessionId = uriState.preAuthorizedCode ?? uriState.issuerState
    if (!credentialOfferSessionId) {
      throw new AriesFrameworkError(
        `Credential offer uri '${uri}' is not associated with a preAuthorizedCode or issuerState.`
      )
    }

    const credentialOfferSession = await this.openId4VcIssuerModuleConfig
      .getCredentialOfferSessionStateManager(agentContext)
      .get(credentialOfferSessionId)
    if (!credentialOfferSession)
      throw new AriesFrameworkError(
        `Credential offer session for '${uri}' with id '${credentialOfferSessionId}' not found.`
      )

    return { credentialOfferSessionId, credentialOfferSession }
  }

  public async getCredentialOfferFromUri(agentContext: AgentContext, uri: string) {
    const { credentialOfferSessionId, credentialOfferSession } = await this.getCredentialOfferSessionFromUri(
      agentContext,
      uri
    )

    credentialOfferSession.lastUpdatedAt = +new Date()
    credentialOfferSession.status = IssueStatus.OFFER_URI_RETRIEVED
    await this.openId4VcIssuerModuleConfig
      .getCredentialOfferSessionStateManager(agentContext)
      .set(credentialOfferSessionId, credentialOfferSession)

    return credentialOfferSession.credentialOffer.credential_offer
  }

  private findOfferedCredentialsMatchingRequest(
    credentialOffer: CredentialOfferPayloadV1_0_11,
    credentialRequest: CredentialRequestV1_0_11,
    credentialsSupported: CredentialSupported[]
  ): OfferedCredentialWithMetadata[] {
    const offeredCredentials = getOfferedCredentialsWithMetadata(credentialOffer.credentials, credentialsSupported)

    return offeredCredentials.filter((offeredCredential) => {
      if (offeredCredential.format !== credentialRequest.format) return false

      if (credentialRequest.format === OpenIdCredentialFormatProfile.JwtVcJson) {
        return equalsIgnoreOrder(offeredCredential.types, credentialRequest.types)
      } else if (
        credentialRequest.format === OpenIdCredentialFormatProfile.JwtVcJsonLd ||
        credentialRequest.format === OpenIdCredentialFormatProfile.LdpVc
      ) {
        return equalsIgnoreOrder(offeredCredential.types, credentialRequest.credential_definition.types)
      } else if (credentialRequest.format === OpenIdCredentialFormatProfile.SdJwtVc) {
        return equalsIgnoreOrder(offeredCredential.types, [credentialRequest.credential_definition.vct])
      }
    })
  }

  private getSdJwtVcCredentialSigningCallback = (agentContext: AgentContext): CredentialSignerCallback<DidDocument> => {
    return async (opts) => {
      const { credential } = opts

      const sdJwtVcApi = getApiForModuleByName<SdJwtVcModule>(agentContext, 'SdJwtVcModule')
      if (!sdJwtVcApi) throw new AriesFrameworkError(`Could not find the SdJwtVcApi`)
      const { compact } = await sdJwtVcApi.signCredential(credential as any)

      return compact as any
    }
  }

  private getW3cCredentialSigningCallback = (
    agentContext: AgentContext,
    issuerVerificationMethod: VerificationMethod
  ): CredentialSignerCallback<DidDocument> => {
    return async (opts) => {
      const { credential, jwtVerifyResult, format } = opts

      const { alg, kid, didDocument: holderDidDocument } = jwtVerifyResult

      if (!kid) throw new AriesFrameworkError('Missing Kid. Cannot create the holder binding')
      if (!holderDidDocument) throw new AriesFrameworkError('Missing did document. Cannot create the holder binding.')

      // If the Credential shall be bound to a DID, the kid refers to a DID URL which identifies a
      // particular key in the DID Document that the Credential shall be bound to.
      const holderVerificationMethod = holderDidDocument.dereferenceKey(kid, ['assertionMethod'])

      let signed: W3cVerifiableCredential<ClaimFormat.JwtVc | ClaimFormat.LdpVc>
      if (format === OpenIdCredentialFormatProfile.JwtVcJson || format === OpenIdCredentialFormatProfile.JwtVcJsonLd) {
        signed = await this.w3cCredentialService.signCredential(agentContext, {
          format: ClaimFormat.JwtVc,
          credential: W3cCredential.fromJson(credential),
          verificationMethod: issuerVerificationMethod.id,
          alg: alg as JwaSignatureAlgorithm,
        })
      } else if (format === OpenIdCredentialFormatProfile.LdpVc) {
        signed = await this.w3cCredentialService.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential: W3cCredential.fromJson(credential),
          verificationMethod: issuerVerificationMethod.id,
          proofPurpose: 'assertionMethod',
          proofType: getProofTypeFromVerificationMethod(agentContext, holderVerificationMethod),
        })
      } else {
        throw new AriesFrameworkError(`Unsupported credential format '${format}' for W3C credential signing callback.`)
      }

      return getSphereonW3cVerifiableCredential(signed)
    }
  }

  private getCredentialDataSupplier = (
    agentContext: AgentContext,
    credential: SdJwtCredential | W3cCredential,
    issuerVerificationMethod: VerificationMethod
  ): CredentialDataSupplier => {
    return async (args: CredentialDataSupplierArgs) => {
      const { credentialRequest, credentialOffer } = args

      const offeredCredentialsMatchingRequest = this.findOfferedCredentialsMatchingRequest(
        credentialOffer.credential_offer,
        credentialRequest,
        this.issuerMetadata.credentialsSupported
      )

      if (offeredCredentialsMatchingRequest.length === 0) {
        throw new AriesFrameworkError('No offered credentials match the credential request.')
      }

      if (credential instanceof W3cCredential) {
        if (
          credentialRequest.format !== OpenIdCredentialFormatProfile.JwtVcJson &&
          credentialRequest.format !== OpenIdCredentialFormatProfile.JwtVcJsonLd &&
          credentialRequest.format !== OpenIdCredentialFormatProfile.LdpVc
        ) {
          throw new AriesFrameworkError(
            `The credential to be issued does not match the request. Cannot issue a W3cCredential if the client expects a credential of format '${credentialRequest.format}'.`
          )
        }
        const issuedCredentialMatchesRequest = offeredCredentialsMatchingRequest.find((offeredCredential) => {
          return equalsIgnoreOrder(offeredCredential.types, credential.type)
        })

        if (!issuedCredentialMatchesRequest) {
          throw new AriesFrameworkError(
            `The types of the offered credentials do not match the types of the requested credential. Requested '${credential.type}'.`
          )
        }

        return {
          format: credentialRequest.format,
          credential: JsonTransformer.toJSON(credential) as ICredential,
          signCallback: this.getW3cCredentialSigningCallback(agentContext, issuerVerificationMethod),
        }
      } else {
        if (credentialRequest.format !== OpenIdCredentialFormatProfile.SdJwtVc) {
          throw new AriesFrameworkError(
            `Invalid credential format. Expected '${OpenIdCredentialFormatProfile.SdJwtVc}', received '${credentialRequest.format}'.`
          )
        }
        if (credentialRequest.credential_definition.vct !== credential.payload.type) {
          throw new AriesFrameworkError(
            `The types of the offered credentials do not match the types of the requested credential. Offered '${credential.payload.vct}' Requested '${credentialRequest.credential_definition.vct}'.`
          )
        }

        return {
          format: credentialRequest.format,
          credential: credential as any, // TODO: sdjwt
          signCallback: this.getSdJwtVcCredentialSigningCallback(agentContext),
        }
      }
    }
  }

  public async createIssueCredentialResponse(
    agentContext: AgentContext,
    options: CreateIssueCredentialResponseOptions
  ) {
    const { credentialRequest, credential, verificationMethod } = options
    if (!credentialRequest.proof) throw new AriesFrameworkError('No proof defined in the credentialRequest.')

    const vcIssuer = this.getVcIssuer(agentContext)
    const issueCredentialResponse = await vcIssuer.issueCredential({
      credentialRequest,
      tokenExpiresIn: this.openId4VcIssuerModuleConfig.tokenExpiresIn,
      cNonceExpiresIn: this.openId4VcIssuerModuleConfig.cNonceExpiresIn,
      credentialDataSupplier: this.getCredentialDataSupplier(agentContext, credential, verificationMethod),
      credential: undefined,
      newCNonce: undefined,
      credentialDataSupplierInput: undefined,
      responseCNonce: undefined,
    })

    if (!issueCredentialResponse.credential) {
      throw new AriesFrameworkError('No credential found in the issueCredentialResponse.')
    }

    if (issueCredentialResponse.acceptance_token) {
      throw new AriesFrameworkError('Acceptance token not yet supported.')
    }

    return issueCredentialResponse
  }

  public configureRouter = (
    initializationContext: AgentContext,
    router: Router,
    endpointConfig: IssuerEndpointConfig
  ) => {
    const { basePath } = endpointConfig
    this.openId4VcIssuerModuleConfig.setBasePath(initializationContext, basePath)

    // parse application/x-www-form-urlencoded
    router.use(bodyParser.urlencoded({ extended: false }))
    // parse application/json
    router.use(bodyParser.json())
    // initialize the agent and set the request context
    router.use(async (req: IssuanceRequest, _res: Response, next: NextFunction) => {
      const agentContext = await initializeAgentFromContext(
        initializationContext.contextCorrelationId,
        this.agentContextProvider
      )

      req.requestContext = {
        agentContext,
        openId4vcIssuerService: agentContext.dependencyManager.resolve(OpenId4VcIssuerService),
        logger: agentContext.dependencyManager.resolve(InjectionSymbols.Logger),
      }

      next()
    })

    if (endpointConfig.metadataEndpointConfig?.enabled) {
      const wellKnownPath = `/.well-known/openid-credential-issuer`
      configureIssuerMetadataEndpoint(router, wellKnownPath)

      const endpointPath = getEndpointUrl(this.issuerMetadata.issuerBaseUrl, basePath, wellKnownPath)
      this.logger.info(`[OID4VCI] Metadata endpoint running at '${endpointPath}'.`)
    }

    if (endpointConfig.accessTokenEndpointConfig?.enabled) {
      const accessTokenEndpointPath = this.issuerMetadata.tokenEndpointPath
      configureAccessTokenEndpoint(router, accessTokenEndpointPath, {
        ...endpointConfig.accessTokenEndpointConfig,
        cNonceExpiresIn: this.openId4VcIssuerModuleConfig.cNonceExpiresIn,
        tokenExpiresIn: this.openId4VcIssuerModuleConfig.tokenExpiresIn,
      })

      const endpointPath = getEndpointUrl(this.issuerMetadata.issuerBaseUrl, basePath, accessTokenEndpointPath)
      this.logger.info(`[OID4VCI] Token endpoint running at '${endpointPath}'.`)
    }

    if (endpointConfig.credentialEndpointConfig?.enabled) {
      const credentialEndpointPath = this.issuerMetadata.credentialEndpointPath
      configureCredentialEndpoint(router, credentialEndpointPath, {
        ...endpointConfig.credentialEndpointConfig,
      })

      const endpointUrl = getEndpointUrl(this.issuerMetadata.issuerBaseUrl, basePath, credentialEndpointPath)
      this.logger.info(`[OID4VCI] Credential endpoint running at '${endpointUrl}'.`)
    }

    router.use(async (req: IssuanceRequest, _res, next) => {
      const { agentContext } = getRequestContext(req)
      await agentContext.endSession()
      next()
    })

    return router
  }
}
