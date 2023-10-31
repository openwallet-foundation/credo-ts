import type { PresentationSubmission } from './selection'
import type { CredentialsForInputDescriptor } from './selection/types'
import type {
  AgentContext,
  JwaSignatureAlgorithm,
  VerificationMethod,
  W3cCredentialRecord,
  W3cVerifiablePresentation,
} from '@aries-framework/core'
import type {
  ClientMetadataOpts,
  DIDDocument,
  PresentationDefinitionWithLocation,
  PresentationVerificationCallback,
  URI,
  Verification,
  VerifiedAuthorizationRequest,
} from '@sphereon/did-auth-siop'
import type { PresentationDefinitionV1 } from '@sphereon/pex-models'
import type { W3CVerifiablePresentation } from '@sphereon/ssi-types'

import {
  AriesFrameworkError,
  DidsApi,
  getJwkClassFromKeyType,
  getKeyFromVerificationMethod,
  injectable,
  TypedArrayEncoder,
  W3cJsonLdVerifiablePresentation,
  asArray,
  inject,
  InjectionSymbols,
  Logger,
  JwsService,
} from '@aries-framework/core'
import {
  OP,
  ResponseIss,
  ResponseMode,
  SupportedVersion,
  VerificationMode,
  CheckLinkedDomain,
  RP,
  SigningAlgo,
  RevocationVerification,
  ResponseType,
  Scope,
  SubjectType,
  PassBy,
} from '@sphereon/did-auth-siop'

import { PresentationExchangeService } from './PresentationExchangeService'

export const staticOpSiopConfig: ClientMetadataOpts & { authorization_endpoint: string } = {
  authorization_endpoint: 'siopv2:',
  subject_syntax_types_supported: ['urn:ietf:params:oauth:jwk-thumbprint'],
  responseTypesSupported: [ResponseType.ID_TOKEN],
  scopesSupported: [Scope.OPENID],
  subjectTypesSupported: [SubjectType.PAIRWISE],
  idTokenSigningAlgValuesSupported: [SigningAlgo.ES256],
  requestObjectSigningAlgValuesSupported: [SigningAlgo.ES256],
  passBy: PassBy.VALUE,
}

export const staticOpOpenIdConfig: ClientMetadataOpts & { authorization_endpoint: string } = {
  authorization_endpoint: 'openid:',
  subject_syntax_types_supported: ['urn:ietf:params:oauth:jwk-thumbprint'],
  responseTypesSupported: [ResponseType.ID_TOKEN, ResponseType.VP_TOKEN],
  scopesSupported: [Scope.OPENID],
  subjectTypesSupported: [SubjectType.PAIRWISE],
  idTokenSigningAlgValuesSupported: [SigningAlgo.ES256],
  requestObjectSigningAlgValuesSupported: [SigningAlgo.ES256],
  passBy: PassBy.VALUE,
  vpFormatsSupported: { jwt_vc: { alg: [SigningAlgo.ES256] }, jwt_vp: { alg: [SigningAlgo.ES256] } },
}

export function getSupportedDidMethods(agentContext: AgentContext) {
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const supportedDidMethods: Set<string> = new Set()

  for (const resolver of didsApi.config.resolvers) {
    resolver.supportedMethods.forEach((method) => supportedDidMethods.add(method))
  }

  return Array.from(supportedDidMethods)
}

/**
 * SIOPv2 Authorization Request with a single v1 presentation definition
 */
export type VerifiedAuthorizationRequestWithPresentationDefinition = VerifiedAuthorizationRequest & {
  presentationDefinitions: [PresentationDefinitionWithLocation & { definition: PresentationDefinitionV1 }]
}

function isVerifiedAuthorizationRequestWithPresentationDefinition(
  request: VerifiedAuthorizationRequest
): request is VerifiedAuthorizationRequestWithPresentationDefinition {
  return (
    request.presentationDefinitions !== undefined &&
    request.presentationDefinitions.length === 1 &&
    request.presentationDefinitions?.[0]?.definition !== undefined
  )
}

// TODO: duplicate
/**
 * Returns the JWA Signature Algorithms that are supported by the wallet.
 *
 * This is an approximation based on the supported key types of the wallet.
 * This is not 100% correct as a supporting a key type does not mean you support
 * all the algorithms for that key type. However, this needs refactoring of the wallet
 * that is planned for the 0.5.0 release.
 */
function getSupportedJwaSignatureAlgorithms(agentContext: AgentContext): JwaSignatureAlgorithm[] {
  const supportedKeyTypes = agentContext.wallet.supportedKeyTypes

  // Extract the supported JWS algs based on the key types the wallet support.
  const supportedJwaSignatureAlgorithms = supportedKeyTypes
    // Map the supported key types to the supported JWK class
    .map(getJwkClassFromKeyType)
    // Filter out the undefined values
    .filter((jwkClass): jwkClass is Exclude<typeof jwkClass, undefined> => jwkClass !== undefined)
    // Extract the supported JWA signature algorithms from the JWK class
    .flatMap((jwkClass) => jwkClass.supportedSignatureAlgorithms)

  return supportedJwaSignatureAlgorithms
}

export function getResolver(agentContext: AgentContext) {
  return {
    resolve: async (didUrl: string) => {
      const didsApi = agentContext.dependencyManager.resolve(DidsApi)
      const result = await didsApi.resolve(didUrl)

      return {
        ...result,
        didDocument: result.didDocument?.toJSON() as DIDDocument,
      }
    },
  }
}

@injectable()
export class OpenId4VpHolderService {
  private logger: Logger
  private jwsService: JwsService
  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    jwsService: JwsService,
    private presentationExchangeService: PresentationExchangeService
  ) {
    this.jwsService = jwsService
    this.logger = logger
  }

  public async getRelyingParty(
    agentContext: AgentContext,
    options: {
      verificationMethod: VerificationMethod | ((clientMetadata: ClientMetadataOpts) => VerificationMethod)
      clientMetadata?: ClientMetadataOpts & { authorization_endpoint?: string }
      issuer?: string
      redirect_url: string
    }
  ) {
    const { verificationMethod: _verificationMethod, issuer, redirect_url } = options

    const supportedDidMethods = getSupportedDidMethods(agentContext)

    // authorization_endpoint
    // TODO:
    const isVpRequest = false

    let clientMetadata: ClientMetadataOpts & { authorization_endpoint?: string }
    if (options.clientMetadata) {
      // use the provided client metadata
      clientMetadata = options.clientMetadata
    } else if (issuer) {
      // Use OpenId Discovery to get the client metadata
      let reference_uri = issuer
      if (!issuer.endsWith('/.well-known/openid-configuration')) {
        reference_uri = issuer + '/.well-known/openid-configuration'
      }
      clientMetadata = { reference_uri, passBy: PassBy.REFERENCE }
    } else if (isVpRequest) {
      // if neither clientMetadata nor issuer is provided, use a static config
      clientMetadata = staticOpOpenIdConfig
    } else {
      // if neither clientMetadata nor issuer is provided, use a static config
      clientMetadata = staticOpSiopConfig
    }

    let verificationMethod: VerificationMethod
    if (typeof _verificationMethod === 'function') {
      verificationMethod = _verificationMethod(clientMetadata)
    } else {
      verificationMethod = _verificationMethod
    }

    const { signature, did, kid, alg } = await this.getSuppliedSignatureFromVerificationMethod(
      agentContext,
      verificationMethod
    )

    // Check if the OpenId Provider (Holder) can validate the request signature provided by the Relying Party (Verifier)
    const requestObjectSigningAlgValuesSupported = clientMetadata.requestObjectSigningAlgValuesSupported
    if (requestObjectSigningAlgValuesSupported && !requestObjectSigningAlgValuesSupported.includes(alg)) {
      throw new AriesFrameworkError(
        [
          `Cannot sign authorization request with '${alg}' that isn't supported by the OpenId Provider.`,
          `Supported algorithms are ${requestObjectSigningAlgValuesSupported}`,
        ].join('\n')
      )
    }

    // Check if the Relying Party (Verifier) can validate the IdToken provided by the OpenId Provider (Holder)
    const idTokenSigningAlgValuesSupported = clientMetadata.idTokenSigningAlgValuesSupported
    const rpSupportedSignatureAlgorithms = getSupportedJwaSignatureAlgorithms(agentContext) as unknown as SigningAlgo[]

    if (idTokenSigningAlgValuesSupported) {
      const possibleIdTokenSigningAlgValues = Array.isArray(idTokenSigningAlgValuesSupported)
        ? idTokenSigningAlgValuesSupported.filter((value) => rpSupportedSignatureAlgorithms.includes(value))
        : [idTokenSigningAlgValuesSupported].filter((value) => rpSupportedSignatureAlgorithms.includes(value))

      if (!possibleIdTokenSigningAlgValues) {
        throw new AriesFrameworkError(
          [
            `The OpenId Provider supports no signature algorithms that are supported by the Relying Party.`,
            `Relying Party supported algorithms are ${rpSupportedSignatureAlgorithms}.`,
            `OpenId Provider supported algorithms are ${idTokenSigningAlgValuesSupported}.`,
          ].join('\n')
        )
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const presentationVerificationCallback: PresentationVerificationCallback = async (x) => {
      // TODO:
      this.logger.info('verifying presentation')
      return Promise.resolve({
        verified: true,
      })
    }

    const builder = RP.builder()
      // .withClientId('client-id') // The client-id is set to the relying party did
      .withRedirectUri(redirect_url)
      .withRequestByValue()
      .withPresentationVerification(presentationVerificationCallback)
      .withIssuer(ResponseIss.SELF_ISSUED_V2) // TODO: this must be set to the issuer with dynamic disc // REQUIRED. URL using the https scheme with no query or fragment component that the Self-Issued OP asserts as its Issuer Identifier. MUST be identical to the iss Claim value in ID Tokens issued from this Self-Issued OP.
      .withSuppliedSignature(signature, did, kid, alg)
      .withRevocationVerification(RevocationVerification.NEVER)
      .withSupportedVersions(SupportedVersion.SIOPv2_D11)
      .withClientMetadata(clientMetadata)
      .withCustomResolver(getResolver(agentContext))
      .withResponseMode(ResponseMode.POST)
      .withResponseType(isVpRequest ? ResponseType.VP_TOKEN : ResponseType.ID_TOKEN)
    // .withCheckLinkedDomain
    // .withEventEmitter
    // .withPresentationDefinition
    // .withPresentationVerification
    // .withSessionManager

    if (clientMetadata.authorizationEndpoint) {
      builder.withAuthorizationEndpoint(clientMetadata.authorizationEndpoint)
    }

    for (const supportedDidMethod of supportedDidMethods) {
      builder.addDidMethod(supportedDidMethod)
    }

    return builder.build()
  }

  private async getSuppliedSignatureFromVerificationMethod(
    agentContext: AgentContext,
    verificationMethod: VerificationMethod
  ) {
    // get the key from the verification method and use the first supported signature algorithm
    const key = getKeyFromVerificationMethod(verificationMethod)
    const alg = getJwkClassFromKeyType(key.keyType)?.supportedSignatureAlgorithms[0]
    if (!alg) throw new AriesFrameworkError(`No supported signature algorithms for key type: ${key.keyType}`)

    const suppliedSignature = {
      signature: async (data: string | Uint8Array) => {
        if (typeof data === 'string') {
          const signedData = await agentContext.wallet.sign({
            data: typeof data === 'string' ? TypedArrayEncoder.fromString(data) : data,
            key,
          })

          const signature = TypedArrayEncoder.toBase64URL(signedData)

          return signature
        }
        throw new AriesFrameworkError('TODO: this should not hjappen')
      },
      // FIXME: cast
      alg: alg as unknown as SigningAlgo,
      did: verificationMethod.controller,
      kid: verificationMethod.id,
    }

    return suppliedSignature
  }

  private async getOpenIdProvider(
    agentContext: AgentContext,
    options: {
      verificationMethod?: VerificationMethod | (() => VerificationMethod)
    }
  ) {
    const { verificationMethod: _verificationMethod } = options

    const builder = OP.builder()
      .withExpiresIn(6000)
      // TODO:
      .withIssuer(ResponseIss.SELF_ISSUED_V2)
      .withResponseMode(ResponseMode.POST)
      .withSupportedVersions([SupportedVersion.SIOPv2_D11])
      .withCheckLinkedDomain(CheckLinkedDomain.NEVER)
      .withCustomResolver(getResolver(agentContext))

    let verificationMethod: VerificationMethod

    if (_verificationMethod) {
      if (typeof _verificationMethod === 'function') {
        verificationMethod = _verificationMethod()
      } else {
        verificationMethod = _verificationMethod
      }

      const { signature, did, kid, alg } = await this.getSuppliedSignatureFromVerificationMethod(
        agentContext,
        verificationMethod
      )

      builder.withSuppliedSignature(signature, did, kid, alg)
    }

    // Add did methods
    const supportedDidMethods = getSupportedDidMethods(agentContext)
    for (const supportedDidMethod of supportedDidMethods) {
      builder.addDidMethod(supportedDidMethod)
    }

    const op = builder.build()

    return op
  }

  public async resolveAuthorizationRequest(
    agentContext: AgentContext,
    requestJwtOrUri: string,
    options?: {
      correlationId: string
    }
  ) {
    const { correlationId } = options ?? {}
    const op = await this.getOpenIdProvider(agentContext, {})

    // parsing happens automatically in verifyAuthorizationRequest
    const verifiedRequest = await op.verifyAuthorizationRequest(requestJwtOrUri, {
      // correlationId,
      //verification: {
      //mode: VerificationMode.EXTERNAL,
      //resolveOpts: { resolver: getResolver(agentContext), noUniversalResolverFallback: false },
      //},
    })

    this.logger.debug(`verified SIOP Authorization Request for issuer '${verifiedRequest.issuer}'`)
    this.logger.debug(`requestJwtOrUri '${requestJwtOrUri}'`)

    const presentationDefs = verifiedRequest.presentationDefinitions
    if (presentationDefs !== undefined && presentationDefs.length > 0) {
      throw new AriesFrameworkError('Not supported yet')
    }

    return verifiedRequest
  }

  public async acceptRequest(
    agentContext: AgentContext,
    verifiedReq: VerifiedAuthorizationRequest,
    verificationMethod: VerificationMethod
  ) {
    const op = await this.getOpenIdProvider(agentContext, { verificationMethod })

    const suppliedSignature = await this.getSuppliedSignatureFromVerificationMethod(agentContext, verificationMethod)

    // TODO: presentations
    const authRespWithJWT = await op.createAuthorizationResponse(verifiedReq, {
      signature: suppliedSignature,
      // https://openid.net/specs/openid-connect-self-issued-v2-1_0.html#name-aud-of-a-request-object
      audience: 'https://acme.com/hello',
    })
    return authRespWithJWT
    //const response = await op.submitAuthorizationResponse(authRespWithJWT)
    //return response
  }

  public async selectCredentialForProofRequest(
    agentContext: AgentContext,
    options: {
      authorizationRequest: string | URI
    }
  ) {
    const op = await this.getOpenIdProvider(agentContext, {})

    const verification = {
      mode: VerificationMode.EXTERNAL,
      resolveOpts: {
        resolver: getResolver(agentContext),
        noUniversalResolverFallback: true,
      },
    } satisfies Verification

    // FIXME: this uses did-jwt for verification of the JWT, we can't verify it ourselves.
    const verifiedAuthorizationRequest = await op.verifyAuthorizationRequest(options.authorizationRequest, {
      verification,
    })

    if (!isVerifiedAuthorizationRequestWithPresentationDefinition(verifiedAuthorizationRequest)) {
      throw new AriesFrameworkError(
        'Only SIOPv2 authorization request including a single presentation definition are supported'
      )
    }

    const selectResults = await this.presentationExchangeService.selectCredentialsForRequest(
      agentContext,
      verifiedAuthorizationRequest.presentationDefinitions[0].definition
    )

    return {
      verifiedAuthorizationRequest,
      selectResults,
    }
  }

  /**
   * Send a SIOPv2 authentication response to the relying party including a verifiable
   * presentation based on OpenID4VP.
   */
  public async shareProof(
    agentContext: AgentContext,
    options: {
      verifiedAuthorizationRequest: VerifiedAuthorizationRequestWithPresentationDefinition
      submission: PresentationSubmission
      submissionEntryIndexes: number[]
    }
  ) {
    const op = await this.getOpenIdProvider(agentContext, {})

    const credentialsForInputDescriptor: CredentialsForInputDescriptor = {}

    options.submission.requirements
      .flatMap((requirement) => requirement.submission)
      .forEach((submission, index) => {
        const verifiableCredential = submission.verifiableCredentials[
          options.submissionEntryIndexes[index] as number
        ] as W3cCredentialRecord

        const inputDescriptor = credentialsForInputDescriptor[submission.inputDescriptorId]
        if (!inputDescriptor) {
          credentialsForInputDescriptor[submission.inputDescriptorId] = [verifiableCredential.credential]
        } else {
          inputDescriptor.push(verifiableCredential.credential)
        }
      })

    const { verifiablePresentations, presentationSubmission } =
      await this.presentationExchangeService.createPresentation(agentContext, {
        credentialsForInputDescriptor,
        presentationDefinition: options.verifiedAuthorizationRequest.presentationDefinitions[0].definition,
        includePresentationSubmissionInVp: false,
        // TODO: are there other properties we need to include?
        nonce: await options.verifiedAuthorizationRequest.authorizationRequest.getMergedProperty<string>('nonce'),
      })

    const verificationMethod = await this.getVerificationMethodFromVerifiablePresentation(
      agentContext,
      verifiablePresentations[0] as W3cVerifiablePresentation
    )

    const response = await op.createAuthorizationResponse(options.verifiedAuthorizationRequest, {
      issuer: verificationMethod.controller,
      presentationExchange: {
        verifiablePresentations: verifiablePresentations.map((vp) => vp.encoded as W3CVerifiablePresentation),
        presentationSubmission,
      },
      signature: await this.getSuppliedSignatureFromVerificationMethod(agentContext, verificationMethod),
    })

    const responseToResponse = await op.submitAuthorizationResponse(response)

    if (!responseToResponse.ok) {
      throw new AriesFrameworkError(`Error submitting authorization response. ${await responseToResponse.text()}`)
    }
  }

  // TODO: we can do this in a simpler way, as we're now resolving it multiple times
  private async getVerificationMethodFromVerifiablePresentation(
    agentContext: AgentContext,
    verifiablePresentation: W3cVerifiablePresentation
  ) {
    const didsApi = agentContext.dependencyManager.resolve(DidsApi)

    let verificationMethodId: string
    if (verifiablePresentation instanceof W3cJsonLdVerifiablePresentation) {
      const [firstProof] = asArray(verifiablePresentation.proof)

      if (!firstProof) {
        throw new AriesFrameworkError('Verifiable presentation does not contain a proof')
      }
      verificationMethodId = firstProof.verificationMethod
    } else {
      // FIXME: cast
      verificationMethodId = verifiablePresentation.jwt.header.kid as string
    }

    const didDocument = await didsApi.resolveDidDocument(verificationMethodId)

    return didDocument.dereferenceKey(verificationMethodId, ['authentication'])
  }
}
