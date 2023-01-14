import { AgentConfig, AgentContext, DidRepository, injectable, JsonEncoder, Logger, W3cCredentialService } from '@aries-framework/core'
import { Alg, AuthzFlowType, CredentialRequestClientBuilder, Jwt, OpenID4VCIClient, ProofOfPossessionBuilder } from '@sphereon/openid4vci-client'
import { log } from 'console'
import { JwsService } from '../../core/src/crypto/JwsService'
import { didKeyToVerkey } from '../../core/src/modules/dids/helpers'


interface PreAuthorizedOptions {
  issuerUri: string,
  did: string
}

@injectable()
export class OpenId4VcClientService {
  private logger: Logger
  private w3cCredentialService: W3cCredentialService
  private jwsService: JwsService
  private didRepository: DidRepository


  public constructor(agentConfig: AgentConfig, w3cCredentialService: W3cCredentialService, jwsService: JwsService, didRepository: DidRepository) {
    this.w3cCredentialService = w3cCredentialService
    this.jwsService = jwsService
    this.didRepository = didRepository
    // @ts-ignore
    this.logger = agentConfig.logger.scoped('openid4vc-client: service')
  }


  private signCallback(agentContext: AgentContext) {
    return async (jwt: Jwt, kid: string) => {

      if (!jwt.header) {
        throw Error('No header present on JWT')
      }

      if (!jwt.payload) {
        throw Error('No header present on JWT')
      }

      const didRecord = await this.didRepository.findCreatedDid(agentContext, kid)


      const verkey = didKeyToVerkey(didRecord!.did)
      const payload = JsonEncoder.toBuffer(jwt.payload)


      const jws = await this.jwsService.createJwsCompact(agentContext, {
        verkey: verkey, // FIXME null check
        header: jwt.header as unknown as Record<string, unknown>,
        payload
      })

      return jws
    }
  }

  private getSignCallback(agentContext: AgentContext) {
    // console.log('Running Service: Get Sign Callback')
    return {
      signCallback: this.signCallback(agentContext)
    }
  }

  public async preAuthorized(agentContext: AgentContext, options: PreAuthorizedOptions) {
    this.logger.debug('Running pre-authorized flow with options', options)

    const client = await OpenID4VCIClient.initiateFromURI({
      issuanceInitiationURI: options.issuerUri,
      flowType: AuthzFlowType.PRE_AUTHORIZED_CODE_FLOW,
      kid: options.did,
      alg: Alg.ES256,
      clientId: 'test-clientId'
    })

    const accessToken = {
      access_token: 'N4vZQGi1TiFztlkxvp5yE3zC8aqF7eZwLCDdaPQpNdh',
      expires_in: 3600,
      scope: 'OpenBadgeCredential',
      token_type: 'Bearer'
    }

    this.logger.info('Fetched server accessToken', accessToken)

    const serverMetadata = await client.retrieveServerMetadata()
    this.logger.info('Fetched server metadata', {
      issuer: serverMetadata.issuer,
      credentialEndpoint: serverMetadata.credential_endpoint,
      tokenEndpoint: serverMetadata.token_endpoint
    })

    // proof of possesion
    const callbacks = this.getSignCallback(agentContext)

    const proofInput = await ProofOfPossessionBuilder.fromAccessTokenResponse({
      accessTokenResponse: accessToken,
      callbacks: callbacks
    })
      .withEndpointMetadata(serverMetadata)
      .withClientId('test-clientId')
      .withKid(options.did)
      .build()

    this.logger.debug('Generated JTS', proofInput)


    // const credentialRequestClient = CredentialRequestClientBuilder.fromIssuanceInitiationURI({ uri: options.issuerUri, metadata: serverMetadata }).build()

    // const credentialResponse = await credentialRequestClient.acquireCredentialsUsingProof({
    //   proofInput,
    //   credentialType: 'OpenBadgeCredential', // Needs to match a type from the Initiate Issance Request!
    //   format: 'jwt_vc_json' // Allows us to override the format
    // })


  }
}
