import type {
  OpenId4VciCreateCredentialResponseOptions,
  OpenId4VciCreateCredentialOfferOptions,
} from './OpenId4VcIssuerServiceOptions'
import type { OpenId4VcIssuerRecordProps } from './repository'
import type { OpenId4VciCredentialOfferPayload } from '../shared'

import { injectable, AgentContext } from '@aries-framework/core'

import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from './OpenId4VcIssuerService'

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

  public async getByIssuerId(issuerId: string) {
    return this.openId4VcIssuerService.getByIssuerId(this.agentContext, issuerId)
  }

  /**
   * Creates an issuer and stores the corresponding issuer metadata. Multiple issuers can be created, to allow different sets of
   * credentials to be issued with each issuer.
   */
  public async createIssuer(options: Pick<OpenId4VcIssuerRecordProps, 'credentialsSupported' | 'display'>) {
    return this.openId4VcIssuerService.createIssuer(this.agentContext, options)
  }

  /**
   * Rotate the key used for signing access tokens for the issuer with the given issuerId.
   */
  public async rotateAccessTokenSigningKey(issuerId: string) {
    const issuer = await this.openId4VcIssuerService.getByIssuerId(this.agentContext, issuerId)
    return this.openId4VcIssuerService.rotateAccessTokenSigningKey(this.agentContext, issuer)
  }

  public async getIssuerMetadata(issuerId: string) {
    const issuer = await this.openId4VcIssuerService.getByIssuerId(this.agentContext, issuerId)
    return this.openId4VcIssuerService.getIssuerMetadata(this.agentContext, issuer)
  }

  public async updateIssuerMetadata(
    options: Pick<OpenId4VcIssuerRecordProps, 'issuerId' | 'credentialsSupported' | 'display'>
  ) {
    const issuer = await this.openId4VcIssuerService.getByIssuerId(this.agentContext, options.issuerId)

    issuer.credentialsSupported = options.credentialsSupported
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
    const issuer = await this.openId4VcIssuerService.getByIssuerId(this.agentContext, issuerId)
    return await this.openId4VcIssuerService.createCredentialOffer(this.agentContext, { ...rest, issuer })
  }

  /**
   * This function retrieves the credential offer referenced by the given URI.
   * Retrieving a credential offer from a URI is possible after a credential offer was created with
   * @see createCredentialOffer and the credentialOfferUri option.
   *
   * @throws if no credential offer can found for the given URI.
   * @param uri - The URI referencing the credential offer.
   * @returns The credential offer payload associated with the given URI.
   */
  public async getCredentialOfferFromUri(uri: string): Promise<OpenId4VciCredentialOfferPayload> {
    return await this.openId4VcIssuerService.getCredentialOfferFromUri(this.agentContext, uri)
  }

  /**
   * This function creates a response which can be send to the holder after receiving a credential issuance request.
   *
   * @param options.credentialRequest - The credential request, for which to create a response.
   * @param options.credential - The credential to be issued.
   * @param options.verificationMethod - The verification method used for signing the credential.
   */
  public async createCredentialResponse(options: OpenId4VciCreateCredentialResponseOptions & { issuerId: string }) {
    const { issuerId, ...rest } = options
    const issuer = await this.openId4VcIssuerService.getByIssuerId(this.agentContext, issuerId)
    return await this.openId4VcIssuerService.createCredentialResponse(this.agentContext, { ...rest, issuer })
  }
}
