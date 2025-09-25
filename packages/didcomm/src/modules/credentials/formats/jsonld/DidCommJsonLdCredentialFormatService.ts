import type { AgentContext } from '@credo-ts/core'
import type { DidCommCredentialFormatService } from '../DidCommCredentialFormatService'
import type {
  DidCommCredentialFormatAcceptOfferOptions,
  DidCommCredentialFormatAcceptProposalOptions,
  DidCommCredentialFormatAcceptRequestOptions,
  DidCommCredentialFormatAutoRespondCredentialOptions,
  DidCommCredentialFormatAutoRespondOfferOptions,
  DidCommCredentialFormatAutoRespondProposalOptions,
  DidCommCredentialFormatAutoRespondRequestOptions,
  DidCommCredentialFormatCreateOfferOptions,
  DidCommCredentialFormatCreateOfferReturn,
  DidCommCredentialFormatCreateProposalOptions,
  DidCommCredentialFormatCreateProposalReturn,
  DidCommCredentialFormatCreateRequestOptions,
  DidCommCredentialFormatCreateReturn,
  DidCommCredentialFormatProcessCredentialOptions,
  DidCommCredentialFormatProcessOptions,
} from '../DidCommCredentialFormatServiceOptions'
import type {
  DidCommJsonLdCredentialFormat,
  JsonCredential,
  JsonLdFormatDataCredentialDetail,
  JsonLdFormatDataVerifiableCredential,
} from './DidCommJsonLdCredentialFormat'

import {
  ClaimFormat,
  CredoError,
  DidResolverService,
  JsonEncoder,
  JsonTransformer,
  W3cCredential,
  W3cCredentialService,
  W3cJsonLdCredentialService,
  W3cJsonLdVerifiableCredential,
  findVerificationMethodByKeyType,
  utils,
} from '@credo-ts/core'

import { DidCommAttachment, DidCommAttachmentData } from '../../../../decorators/attachment/DidCommAttachment'
import { DidCommCredentialFormatSpec } from '../../models/DidCommCredentialFormatSpec'

import { DidCommJsonLdCredentialDetail } from './DidCommJsonLdCredentialDetail'

const JSONLD_VC_DETAIL = 'aries/ld-proof-vc-detail@v1.0'
const JSONLD_VC = 'aries/ld-proof-vc@v1.0'

export class DidCommJsonLdCredentialFormatService
  implements DidCommCredentialFormatService<DidCommJsonLdCredentialFormat>
{
  public readonly formatKey = 'jsonld' as const
  public readonly credentialRecordType = 'w3c' as const

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param options The object containing all the options for the proposed credential
   * @returns object containing associated attachment, formats and filtersAttach elements
   *
   */
  public async createProposal(
    _agentContext: AgentContext,
    { credentialFormats }: DidCommCredentialFormatCreateProposalOptions<DidCommJsonLdCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateProposalReturn> {
    const format = new DidCommCredentialFormatSpec({
      format: JSONLD_VC_DETAIL,
    })

    const jsonLdFormat = credentialFormats.jsonld
    if (!jsonLdFormat) {
      throw new CredoError('Missing jsonld payload in createProposal')
    }

    // this does the validation
    JsonTransformer.fromJSON(jsonLdFormat.credential, DidCommJsonLdCredentialDetail)

    // jsonLdFormat is now of type JsonLdFormatDataCredentialDetail
    const attachment = this.getFormatData(jsonLdFormat, format.attachmentId)
    return { format, attachment }
  }

  /**
   * Method called on reception of a propose credential message
   * @param options the options needed to accept the proposal
   */
  public async processProposal(
    _agentContext: AgentContext,
    { attachment }: DidCommCredentialFormatProcessOptions
  ): Promise<void> {
    const credProposalJson = attachment.getDataAsJson<JsonLdFormatDataCredentialDetail>()

    if (!credProposalJson) {
      throw new CredoError('Missing jsonld credential proposal data payload')
    }

    // validation is done in here
    JsonTransformer.fromJSON(credProposalJson, DidCommJsonLdCredentialDetail)
  }

  public async acceptProposal(
    _agentContext: AgentContext,
    { attachmentId, proposalAttachment }: DidCommCredentialFormatAcceptProposalOptions<DidCommJsonLdCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateOfferReturn> {
    // if the offer has an attachment Id use that, otherwise the generated id of the formats object
    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: JSONLD_VC_DETAIL,
    })

    const credentialProposal = proposalAttachment.getDataAsJson<JsonLdFormatDataCredentialDetail>()
    JsonTransformer.fromJSON(credentialProposal, DidCommJsonLdCredentialDetail)

    const offerData = credentialProposal

    const attachment = this.getFormatData(offerData, format.attachmentId)

    return { format, attachment }
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param options The object containing all the options for the credential offer
   * @returns object containing associated attachment, formats and offersAttach elements
   *
   */
  public async createOffer(
    _agentContext: AgentContext,
    { credentialFormats, attachmentId }: DidCommCredentialFormatCreateOfferOptions<DidCommJsonLdCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateOfferReturn> {
    // if the offer has an attachment Id use that, otherwise the generated id of the formats object
    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: JSONLD_VC_DETAIL,
    })

    const jsonLdFormat = credentialFormats?.jsonld
    if (!jsonLdFormat) {
      throw new CredoError('Missing jsonld payload in createOffer')
    }

    // validate
    JsonTransformer.fromJSON(jsonLdFormat.credential, DidCommJsonLdCredentialDetail)

    const attachment = this.getFormatData(jsonLdFormat, format.attachmentId)

    return { format, attachment }
  }

  public async processOffer(_agentContext: AgentContext, { attachment }: DidCommCredentialFormatProcessOptions) {
    const credentialOfferJson = attachment.getDataAsJson<JsonLdFormatDataCredentialDetail>()

    if (!credentialOfferJson) {
      throw new CredoError('Missing jsonld credential offer data payload')
    }

    JsonTransformer.fromJSON(credentialOfferJson, DidCommJsonLdCredentialDetail)
  }

  public async acceptOffer(
    _agentContext: AgentContext,
    { attachmentId, offerAttachment }: DidCommCredentialFormatAcceptOfferOptions<DidCommJsonLdCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateReturn> {
    const credentialOffer = offerAttachment.getDataAsJson<JsonLdFormatDataCredentialDetail>()

    // validate
    JsonTransformer.fromJSON(credentialOffer, DidCommJsonLdCredentialDetail)

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: JSONLD_VC_DETAIL,
    })

    const attachment = this.getFormatData(credentialOffer, format.attachmentId)
    return { format, attachment }
  }

  /**
   * Create a credential attachment format for a credential request.
   *
   * @param options The object containing all the options for the credential request is derived
   * @returns object containing associated attachment, formats and requestAttach elements
   *
   */
  public async createRequest(
    _agentContext: AgentContext,
    { credentialFormats }: DidCommCredentialFormatCreateRequestOptions<DidCommJsonLdCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateReturn> {
    const jsonLdFormat = credentialFormats?.jsonld

    const format = new DidCommCredentialFormatSpec({
      format: JSONLD_VC_DETAIL,
    })

    if (!jsonLdFormat) {
      throw new CredoError('Missing jsonld payload in createRequest')
    }

    // this does the validation
    JsonTransformer.fromJSON(jsonLdFormat.credential, DidCommJsonLdCredentialDetail)

    const attachment = this.getFormatData(jsonLdFormat, format.attachmentId)

    return { format, attachment }
  }

  public async processRequest(
    _agentContext: AgentContext,
    { attachment }: DidCommCredentialFormatProcessOptions
  ): Promise<void> {
    const requestJson = attachment.getDataAsJson<JsonLdFormatDataCredentialDetail>()

    if (!requestJson) {
      throw new CredoError('Missing jsonld credential request data payload')
    }

    // validate
    JsonTransformer.fromJSON(requestJson, DidCommJsonLdCredentialDetail)
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      credentialFormats,
      attachmentId,
      requestAttachment,
    }: DidCommCredentialFormatAcceptRequestOptions<DidCommJsonLdCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateReturn> {
    const w3cJsonLdCredentialService = agentContext.dependencyManager.resolve(W3cJsonLdCredentialService)

    // sign credential here. credential to be signed is received as the request attachment
    // (attachment in the request message from holder to issuer)
    const credentialRequest = requestAttachment.getDataAsJson<JsonLdFormatDataCredentialDetail>()

    const verificationMethod =
      credentialFormats?.jsonld?.verificationMethod ??
      (await this.deriveVerificationMethod(agentContext, credentialRequest.credential, credentialRequest))

    if (!verificationMethod) {
      throw new CredoError('Missing verification method in credential data')
    }
    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: JSONLD_VC,
    })

    const options = credentialRequest.options

    // Get a list of fields found in the options that are not supported at the moment
    const unsupportedFields = ['challenge', 'domain', 'credentialStatus', 'created'] as const
    const foundFields = unsupportedFields.filter((field) => options[field] !== undefined)

    if (foundFields.length > 0) {
      throw new CredoError(`Some fields are not currently supported in credential options: ${foundFields.join(', ')}`)
    }

    const credential = JsonTransformer.fromJSON(credentialRequest.credential, W3cCredential)

    const verifiableCredential = await w3cJsonLdCredentialService.signCredential(agentContext, {
      format: ClaimFormat.LdpVc,
      credential,
      proofType: credentialRequest.options.proofType,
      verificationMethod: verificationMethod,
    })

    const attachment = this.getFormatData(JsonTransformer.toJSON(verifiableCredential), format.attachmentId)
    return { format, attachment }
  }

  /**
   * Derive a verification method using the issuer from the given verifiable credential
   * @param credentialAsJson the verifiable credential we want to sign
   * @return the verification method derived from this credential and its associated issuer did, keys etc.
   */
  private async deriveVerificationMethod(
    agentContext: AgentContext,
    credentialAsJson: JsonCredential,
    credentialRequest: JsonLdFormatDataCredentialDetail
  ): Promise<string> {
    const didResolver = agentContext.dependencyManager.resolve(DidResolverService)
    const w3cJsonLdCredentialService = agentContext.dependencyManager.resolve(W3cJsonLdCredentialService)

    const credential = JsonTransformer.fromJSON(credentialAsJson, W3cCredential)

    // extract issuer from vc (can be string or Issuer)
    let issuerDid = credential.issuer

    if (typeof issuerDid !== 'string') {
      issuerDid = issuerDid.id
    }
    // this will throw an error if the issuer did is invalid
    const issuerDidDocument = await didResolver.resolveDidDocument(agentContext, issuerDid)

    // find first key which matches proof type
    const proofType = credentialRequest.options.proofType

    // actually gets the key type(s)
    const keyType = w3cJsonLdCredentialService.getVerificationMethodTypesByProofType(proofType)

    if (!keyType || keyType.length === 0) {
      throw new CredoError(`No Key Type found for proofType ${proofType}`)
    }

    const verificationMethod = await findVerificationMethodByKeyType(keyType[0], issuerDidDocument)
    if (!verificationMethod) {
      throw new CredoError(`Missing verification method for key type ${keyType}`)
    }

    return verificationMethod.id
  }
  /**
   * Processes an incoming credential - retrieve metadata, retrieve payload and store it in the Indy wallet
   * @param options the issue credential message wrapped inside this object
   * @param credentialExchangeRecord the credential exchange record for this credential
   */
  public async processCredential(
    agentContext: AgentContext,
    { credentialExchangeRecord, attachment, requestAttachment }: DidCommCredentialFormatProcessCredentialOptions
  ): Promise<void> {
    const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)

    const credentialAsJson = attachment.getDataAsJson()
    const credential = JsonTransformer.fromJSON(credentialAsJson, W3cJsonLdVerifiableCredential)
    const requestAsJson = requestAttachment.getDataAsJson<JsonLdFormatDataCredentialDetail>()

    // Verify the credential request matches the credential
    this.verifyReceivedCredentialMatchesRequest(credential, requestAsJson)

    // verify signatures of the credential
    const result = await w3cCredentialService.verifyCredential(agentContext, { credential })
    if (result && !result.isValid) {
      throw new CredoError(`Failed to validate credential, error = ${result.error}`)
    }

    const verifiableCredential = await w3cCredentialService.storeCredential(agentContext, {
      credential,
    })

    credentialExchangeRecord.credentials.push({
      credentialRecordType: this.credentialRecordType,
      credentialRecordId: verifiableCredential.id,
    })
  }

  private verifyReceivedCredentialMatchesRequest(
    credential: W3cJsonLdVerifiableCredential,
    request: JsonLdFormatDataCredentialDetail
  ): void {
    const jsonCredential = JsonTransformer.toJSON(credential)
    jsonCredential.proof = undefined

    if (Array.isArray(credential.proof)) {
      throw new CredoError('Credential proof arrays are not supported')
    }

    if (request.options.created && credential.proof.created !== request.options.created) {
      throw new CredoError('Received credential proof created does not match created from credential request')
    }

    if (credential.proof.domain !== request.options.domain) {
      throw new CredoError('Received credential proof domain does not match domain from credential request')
    }

    if (credential.proof.challenge !== request.options.challenge) {
      throw new CredoError('Received credential proof challenge does not match challenge from credential request')
    }

    if (credential.proof.type !== request.options.proofType) {
      throw new CredoError('Received credential proof type does not match proof type from credential request')
    }

    if (credential.proof.proofPurpose !== request.options.proofPurpose) {
      throw new CredoError('Received credential proof purpose does not match proof purpose from credential request')
    }

    // Check whether the received credential (minus the proof) matches the credential request
    if (!utils.areObjectsEqual(jsonCredential, request.credential)) {
      throw new CredoError('Received credential does not match credential request')
    }

    // TODO: add check for the credentialStatus once this is supported in Credo
  }

  public supportsFormat(format: string): boolean {
    const supportedFormats = [JSONLD_VC_DETAIL, JSONLD_VC]

    return supportedFormats.includes(format)
  }

  public async deleteCredentialById(): Promise<void> {
    throw new Error('Not implemented.')
  }

  public areCredentialsEqual = (message1: DidCommAttachment, message2: DidCommAttachment): boolean => {
    const obj1 = message1.getDataAsJson()
    const obj2 = message2.getDataAsJson()

    return utils.areObjectsEqual(obj1, obj2)
  }

  public async shouldAutoRespondToProposal(
    _agentContext: AgentContext,
    { offerAttachment, proposalAttachment }: DidCommCredentialFormatAutoRespondProposalOptions
  ) {
    return this.areCredentialsEqual(proposalAttachment, offerAttachment)
  }

  public async shouldAutoRespondToOffer(
    _agentContext: AgentContext,
    { offerAttachment, proposalAttachment }: DidCommCredentialFormatAutoRespondOfferOptions
  ) {
    return this.areCredentialsEqual(proposalAttachment, offerAttachment)
  }

  public async shouldAutoRespondToRequest(
    _agentContext: AgentContext,
    { offerAttachment, requestAttachment }: DidCommCredentialFormatAutoRespondRequestOptions
  ) {
    return this.areCredentialsEqual(offerAttachment, requestAttachment)
  }

  public async shouldAutoRespondToCredential(
    _agentContext: AgentContext,
    { requestAttachment, credentialAttachment }: DidCommCredentialFormatAutoRespondCredentialOptions
  ) {
    const credentialJson = credentialAttachment.getDataAsJson<JsonLdFormatDataVerifiableCredential>()
    const w3cCredential = JsonTransformer.fromJSON(credentialJson, W3cJsonLdVerifiableCredential)
    const request = requestAttachment.getDataAsJson<JsonLdFormatDataCredentialDetail>()

    try {
      // This check is also done in the processCredential method, but we do it here as well
      // to be certain we don't skip the check
      this.verifyReceivedCredentialMatchesRequest(w3cCredential, request)

      return true
    } catch (_error) {
      return false
    }
  }

  /**
   * Returns an object of type {@link DidCommAttachment} for use in credential exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object
   * @param id the attach id from the formats component of the message
   */
  private getFormatData(data: unknown, id: string): DidCommAttachment {
    const attachment = new DidCommAttachment({
      id,
      mimeType: 'application/json',
      data: new DidCommAttachmentData({
        base64: JsonEncoder.toBase64(data),
      }),
    })

    return attachment
  }
}
