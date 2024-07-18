import type {
  OpenId4VciCreateCredentialResponseOptions,
  OpenId4VciCreateCredentialOfferOptions,
  OpenId4VciCreateIssuerOptions,
} from './OpenId4VcIssuerServiceOptions'
import type { OpenId4VcIssuerRecordProps } from './repository'

import { injectable, AgentContext } from '@credo-ts/core'

import { credentialsSupportedV13ToV11, type OpenId4VciCredentialRequest } from '../shared'

import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from './OpenId4VcIssuerService'
import {
  OpenId4VcIssuerRecordCredentialSupportedProps,
  OpenId4VcIssuerRecordCredentialConfigurationsSupportedProps,
} from './repository'

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

  /**
   * @deprecated use {@link getIssuerByIssuerId} instead.
   * @todo remove in 0.6
   */
  public async getByIssuerId(issuerId: string) {
    return this.getIssuerByIssuerId(issuerId)
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

  public async updateIssuerMetadata(
    options: Pick<OpenId4VcIssuerRecordProps, 'issuerId' | 'display'> &
      (OpenId4VcIssuerRecordCredentialSupportedProps | OpenId4VcIssuerRecordCredentialConfigurationsSupportedProps)
  ) {
    const issuer = await this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, options.issuerId)

    if (options.credentialConfigurationsSupported) {
      issuer.credentialConfigurationsSupported = options.credentialConfigurationsSupported
      issuer.credentialsSupported = credentialsSupportedV13ToV11(options.credentialConfigurationsSupported)
    } else {
      issuer.credentialsSupported = options.credentialsSupported
      issuer.credentialConfigurationsSupported = undefined
    }
    issuer.display = options.display

    return this.openId4VcIssuerService.updateIssuer(this.agentContext, issuer)
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
   * This function creates a response which can be send to the holder after receiving a credential issuance request.
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

  public async findIssuanceSessionForCredentialRequest(options: {
    credentialRequest: OpenId4VciCredentialRequest
    issuerId?: string
  }) {
    const issuanceSession = await this.openId4VcIssuerService.findIssuanceSessionForCredentialRequest(
      this.agentContext,
      options
    )

    return issuanceSession
  }

  public async getIssuerMetadata(issuerId: string) {
    const issuer = await this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, issuerId)
    return this.openId4VcIssuerService.getIssuerMetadata(this.agentContext, issuer)
  }
}
