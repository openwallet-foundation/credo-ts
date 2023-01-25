import { AgentConfig, AgentContext, AriesFrameworkError, injectable, JsonEncoder, JsonTransformer, Logger, W3cCredentialRecord, W3cCredentialService, W3cVerifiableCredential } from '@aries-framework/core'
import { Alg, AuthzFlowType, CredentialRequestClientBuilder, Jwt, OpenID4VCIClient, ProofOfPossessionBuilder } from '@sphereon/openid4vci-client'
import { JwsService } from '../../core/src/crypto/JwsService'
import { didKeyToVerkey } from '../../core/src/modules/dids/helpers'


interface PreAuthorizedOptions {
  issuerUri: string,
  kid: string
}

@injectable()
export class OpenId4VcClientService {
  private logger: Logger
  private w3cCredentialService: W3cCredentialService
  private jwsService: JwsService


  public constructor(agentConfig: AgentConfig, w3cCredentialService: W3cCredentialService, jwsService: JwsService) {
    this.w3cCredentialService = w3cCredentialService
    this.jwsService = jwsService
    // @ts-ignore
    this.logger = agentConfig.logger.scoped('openid4vc-client: service')
  }


  private signCallback(agentContext: AgentContext) {
    return async (jwt: Jwt, kid: string) => {

      // TODO should we check if the did exists here, or juist let the wallet throw?

      if (!jwt.header) {
        throw new AriesFrameworkError('No header present on JWT')
      }

      if (!jwt.payload) {
        throw new AriesFrameworkError('No payload present on JWT')
      }



      const did = kid.split('#')[0]

      const verkey = didKeyToVerkey(did)

      const payload = JsonEncoder.toBuffer(jwt.payload)


      const jws = await this.jwsService.createJwsCompact(agentContext, {
        verkey: verkey, // FIXME null check
        header: jwt.header as unknown as Record<string, unknown>,
        payload,
        protectedHeaderOptions: {
          alg: Alg.EdDSA,
          kid
        }
      })

      return jws
    }
  }

  private getSignCallback(agentContext: AgentContext) {
    return {
      signCallback: this.signCallback(agentContext)
    }
  }

  public async preAuthorized(agentContext: AgentContext, options: PreAuthorizedOptions): Promise<W3cCredentialRecord> {
    this.logger.debug('Running pre-authorized flow with options', options)

    const client = await OpenID4VCIClient.initiateFromURI({
      issuanceInitiationURI: options.issuerUri,
      flowType: AuthzFlowType.PRE_AUTHORIZED_CODE_FLOW,
      kid: options.kid,
      alg: Alg.EdDSA,
      clientId: 'test-clientId'
    })



    const accessToken = await client.acquireAccessToken({ clientId: 'test-clientId' })

    this.logger.info('Fetched server accessToken', accessToken)

    if (!accessToken.scope) {
      throw new AriesFrameworkError("Access token response doesn't contain a scope. Only scoped issuer URIs are supported at this time.")
    }


    const serverMetadata = await client.retrieveServerMetadata()

    this.logger.info('Fetched server metadata', {
      issuer: serverMetadata.issuer,
      credentialEndpoint: serverMetadata.credential_endpoint,
      tokenEndpoint: serverMetadata.token_endpoint
    })

    this.logger.debug('Full server metadata', serverMetadata)

    // proof of possesion
    const callbacks = this.getSignCallback(agentContext)

    const proofInput = await ProofOfPossessionBuilder.fromAccessTokenResponse({
      accessTokenResponse: accessToken,
      callbacks: callbacks
    })
      .withEndpointMetadata(serverMetadata)
      .withClientId('test-clientId')
      .withKid(options.kid)
      .build()

    this.logger.debug('Generated JWS', proofInput)

    const credentialRequestClient = CredentialRequestClientBuilder
      .fromIssuanceInitiationURI({ uri: options.issuerUri, metadata: serverMetadata })
      .withTokenFromResponse(accessToken)
      .build()

    const credentialResponse = await credentialRequestClient.acquireCredentialsUsingProof({
      proofInput,
      credentialType: accessToken.scope,
      format: 'ldp_vc' // Allows us to override the format
    })

    this.logger.debug('Credential request response', credentialResponse)

    if (!credentialResponse.successBody) {
      throw new AriesFrameworkError('Did not receive a successful credential response')
    }

    const credential = JsonTransformer.fromJSON(credentialResponse.successBody.credential, W3cVerifiableCredential)

    const storedCredential = await this.w3cCredentialService.storeCredential(agentContext, {
      credential: credential
    })

    this.logger.info(`Stored credential with id: ${storedCredential.id}`)
    this.logger.debug('Full credential', storedCredential)

    return storedCredential
  }
}
