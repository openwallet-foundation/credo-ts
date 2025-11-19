import { AgentContext, injectable } from '@credo-ts/core'
import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from './OpenId4VcIssuerService'
import type {
  OpenId4VciCreateCredentialOfferOptions,
  OpenId4VciCreateCredentialResponseOptions,
  OpenId4VciCreateDeferredCredentialResponseOptions,
  OpenId4VciCreateIssuerOptions,
  OpenId4VciCreateStatelessCredentialOfferOptions,
  OpenId4VcUpdateIssuerRecordOptions,
} from './OpenId4VcIssuerServiceOptions'

/**
 * @public
 * This class represents the API for interacting with the OpenID4VC Issuer service.
 * It provides methods for creating a credential offer, creating a response to a credential issuance request,
 * and retrieving a credential offer from a URI.
 */
@injectable()
export class OpenId4VcIssuerApi {
  public constructor(
    public readonly config: OpenId4VcIssuerModuleConfig,
    private agentContext: AgentContext,
    private openId4VcIssuerService: OpenId4VcIssuerService
  ) {}

  public async getAllIssuers() {
    return this.openId4VcIssuerService.getAllIssuers(this.agentContext)
  }

  public async getIssuerByIssuerId(issuerId: string) {
    return this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, issuerId)
  }

  /**
   * Creates an issuer and stores the corresponding issuer metadata. Multiple issuers can be created, to allow different sets of
   * credentials to be issued with each issuer.
   */
  public async createIssuer(options: OpenId4VciCreateIssuerOptions) {
    return this.openId4VcIssuerService.createIssuer(this.agentContext, options)
  }

  /**
   * Rotate the key used for signing access tokens for the issuer with the given issuerId.
   */
  public async rotateAccessTokenSigningKey(issuerId: string) {
    const issuer = await this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, issuerId)
    return this.openId4VcIssuerService.rotateAccessTokenSigningKey(this.agentContext, issuer)
  }

  public async updateIssuerMetadata(options: OpenId4VcUpdateIssuerRecordOptions) {
    const {
      issuerId,
      credentialConfigurationsSupported,
      display,
      dpopSigningAlgValuesSupported,
      batchCredentialIssuance,
    } = options

    const issuer = await this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, issuerId)

    issuer.credentialConfigurationsSupported = credentialConfigurationsSupported
    issuer.display = display
    issuer.dpopSigningAlgValuesSupported = dpopSigningAlgValuesSupported
    issuer.batchCredentialIssuance = batchCredentialIssuance

    return this.openId4VcIssuerService.updateIssuer(this.agentContext, issuer)
  }

  /**
   * Creates a stateless credential offer. This can only be used with an external authorization server, as credo only supports stateful
   * credential offers.
   */
  public async createStatelessCredentialOffer(
    options: OpenId4VciCreateStatelessCredentialOfferOptions & { issuerId: string }
  ) {
    const { issuerId, ...rest } = options
    const issuer = await this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, issuerId)
    return await this.openId4VcIssuerService.createStatelessCredentialOffer(this.agentContext, { ...rest, issuer })
  }

  /**
   * Creates a credential offer. Either the preAuthorizedCodeFlowConfig or the authorizationCodeFlowConfig must be provided.
   *
   * @returns Object containing the payload of the credential offer and the credential offer request, which can be sent to the wallet.
   */
  public async createCredentialOffer(options: OpenId4VciCreateCredentialOfferOptions & { issuerId: string }) {
    const { issuerId, ...rest } = options
    const issuer = await this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, issuerId)
    return await this.openId4VcIssuerService.createCredentialOffer(this.agentContext, { ...rest, issuer })
  }

  /**
   * This function creates a response which can be sent to the holder after receiving a credential issuance request.
   */
  public async createCredentialResponse(
    options: OpenId4VciCreateCredentialResponseOptions & { issuanceSessionId: string }
  ) {
    const { issuanceSessionId, ...rest } = options
    const issuanceSession = await this.openId4VcIssuerService.getIssuanceSessionById(
      this.agentContext,
      issuanceSessionId
    )

    return await this.openId4VcIssuerService.createCredentialResponse(this.agentContext, { ...rest, issuanceSession })
  }

  /**
   * This function creates a response which can be sent to the holder after receiving a deferred credential issuance request.
   */
  public async createDeferredCredentialResponse(
    options: OpenId4VciCreateDeferredCredentialResponseOptions & { issuanceSessionId: string }
  ) {
    const { issuanceSessionId, ...rest } = options
    const issuanceSession = await this.openId4VcIssuerService.getIssuanceSessionById(
      this.agentContext,
      issuanceSessionId
    )

    return await this.openId4VcIssuerService.createDeferredCredentialResponse(this.agentContext, {
      ...rest,
      issuanceSession,
    })
  }

  public async getIssuerMetadata(issuerId: string) {
    const issuer = await this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, issuerId)
    return this.openId4VcIssuerService.getIssuerMetadata(this.agentContext, issuer)
  }

  public async getIssuanceSessionById(issuanceSessionId: string) {
    return this.openId4VcIssuerService.getIssuanceSessionById(this.agentContext, issuanceSessionId)
  }
}
