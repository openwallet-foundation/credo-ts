import type {
  CreateCredentialOfferOptions,
  AuthorizationCodeFlowConfig,
  PreAuthorizedCodeFlowConfig,
  OfferedCredential,
  IssuerMetadata,
  CreateIssueCredentialResponseOptions,
} from './OpenId4VcIssuerServiceOptions'
import type {
  AgentContext,
  VerificationMethod,
  W3cVerifiableCredential,
  DidDocument,
  JwaSignatureAlgorithm,
} from '@aries-framework/core'
import type {
  CredentialRequestJwtVc,
  CredentialRequestLdpVc,
  Grant,
  CredentialSupported,
  MetadataDisplay,
  JWTVerifyCallback,
  CredentialOfferFormat,
  CredentialRequestV1_0_11,
  CredentialOfferPayloadV1_0_11,
  IStateManager,
  CNonceState,
  CredentialOfferSession,
  URIState,
} from '@sphereon/oid4vci-common'
import type {
  CredentialDataSupplier,
  CredentialDataSupplierArgs,
  CredentialSignerCallback,
} from '@sphereon/oid4vci-issuer'
import type { ICredential, W3CVerifiableCredential as SphereonW3cVerifiableCredential } from '@sphereon/ssi-types'

import {
  AriesFrameworkError,
  ClaimFormat,
  InjectionSymbols,
  JwsService,
  Logger,
  W3cCredentialService,
  inject,
  injectable,
  JsonTransformer,
  W3cCredential,
  Jwt,
  SignatureSuiteRegistry,
  DidsApi,
  getKeyFromVerificationMethod,
  getJwkFromKey,
  equalsIgnoreOrder,
} from '@aries-framework/core'
import { IssueStatus } from '@sphereon/oid4vci-common'
import { MemoryStates, VcIssuerBuilder } from '@sphereon/oid4vci-issuer'

import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'

// TODO: duplicate
function getSphereonW3cVerifiableCredential(
  w3cVerifiableCredential: W3cVerifiableCredential
): SphereonW3cVerifiableCredential {
  if (w3cVerifiableCredential.claimFormat === ClaimFormat.LdpVc) {
    return JsonTransformer.toJSON(w3cVerifiableCredential) as SphereonW3cVerifiableCredential
  } else if (w3cVerifiableCredential.claimFormat === ClaimFormat.JwtVc) {
    return w3cVerifiableCredential.serializedJwt
  } else {
    throw new AriesFrameworkError(
      `Unsupported claim format. Only ${ClaimFormat.LdpVc} and ${ClaimFormat.JwtVc} are supported.`
    )
  }
}

/**
 * @internal
 */
@injectable()
export class OpenId4VcIssuerService {
  private logger: Logger
  private w3cCredentialService: W3cCredentialService
  private jwsService: JwsService
  private cNonceExpiresIn: number = 5 * 60 * 1000 // 5 minutes
  private tokenExpiresIn: number = 3 * 60 * 1000 // 3 minutes
  private issuerMetadata: IssuerMetadata
  private _cNonceStateManager: IStateManager<CNonceState>
  private _credentialOfferSessionManager: IStateManager<CredentialOfferSession>
  private _uriStateManager: IStateManager<URIState>

  public get cNonceStateManager() {
    return this._cNonceStateManager
  }

  public get credentialOfferSessionManager() {
    return this._credentialOfferSessionManager
  }

  public get uriStateManager() {
    return this._uriStateManager
  }

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    openId4VcIssuerModuleConfig: OpenId4VcIssuerModuleConfig,
    w3cCredentialService: W3cCredentialService,
    jwsService: JwsService
  ) {
    this.w3cCredentialService = w3cCredentialService
    this.logger = logger
    this.issuerMetadata = openId4VcIssuerModuleConfig.issuerMetadata
    this.jwsService = jwsService
    this._cNonceStateManager = openId4VcIssuerModuleConfig.cNonceStateManager ?? new MemoryStates()
    this._credentialOfferSessionManager =
      openId4VcIssuerModuleConfig.credentialOfferSessionManager ?? new MemoryStates()
    this._uriStateManager = openId4VcIssuerModuleConfig.uriStateManager ?? new MemoryStates()
  }

  // TODO: check if this is correct
  private getProofTypeForLdpVc(agentContext: AgentContext, verificationMethod: VerificationMethod) {
    const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

    const supportedSignatureSuite = signatureSuiteRegistry.getByVerificationMethodType(verificationMethod.type)
    if (!supportedSignatureSuite) {
      throw new AriesFrameworkError(
        `Couldn't find a supported signature suite for the given verification method type '${verificationMethod.type}'.`
      )
    }

    return supportedSignatureSuite.proofType
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

  private getCredentialSigningCallback = (
    agentContext: AgentContext,
    issuerVerificationMethod: VerificationMethod
  ): CredentialSignerCallback<DidDocument> => {
    return async (opts) => {
      const { credential, jwtVerifyResult, format } = opts

      const { alg, kid, didDocument: holderDidDocument } = jwtVerifyResult

      if (!kid) throw new AriesFrameworkError('No KID present for binding the credential to a holder.')
      if (!holderDidDocument) {
        throw new AriesFrameworkError('No DID document present for binding the credential to a holder.')
      }

      // If the Credential shall be bound to a DID, the kid refers to a DID URL which identifies a
      // particular key in the DID Document that the Credential shall be bound to.
      // TODO: proofpurpose
      const holderVerificationMethod = holderDidDocument.dereferenceKey(kid, ['assertionMethod', 'assertionMethod'])

      let signed: W3cVerifiableCredential<ClaimFormat.JwtVc | ClaimFormat.LdpVc>
      if (format === 'jwt_vc_json' || format === 'jwt_vc_json-ld') {
        signed = await this.w3cCredentialService.signCredential(agentContext, {
          format: ClaimFormat.JwtVc,
          credential: W3cCredential.fromJson(credential),
          verificationMethod: issuerVerificationMethod.id,
          alg: alg as JwaSignatureAlgorithm,
        })
      } else {
        signed = await this.w3cCredentialService.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential: W3cCredential.fromJson(credential),
          verificationMethod: issuerVerificationMethod.id,
          proofPurpose: 'authentication', // TODO: is it authentication?
          proofType: this.getProofTypeForLdpVc(agentContext, holderVerificationMethod),
        })
      }

      return getSphereonW3cVerifiableCredential(signed)
    }
  }

  private getVcIssuer(
    agentContext: AgentContext,
    options: {
      credentialIssuer: string
      credentialEndpoint: string
      tokenEndpoint: string
      credentialsSupported: CredentialSupported[]
      authorizationServer?: string
      issuerDisplay?: MetadataDisplay | MetadataDisplay[]
    }
  ) {
    const { credentialIssuer, tokenEndpoint, credentialEndpoint, credentialsSupported } = options
    const builder = new VcIssuerBuilder()
      .withCredentialIssuer(credentialIssuer)
      .withCredentialEndpoint(credentialEndpoint)
      .withTokenEndpoint(tokenEndpoint)
      .withCredentialsSupported(credentialsSupported)
      .withCNonceExpiresIn(this.cNonceExpiresIn) // 5 minutes
      .withCNonceStateManager(this._cNonceStateManager)
      .withCredentialOfferStateManager(this._credentialOfferSessionManager)
      .withCredentialOfferURIStateManager(this._uriStateManager)
      .withJWTVerifyCallback(this.getJwtVerifyCallback(agentContext))
      .withCredentialSignerCallback(() => {
        throw new AriesFrameworkError('this should never ba called')
      })

    if (options.authorizationServer) {
      builder.withAuthorizationServer(options.authorizationServer)
    }

    if (options.issuerDisplay) {
      builder.withIssuerDisplay(options.issuerDisplay)
    }

    return builder.build()
  }

  private getGrantsFromConfig(
    preAuthorizedCodeFlowConfig?: PreAuthorizedCodeFlowConfig,
    authorizationCodeFlowConfig?: AuthorizationCodeFlowConfig
  ) {
    if (!preAuthorizedCodeFlowConfig && !authorizationCodeFlowConfig) {
      throw new AriesFrameworkError(
        `Either preAuthorizedCodeFlowConfig or authorizationCodeFlowConfig must be provided.`
      )
    }

    let grants: Grant = {}
    if (preAuthorizedCodeFlowConfig) {
      grants = {
        ...grants,
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          /**
           * REQUIRED. The code representing the Credential Issuer's authorization for the Wallet to obtain Credentials of a certain type.
           */
          'pre-authorized_code': preAuthorizedCodeFlowConfig.preAuthorizedCode,
          /**
           * OPTIONAL. Boolean value specifying whether the Credential Issuer expects presentation of a user PIN along with the Token Request
           * in a Pre-Authorized Code Flow. Default is false.
           */
          user_pin_required: preAuthorizedCodeFlowConfig.userPinRequired ?? false,
        },
      }
    }

    if (authorizationCodeFlowConfig) {
      grants = {
        ...grants,
        authorization_code: { issuer_state: authorizationCodeFlowConfig.issuerState },
      }
    }

    return grants
  }

  private mapInlineCredentialOfferIdToCredentialSupported(id: string, credentialsSupported: CredentialSupported[]) {
    const credentialSupported = credentialsSupported.find((cs) => cs.id === id)
    if (!credentialSupported) throw new AriesFrameworkError(`Credential supported with id '${id}' not found.`)

    return credentialSupported
  }

  private getCredentialMetadata(
    credential: CredentialSupported | CredentialOfferFormat
  ): CredentialRequestJwtVc | CredentialRequestLdpVc {
    if (credential.format === 'jwt_vc_json' || credential.format === 'jwt_vc_json-ld') {
      return {
        format: credential.format,
        types: credential.types,
      }
    } else {
      // TODO:
      throw new AriesFrameworkError('Unsupported credential format')
    }
  }

  private getOfferedCredentialsMetadata(
    credentials: (CredentialOfferFormat | string)[],
    credentialsSupported: CredentialSupported[]
  ) {
    const credentialsReferencingCredentialsSupported = credentials
      .filter((credential): credential is string => typeof credential === 'string')
      .map((credentialId) => this.mapInlineCredentialOfferIdToCredentialSupported(credentialId, credentialsSupported))
      .map((credentialSupported) => this.getCredentialMetadata(credentialSupported))

    const inlineCredentialOffers = credentials
      .filter((credential): credential is CredentialOfferFormat => typeof credential !== 'string')
      .map((credential) => this.getCredentialMetadata(credential))

    return [...credentialsReferencingCredentialsSupported, ...inlineCredentialOffers]
  }

  public async createCredentialOffer(
    agentContext: AgentContext,
    offeredCredentials: OfferedCredential[],
    options: CreateCredentialOfferOptions
  ) {
    const { preAuthorizedCodeFlowConfig, authorizationCodeFlowConfig } = options

    const issuerMetadata = options.issuerMetadata ?? this.issuerMetadata

    // this checks if the structure of the credentials is correct
    // it throws an error if a offered credential cannot be found in the credentialsSupported
    this.getOfferedCredentialsMetadata(offeredCredentials, issuerMetadata.credentialsSupported)

    const vcIssuer = this.getVcIssuer(agentContext, issuerMetadata)

    const { uri, session } = await vcIssuer.createCredentialOfferURI({
      grants: this.getGrantsFromConfig(preAuthorizedCodeFlowConfig, authorizationCodeFlowConfig),
      credentials: offeredCredentials,
      credentialOfferUri: options.credentialOfferUri,
      scheme: options.scheme ?? 'https',
      baseUri: options.baseUri,
      // TODO: THIS IS WRONG HOW TO SPECIFY ldp_ creds?
      // credentialDefinition,
    })

    return {
      credentialOffer: session.credentialOffer.credential_offer,
      credentialOfferRequest: uri,
    }
  }

  private async getCredentialOfferSessionFromUri(uri: string) {
    const uriState = await this._uriStateManager.get(uri)
    if (!uriState) throw new AriesFrameworkError(`Credential offer uri '${uri}' not found.`)

    const credentialOfferSessionId = uriState.preAuthorizedCode ?? uriState.issuerState

    if (!credentialOfferSessionId) {
      throw new AriesFrameworkError(
        `Credential offer uri '${uri}' is not associated with a preAuthorizedCode or issuerState.`
      )
    }

    const credentialOfferSession = await this._credentialOfferSessionManager.get(credentialOfferSessionId)
    if (!credentialOfferSession)
      throw new AriesFrameworkError(
        `Credential offer session for '${uri}' with id '${credentialOfferSessionId}' not found.`
      )

    return { credentialOfferSessionId, credentialOfferSession }
  }

  public async getCredentialOfferFromUri(uri: string) {
    const { credentialOfferSession, credentialOfferSessionId } = await this.getCredentialOfferSessionFromUri(uri)

    credentialOfferSession.lastUpdatedAt = +new Date()
    credentialOfferSession.status = IssueStatus.OFFER_URI_RETRIEVED
    await this._credentialOfferSessionManager.set(credentialOfferSessionId, credentialOfferSession)

    return credentialOfferSession.credentialOffer.credential_offer
  }

  private findOfferedCredentialsMatchingRequest(
    credentialOffer: CredentialOfferPayloadV1_0_11,
    credentialRequest: CredentialRequestV1_0_11,
    credentialsSupported: CredentialSupported[]
  ) {
    const offeredCredentials = this.getOfferedCredentialsMetadata(credentialOffer.credentials, credentialsSupported)

    return offeredCredentials.filter((offeredCredential) => {
      if (credentialRequest.format === 'jwt_vc_json' && offeredCredential.format === 'jwt_vc_json') {
        return equalsIgnoreOrder(offeredCredential.types, credentialRequest.types)
      } else if (credentialRequest.format === 'jwt_vc_json-ld' && offeredCredential.format === 'jwt_vc_json-ld') {
        return equalsIgnoreOrder(offeredCredential.types, credentialRequest.types)
      } else if (credentialRequest.format === 'ldp_vc' && offeredCredential.format === 'ldp_vc') {
        return equalsIgnoreOrder(
          offeredCredential.credential_definition.types,
          credentialRequest.credential_definition.types
        )
      } else {
        throw new AriesFrameworkError(`Unsupported credential format ${credentialRequest.format}.`)
      }
    })
  }

  private getCredentialDataSupplier = (
    agentContext: AgentContext,
    credential: W3cCredential,
    credentialsSupported: CredentialSupported[],
    issuerVerificationMethod: VerificationMethod
  ): CredentialDataSupplier => {
    return async (args: CredentialDataSupplierArgs) => {
      const { credentialRequest, credentialOffer } = args

      const offeredCredentialsMatchingRequest = this.findOfferedCredentialsMatchingRequest(
        credentialOffer.credential_offer,
        credentialRequest,
        credentialsSupported
      )

      if (offeredCredentialsMatchingRequest.length === 0) {
        throw new AriesFrameworkError('No offered credential matches the requested credential.')
      }

      const issuedCredentialMatchesRequest = offeredCredentialsMatchingRequest.find(
        (offeredCredential) =>
          ((offeredCredential.format === 'jwt_vc_json-ld' || offeredCredential.format === 'jwt_vc_json') &&
            equalsIgnoreOrder(offeredCredential.types, credential.type)) ||
          (offeredCredential.format === 'ldp_vc' &&
            equalsIgnoreOrder(offeredCredential.credential_definition.types, credential.type))
      )

      if (!issuedCredentialMatchesRequest) {
        throw new AriesFrameworkError('The credential to be issued does not match the request.')
      }

      const sphereonICredential = JsonTransformer.toJSON(credential) as ICredential

      return {
        format: credentialRequest.format,
        credential: sphereonICredential,
        signCallback: this.getCredentialSigningCallback(agentContext, issuerVerificationMethod),
      }
    }
  }

  public async createIssueCredentialResponse(
    agentContext: AgentContext,
    options: CreateIssueCredentialResponseOptions
  ) {
    const { credentialRequest, credential, verificationMethod } = options

    const issuerMetadata = options.issuerMetadata ?? this.issuerMetadata
    const vcIssuer = this.getVcIssuer(agentContext, issuerMetadata)

    const issueCredentialResponse = await vcIssuer.issueCredential({
      credentialRequest,
      tokenExpiresIn: this.tokenExpiresIn,
      cNonceExpiresIn: this.cNonceExpiresIn,
      credentialDataSupplier: this.getCredentialDataSupplier(
        agentContext,
        credential,
        issuerMetadata.credentialsSupported,
        verificationMethod
      ),
      credential: undefined,
      newCNonce: undefined,
      credentialDataSupplierInput: undefined,
      responseCNonce: undefined,
    })

    if (!issueCredentialResponse.credential) {
      throw new AriesFrameworkError('No credential defined in the issueCredentialResponse.')
    }

    if (issueCredentialResponse.acceptance_token) {
      throw new AriesFrameworkError('Acceptance token not yet supported.')
    }

    return issueCredentialResponse
  }
}
