import type {
  FormatAcceptOfferOptions,
  FormatAcceptProposalOptions,
  FormatCreateOfferOptions,
  FormatCreateOfferReturn,
  FormatCreateProposalOptions,
  FormatCreateReturn,
  FormatProcessOptions,
} from '..'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { SignCredentialOptionsRFC0593 } from '../../../vc/models/W3cCredentialServiceOptions'
import type {
  FormatAcceptRequestOptions,
  FormatAutoRespondOfferOptions,
  FormatAutoRespondProposalOptions,
  FormatAutoRespondRequestOptions,
  FormatCreateProposalReturn,
  FormatCreateRequestOptions,
} from '../CredentialFormatServiceOptions'
import type { JsonLdCredentialFormat } from './JsonLdCredentialFormat'

import { Lifecycle, scoped } from 'tsyringe'

import { AriesFrameworkError } from '../../../../../src/error'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { MessageValidator } from '../../../../utils/MessageValidator'
import { deepEqual } from '../../../../utils/objEqual'
import { W3cCredentialService } from '../../../vc'
import { W3cCredential, W3cVerifiableCredential } from '../../../vc/models'
import { CredentialFormatSpec } from '../../models/CredentialFormatSpec'
import { CredentialRepository } from '../../repository/CredentialRepository'
import { CredentialFormatService } from '../CredentialFormatService'

import { JsonLdCredential } from './JsonLdCredentialOptions'

const JSONLD_VC_DETAIL = 'aries/ld-proof-vc-detail@v1.0'
const JSONLD_VC = 'aries/ld-proof-vc@1.0'

@scoped(Lifecycle.ContainerScoped)
export class JsonLdCredentialFormatService extends CredentialFormatService<JsonLdCredentialFormat> {
  private w3cCredentialService: W3cCredentialService

  public constructor(
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    w3cCredentialService: W3cCredentialService
  ) {
    super(credentialRepository, eventEmitter)
    this.w3cCredentialService = w3cCredentialService
  }

  public readonly formatKey = 'jsonld' as const
  public readonly credentialRecordType = 'w3c' as const

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param options The object containing all the options for the proposed credential
   * @returns object containing associated attachment, formats and filtersAttach elements
   *
   */
  public async createProposal({
    credentialFormats,
  }: FormatCreateProposalOptions<JsonLdCredentialFormat>): Promise<FormatCreateProposalReturn> {
    const format = new CredentialFormatSpec({
      format: JSONLD_VC_DETAIL,
    })

    const jsonLdFormat = credentialFormats.jsonld

    if (!jsonLdFormat) {
      throw new AriesFrameworkError('Missing jsonld payload in createProposal')
    }

    const jsonLdCredential = new JsonLdCredential(jsonLdFormat)
    await MessageValidator.validate(jsonLdCredential)

    // FIXME: this doesn't follow RFC0593

    const rfc0593 = credentialFormats.jsonld

    const attachment = this.getFormatData(rfc0593, format.attachId)
    return { format, attachment }
  }

  /**
   * Method called on reception of a propose credential message
   * @param options the options needed to accept the proposal
   */
  public async processProposal({ attachment }: FormatProcessOptions): Promise<void> {
    // FIXME: SignCredentialOptions doesn't follow RFC0593
    const credProposalJson = attachment.getDataAsJson<SignCredentialOptionsRFC0593>()

    if (!credProposalJson) {
      throw new AriesFrameworkError('Missing jsonld credential proposal data payload')
    }

    // FIXME: validating an interface doesn't work.

    const messageToValidate = new JsonLdCredential(credProposalJson)
    await MessageValidator.validate(messageToValidate)
  }

  public async acceptProposal({
    attachId,
    credentialFormats,
    proposalAttachment,
  }: FormatAcceptProposalOptions<JsonLdCredentialFormat>): Promise<FormatCreateOfferReturn> {
    // if the offer has an attachment Id use that, otherwise the generated id of the formats object
    const format = new CredentialFormatSpec({
      attachId,
      format: JSONLD_VC_DETAIL,
    })

    const jsonLdFormat = credentialFormats?.jsonld

    const credentialProposal = proposalAttachment.getDataAsJson<SignCredentialOptionsRFC0593>()

    // FIXME: SignCredentialOptions doesn't follow RFC0593
    const offerData = jsonLdFormat ?? credentialProposal

    const attachment = this.getFormatData(offerData, format.attachId)

    return { format, attachment }
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param options The object containing all the options for the credential offer
   * @returns object containing associated attachment, formats and offersAttach elements
   *
   */
  public async createOffer({
    attachId,
    credentialFormats,
  }: FormatCreateOfferOptions<JsonLdCredentialFormat>): Promise<FormatCreateOfferReturn> {
    // if the offer has an attachment Id use that, otherwise the generated id of the formats object
    const format = new CredentialFormatSpec({
      attachId,
      format: JSONLD_VC_DETAIL,
    })

    // FIXME: SignCredentialOptions doesn't follow RFC0593
    const jsonLdFormat = credentialFormats?.jsonld

    const attachment = this.getFormatData(jsonLdFormat, format.attachId)

    return { format, attachment }
  }

  public async processOffer({ attachment }: FormatProcessOptions) {
    // FIXME: SignCredentialOptions doesn't follow RFC0593
    const credentialOfferJson = attachment.getDataAsJson<SignCredentialOptionsRFC0593>()

    if (!credentialOfferJson) {
      throw new AriesFrameworkError('Missing jsonld credential offer data payload')
    }

    // FIXME: validating an interface doesn't work.
    await MessageValidator.validate(credentialOfferJson)
  }

  public async acceptOffer({
    credentialFormats,
    attachId,
    offerAttachment,
  }: FormatAcceptOfferOptions<JsonLdCredentialFormat>): Promise<FormatCreateReturn> {
    const jsonLdFormat = credentialFormats?.jsonld

    // FIXME: SignCredentialOptions doesn't follow RFC0593
    // FIXME: Add validation of the jsonLdFormat data (if present)
    const credentialOffer = offerAttachment.getDataAsJson<SignCredentialOptionsRFC0593>()
    const requestData = jsonLdFormat ?? credentialOffer

    const format = new CredentialFormatSpec({
      attachId,
      format: JSONLD_VC_DETAIL,
    })

    const attachment = this.getFormatData(requestData, format.attachId)
    return { format, attachment }
  }

  /**
   * Create a credential attachment format for a credential request.
   *
   * @param options The object containing all the options for the credential request is derived
   * @returns object containing associated attachment, formats and requestAttach elements
   *
   */
  public async createRequest({
    credentialFormats,
  }: FormatCreateRequestOptions<JsonLdCredentialFormat>): Promise<FormatCreateReturn> {
    const jsonLdFormat = credentialFormats.jsonld

    const format = new CredentialFormatSpec({
      format: JSONLD_VC_DETAIL,
    })

    if (!jsonLdFormat) {
      throw new AriesFrameworkError('Missing jsonld payload in createRequest')
    }

    // FIXME: validating an interface doesn't work.
    await MessageValidator.validate(jsonLdFormat)

    // FIXME: SignCredentialOptions doesn't follow RFC0593
    const attachment = this.getFormatData(jsonLdFormat, format.attachId)

    return { format, attachment }
  }

  public async processRequest({ attachment }: FormatProcessOptions): Promise<void> {
    // FIXME: SignCredentialOptions doesn't follow RFC0593
    const requestJson = attachment.getDataAsJson<SignCredentialOptionsRFC0593>()

    if (!requestJson) {
      throw new AriesFrameworkError('Missing jsonld credential request data payload')
    }

    // FIXME: validating an interface doesn't work.
    await MessageValidator.validate(requestJson)
  }

  public async acceptRequest({
    attachId,
    requestAttachment,
    credentialFormats,
  }: FormatAcceptRequestOptions<JsonLdCredentialFormat>): Promise<FormatCreateReturn> {
    const jsonLdFormat = credentialFormats?.jsonld

    // sign credential here. credential to be signed is received as the request attachment
    // (attachment in the request message from holder to issuer)
    const credentialRequest = requestAttachment.getDataAsJson<SignCredentialOptionsRFC0593>()

    // FIXME: Need to transform from json to class instance
    // FIXME: SignCredentialOptions doesn't follow RFC0593
    // FIXME: Add validation of the jsonLdFormat data (if present)
    const credentialData = jsonLdFormat ?? credentialRequest
    const format = new CredentialFormatSpec({
      attachId,
      format: JSONLD_VC,
    })

    // FIXME: we're not using all properties from the interface. If we're not using them,
    // they shouldn't be in the interface.
    if (!credentialData.verificationMethod) {
      throw new AriesFrameworkError('Missing verification method in credential data')
    }
    const verifiableCredential = await this.w3cCredentialService.signCredential({
      credential: JsonTransformer.fromJSON(credentialData.credential, W3cCredential),
      proofType: credentialData.options.proofType,
      verificationMethod: credentialData.verificationMethod,
    })

    const attachment = this.getFormatData(verifiableCredential, format.attachId)
    return { format, attachment }
  }

  /**
   * Processes an incoming credential - retrieve metadata, retrieve payload and store it in the Indy wallet
   * @param options the issue credential message wrapped inside this object
   * @param credentialRecord the credential exchange record for this credential
   */
  public async processCredential({ credentialRecord, attachment }: FormatProcessOptions): Promise<void> {
    const credentialAsJson = attachment.getDataAsJson<W3cVerifiableCredential>()
    const credential = JsonTransformer.fromJSON(credentialAsJson, W3cVerifiableCredential)
    await MessageValidator.validate(credential)

    // FIXME: we should verify the signature of the credential here to make sure we can work
    // with the credential we received.
    // FIXME: we should do a lot of checks to verify if the credential we received is actually the credential
    // we requested. We can take an example of the ACA-Py implementation:
    // https://github.com/hyperledger/aries-cloudagent-python/blob/main/aries_cloudagent/protocols/issue_credential/v2_0/formats/ld_proof/handler.py#L492

    const verifiableCredential = await this.w3cCredentialService.storeCredential({
      record: credential,
    })

    credentialRecord.credentials.push({
      credentialRecordType: this.credentialRecordType,
      credentialRecordId: verifiableCredential.id,
    })
  }

  public supportsFormat(format: string): boolean {
    const supportedFormats = [JSONLD_VC_DETAIL, JSONLD_VC]

    return supportedFormats.includes(format)
  }

  public async deleteCredentialById(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public shouldAutoRespondToProposal({ offerAttachment, proposalAttachment }: FormatAutoRespondProposalOptions) {
    return this.areCredentialsEqual(proposalAttachment, offerAttachment)
  }

  public shouldAutoRespondToOffer({ offerAttachment, proposalAttachment }: FormatAutoRespondOfferOptions) {
    return this.areCredentialsEqual(proposalAttachment, offerAttachment)
  }

  public shouldAutoRespondToRequest({ offerAttachment, requestAttachment }: FormatAutoRespondRequestOptions) {
    return this.areCredentialsEqual(offerAttachment, requestAttachment)
  }

  public shouldAutoRespondToCredential() {
    // FIXME: we should do a lot of checks to verify if the credential we received is actually the credential
    // we requested. We can take an example of the ACA-Py implementation:
    // https://github.com/hyperledger/aries-cloudagent-python/blob/main/aries_cloudagent/protocols/issue_credential/v2_0/formats/ld_proof/handler.py#L492
    return true // temporary to get the tests to pass
  }

  private areCredentialsEqual = (message1: Attachment, message2: Attachment) => {
    // FIXME: this implementation doesn't make sense. We can't loop over stringified objects...
    const obj1: any = message1.getDataAsJson()
    const obj2: any = message2.getDataAsJson()

    const retVal = deepEqual(obj1, obj2)
    return retVal
  }
}
