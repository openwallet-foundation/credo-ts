import type { AgentContext } from '../../../../agent'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { LinkedDataProof } from '../../../vc/models/LinkedDataProof'
import type {
  FormatAcceptOfferOptions,
  FormatAcceptProposalOptions,
  FormatAcceptRequestOptions,
  FormatAutoRespondCredentialOptions,
  FormatAutoRespondOfferOptions,
  FormatAutoRespondProposalOptions,
  FormatAutoRespondRequestOptions,
  FormatCreateOfferOptions,
  FormatCreateOfferReturn,
  FormatCreateProposalOptions,
  FormatCreateProposalReturn,
  FormatCreateRequestOptions,
  CredentialFormatCreateReturn,
  FormatProcessCredentialOptions,
  FormatProcessOptions,
} from '../CredentialFormatServiceOptions'
import type { JsonLdCredentialFormat, SignCredentialOptionsRFC0593 } from './JsonLdCredentialFormat'
import type { JsonLdOptionsRFC0593 } from './JsonLdOptionsRFC0593'

import { injectable } from 'tsyringe'

import { AriesFrameworkError } from '../../../../error'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { MessageValidator } from '../../../../utils/MessageValidator'
import { deepEqual } from '../../../../utils/objEqual'
import { findVerificationMethodByKeyType } from '../../../dids/domain/DidDocument'
import { DidResolverService } from '../../../dids/services/DidResolverService'
import { W3cCredentialService } from '../../../vc'
import { W3cCredential, W3cVerifiableCredential } from '../../../vc/models'
import { CredentialFormatSpec } from '../../models/CredentialFormatSpec'
import { CredentialFormatService } from '../CredentialFormatService'

import { JsonLdCredentialDetail } from './JsonLdCredentialOptions'

const JSONLD_VC_DETAIL = 'aries/ld-proof-vc-detail@v1.0'
const JSONLD_VC = 'aries/ld-proof-vc@1.0'

@injectable()
export class JsonLdCredentialFormatService extends CredentialFormatService<JsonLdCredentialFormat> {
  private w3cCredentialService: W3cCredentialService
  private didResolver: DidResolverService

  public constructor(w3cCredentialService: W3cCredentialService, didResolver: DidResolverService) {
    super()
    this.w3cCredentialService = w3cCredentialService
    this.didResolver = didResolver
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
  public async createProposal(
    agentContext: AgentContext,
    { credentialFormats }: FormatCreateProposalOptions<JsonLdCredentialFormat>
  ): Promise<FormatCreateProposalReturn> {
    const format = new CredentialFormatSpec({
      format: JSONLD_VC_DETAIL,
    })

    const jsonLdFormat = credentialFormats.jsonld
    if (!jsonLdFormat) {
      throw new AriesFrameworkError('Missing jsonld payload in createProposal')
    }

    const jsonLdCredential = new JsonLdCredentialDetail(jsonLdFormat)
    MessageValidator.validateSync(jsonLdCredential)

    // jsonLdFormat is now of type SignCredentialOptionsRFC0593
    const attachment = this.getFormatData(jsonLdFormat, format.attachId)
    return { format, attachment }
  }

  /**
   * Method called on reception of a propose credential message
   * @param options the options needed to accept the proposal
   */
  public async processProposal(agentContext: AgentContext, { attachment }: FormatProcessOptions): Promise<void> {
    const credProposalJson = attachment.getDataAsJson<SignCredentialOptionsRFC0593>()

    if (!credProposalJson) {
      throw new AriesFrameworkError('Missing jsonld credential proposal data payload')
    }

    const messageToValidate = new JsonLdCredentialDetail(credProposalJson)
    MessageValidator.validateSync(messageToValidate)
  }

  public async acceptProposal(
    agentContext: AgentContext,
    { attachId, credentialFormats, proposalAttachment }: FormatAcceptProposalOptions<JsonLdCredentialFormat>
  ): Promise<FormatCreateOfferReturn> {
    // if the offer has an attachment Id use that, otherwise the generated id of the formats object
    const format = new CredentialFormatSpec({
      attachId,
      format: JSONLD_VC_DETAIL,
    })

    const jsonLdFormat = credentialFormats?.jsonld
    if (jsonLdFormat) {
      // if there is an offer, validate
      const jsonLdCredentialOffer = new JsonLdCredentialDetail(jsonLdFormat)
      MessageValidator.validateSync(jsonLdCredentialOffer)
    }

    const credentialProposal = proposalAttachment.getDataAsJson<SignCredentialOptionsRFC0593>()
    const jsonLdCredentialProposal = new JsonLdCredentialDetail(credentialProposal)
    MessageValidator.validateSync(jsonLdCredentialProposal)

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
  public async createOffer(
    agentContext: AgentContext,
    { credentialFormats, attachId }: FormatCreateOfferOptions<JsonLdCredentialFormat>
  ): Promise<FormatCreateOfferReturn> {
    // if the offer has an attachment Id use that, otherwise the generated id of the formats object
    const format = new CredentialFormatSpec({
      attachId,
      format: JSONLD_VC_DETAIL,
    })

    const jsonLdFormat = credentialFormats?.jsonld
    if (!jsonLdFormat) {
      throw new AriesFrameworkError('Missing jsonld payload in createOffer')
    }

    const jsonLdCredential = new JsonLdCredentialDetail(jsonLdFormat)

    MessageValidator.validateSync(jsonLdCredential)
    const attachment = this.getFormatData(jsonLdFormat, format.attachId)

    return { format, attachment }
  }

  public async processOffer(agentContext: AgentContext, { attachment }: FormatProcessOptions) {
    const credentialOfferJson = attachment.getDataAsJson<SignCredentialOptionsRFC0593>()

    if (!credentialOfferJson) {
      throw new AriesFrameworkError('Missing jsonld credential offer data payload')
    }

    const jsonLdCredential = new JsonLdCredentialDetail(credentialOfferJson)
    MessageValidator.validateSync(jsonLdCredential)
  }

  public async acceptOffer(
    agentContext: AgentContext,
    { credentialFormats, attachId, offerAttachment }: FormatAcceptOfferOptions<JsonLdCredentialFormat>
  ): Promise<CredentialFormatCreateReturn> {
    const jsonLdFormat = credentialFormats?.jsonld

    const credentialOffer = offerAttachment.getDataAsJson<SignCredentialOptionsRFC0593>()
    const requestData = jsonLdFormat ?? credentialOffer

    const jsonLdCredential = new JsonLdCredentialDetail(requestData)
    MessageValidator.validateSync(jsonLdCredential)

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
  public async createRequest(
    agentContext: AgentContext,
    { credentialFormats }: FormatCreateRequestOptions<JsonLdCredentialFormat>
  ): Promise<CredentialFormatCreateReturn> {
    const jsonLdFormat = credentialFormats?.jsonld

    const format = new CredentialFormatSpec({
      format: JSONLD_VC_DETAIL,
    })

    if (!jsonLdFormat) {
      throw new AriesFrameworkError('Missing jsonld payload in createRequest')
    }

    const jsonLdCredential = new JsonLdCredentialDetail(jsonLdFormat)
    MessageValidator.validateSync(jsonLdCredential)

    const attachment = this.getFormatData(jsonLdFormat, format.attachId)

    return { format, attachment }
  }

  public async processRequest(agentContext: AgentContext, { attachment }: FormatProcessOptions): Promise<void> {
    const requestJson = attachment.getDataAsJson<SignCredentialOptionsRFC0593>()

    if (!requestJson) {
      throw new AriesFrameworkError('Missing jsonld credential request data payload')
    }

    const jsonLdCredential = new JsonLdCredentialDetail(requestJson)
    MessageValidator.validateSync(jsonLdCredential)
  }

  public async acceptRequest(
    agentContext: AgentContext,
    { credentialFormats, attachId, requestAttachment }: FormatAcceptRequestOptions<JsonLdCredentialFormat>
  ): Promise<CredentialFormatCreateReturn> {
    const jsonLdFormat = credentialFormats?.jsonld

    // sign credential here. credential to be signed is received as the request attachment
    // (attachment in the request message from holder to issuer)
    const credentialRequest = requestAttachment.getDataAsJson<SignCredentialOptionsRFC0593>()

    const credentialData = jsonLdFormat ?? credentialRequest
    const jsonLdCredential = new JsonLdCredentialDetail(credentialData)
    MessageValidator.validateSync(jsonLdCredential)

    const verificationMethod =
      credentialFormats?.jsonld?.verificationMethod ??
      (await this.deriveVerificationMethod(agentContext, credentialData.credential, credentialRequest))

    if (!verificationMethod) {
      throw new AriesFrameworkError('Missing verification method in credential data')
    }
    const format = new CredentialFormatSpec({
      attachId,
      format: JSONLD_VC,
    })

    const options = credentialData.options

    if (options.challenge || options.domain || options.credentialStatus) {
      throw new AriesFrameworkError(
        'The fields challenge, domain and credentialStatus not currently supported in credential options '
      )
    }

    const verifiableCredential = await this.w3cCredentialService.signCredential(agentContext, {
      credential: JsonTransformer.fromJSON(credentialData.credential, W3cCredential),
      proofType: credentialData.options.proofType,
      verificationMethod: verificationMethod,
    })

    const attachment = this.getFormatData(verifiableCredential, format.attachId)
    return { format, attachment }
  }

  /**
   * Derive a verification method using the issuer from the given verifiable credential
   * @param credential the verifiable credential we want to sign
   * @return the verification method derived from this credential and its associated issuer did, keys etc.
   */
  private async deriveVerificationMethod(
    agentContext: AgentContext,
    credential: W3cCredential,
    credentialRequest: SignCredentialOptionsRFC0593
  ): Promise<string> {
    // extract issuer from vc (can be string or Issuer)
    let issuerDid = credential.issuer

    if (typeof issuerDid !== 'string') {
      issuerDid = issuerDid.id
    }
    // this will throw an error if the issuer did is invalid
    const issuerDidDocument = await this.didResolver.resolveDidDocument(agentContext, issuerDid)

    // find first key which matches proof type
    const proofType = credentialRequest.options.proofType

    // actually gets the key type(s)
    const keyType = this.w3cCredentialService.getVerificationMethodTypesByProofType(proofType)

    if (!keyType || keyType.length === 0) {
      throw new AriesFrameworkError(`No Key Type found for proofType ${proofType}`)
    }

    const verificationMethod = await findVerificationMethodByKeyType(keyType[0], issuerDidDocument)
    if (!verificationMethod) {
      throw new AriesFrameworkError(`Missing verification method for key type ${keyType}`)
    }

    return verificationMethod.id
  }
  /**
   * Processes an incoming credential - retrieve metadata, retrieve payload and store it in the Indy wallet
   * @param options the issue credential message wrapped inside this object
   * @param credentialRecord the credential exchange record for this credential
   */
  public async processCredential(
    agentContext: AgentContext,
    { credentialRecord, attachment, requestAttachment }: FormatProcessCredentialOptions
  ): Promise<void> {
    const credentialAsJson = attachment.getDataAsJson<W3cVerifiableCredential>()
    const credential = JsonTransformer.fromJSON(credentialAsJson, W3cVerifiableCredential)
    MessageValidator.validateSync(credential)

    // compare stuff in the proof object of the credential and request...based on aca-py

    const requestAsJson = requestAttachment.getDataAsJson<SignCredentialOptionsRFC0593>()
    const request = JsonTransformer.fromJSON(requestAsJson, JsonLdCredentialDetail)

    if (Array.isArray(credential.proof)) {
      // question: what do we compare here, each element of the proof array with the request???
      throw new AriesFrameworkError('Credential arrays are not supported')
    } else {
      // do checks here
      this.compareCredentialSubject(credential, request.credential)
      this.compareProofs(credential.proof, request.options)
    }

    const verifiableCredential = await this.w3cCredentialService.storeCredential(agentContext, {
      credential: credential,
    })

    credentialRecord.credentials.push({
      credentialRecordType: this.credentialRecordType,
      credentialRecordId: verifiableCredential.id,
    })
  }

  private compareCredentialSubject(credential: W3cVerifiableCredential, request: W3cCredential): void {
    if (!deepEqual(credential.credentialSubject, request.credentialSubject)) {
      throw new AriesFrameworkError('Received credential subject does not match subject from credential request')
    }
  }

  private compareProofs(credentialProof: LinkedDataProof, requestProof: JsonLdOptionsRFC0593): void {
    if (credentialProof.domain !== requestProof.domain) {
      throw new AriesFrameworkError('Received credential proof domain does not match domain from credential request')
    }

    if (credentialProof.challenge !== requestProof.challenge) {
      throw new AriesFrameworkError(
        'Received credential proof challenge does not match challenge from credential request'
      )
    }

    if (credentialProof.type !== requestProof.proofType) {
      throw new AriesFrameworkError('Received credential proof type does not match proof type from credential request')
    }

    if (credentialProof.proofPurpose !== requestProof.proofPurpose) {
      throw new AriesFrameworkError(
        'Received credential proof purpose does not match proof purpose from credential request'
      )
    }
  }

  public supportsFormat(format: string): boolean {
    const supportedFormats = [JSONLD_VC_DETAIL, JSONLD_VC]

    return supportedFormats.includes(format)
  }

  public async deleteCredentialById(): Promise<void> {
    throw new Error('Not implemented.')
  }

  public areCredentialsEqual = (message1: Attachment, message2: Attachment): boolean => {
    // FIXME: this implementation doesn't make sense. We can't loop over stringified objects...
    const obj1 = message1.getDataAsJson()
    const obj2 = message2.getDataAsJson()

    return deepEqual(obj1, obj2)
  }

  public shouldAutoRespondToProposal(
    agentContext: AgentContext,
    { offerAttachment, proposalAttachment }: FormatAutoRespondProposalOptions
  ) {
    return this.areCredentialsEqual(proposalAttachment, offerAttachment)
  }

  public shouldAutoRespondToOffer(
    agentContext: AgentContext,
    { offerAttachment, proposalAttachment }: FormatAutoRespondOfferOptions
  ) {
    return this.areCredentialsEqual(proposalAttachment, offerAttachment)
  }

  public shouldAutoRespondToRequest(
    agentContext: AgentContext,
    { offerAttachment, requestAttachment }: FormatAutoRespondRequestOptions
  ) {
    return this.areCredentialsEqual(offerAttachment, requestAttachment)
  }

  public shouldAutoRespondToCredential(
    agentContext: AgentContext,
    { credentialAttachment, requestAttachment }: FormatAutoRespondCredentialOptions
  ) {
    const credentialAsJson = credentialAttachment.getDataAsJson<W3cVerifiableCredential>()
    const credential = JsonTransformer.fromJSON(credentialAsJson, W3cVerifiableCredential)

    if (Array.isArray(credential.proof)) {
      throw new AriesFrameworkError('Credential arrays are not supported')
    } else {
      // do checks here
      try {
        const requestAsJson = requestAttachment.getDataAsJson<SignCredentialOptionsRFC0593>()
        const request = JsonTransformer.fromJSON(requestAsJson, JsonLdCredentialDetail)
        this.compareCredentialSubject(credential, request.credential)
        this.compareProofs(credential.proof, request.options)
        return true
      } catch (error) {
        return false
      }
    }
  }
}
