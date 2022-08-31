import type {
  FormatAcceptOfferOptions,
  FormatAcceptProposalOptions,
  FormatCreateOfferOptions,
  FormatCreateOfferReturn,
  FormatCreateProposalOptions,
  FormatCreateReturn,
  FormatProcessOptions,
} from '..'
import type { AgentContext } from '../../../../agent'
import type { LinkedDataProof } from '../../../vc/models/LinkedDataProof'
import type { SignCredentialOptionsRFC0593 } from '../../../vc/models/W3cCredentialServiceOptions'
import type {
  FormatAcceptRequestOptions,
  FormatAutoRespondCredentialOptions,
  FormatAutoRespondOfferOptions,
  FormatAutoRespondProposalOptions,
  FormatAutoRespondRequestOptions,
  FormatCreateProposalReturn,
  FormatCreateRequestOptions,
  FormatProcessCredentialOptions,
} from '../CredentialFormatServiceOptions'
import type { JsonLdCredentialFormat } from './JsonLdCredentialFormat'
import type { JsonLdOptionsRFC0593 } from './JsonLdOptionsRFC0593'

import { injectable } from 'tsyringe'

import { AriesFrameworkError } from '../../../../error'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { MessageValidator } from '../../../../utils/MessageValidator'
import { findVerificationMethodByKeyType } from '../../../dids/domain/DidDocument'
import { proofTypeKeyTypeMapping } from '../../../dids/domain/key-type/keyDidMapping'
import { DidResolverService } from '../../../dids/services/DidResolverService'
import { W3cCredentialService } from '../../../vc'
import { W3cCredential, W3cVerifiableCredential } from '../../../vc/models'
import { CredentialFormatSpec } from '../../models/CredentialFormatSpec'
import { CredentialFormatService } from '../CredentialFormatService'

import { JsonLdCredential } from './JsonLdCredentialOptions'

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

    const jsonLdCredential = new JsonLdCredential(jsonLdFormat)
    MessageValidator.validateSync(jsonLdCredential)

    // FIXME: this doesn't follow RFC0593
    // jsonLdFormat is now of type SignCredentialOptionsRFC0593

    const attachment = this.getFormatData(jsonLdFormat, format.attachId)
    return { format, attachment }
  }

  /**
   * Method called on reception of a propose credential message
   * @param options the options needed to accept the proposal
   */
  public async processProposal(agentContext: AgentContext, { attachment }: FormatProcessOptions): Promise<void> {
    // FIXME: SignCredentialOptions doesn't follow RFC0593
    const credProposalJson = attachment.getDataAsJson<SignCredentialOptionsRFC0593>()

    if (!credProposalJson) {
      throw new AriesFrameworkError('Missing jsonld credential proposal data payload')
    }

    // FIXME: validating an interface doesn't work.

    const messageToValidate = new JsonLdCredential(credProposalJson)
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
  public async createOffer(
    agentContext: AgentContext,
    { credentialFormats, attachId }: FormatCreateOfferOptions<JsonLdCredentialFormat>
  ): Promise<FormatCreateOfferReturn> {
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

  public async processOffer(agentContext: AgentContext, { attachment }: FormatProcessOptions) {
    // FIXME: SignCredentialOptions doesn't follow RFC0593
    const credentialOfferJson = attachment.getDataAsJson<SignCredentialOptionsRFC0593>()

    if (!credentialOfferJson) {
      throw new AriesFrameworkError('Missing jsonld credential offer data payload')
    }

    // FIXME: validating an interface doesn't work.
    MessageValidator.validateSync(credentialOfferJson)
  }

  public async acceptOffer(
    agentContext: AgentContext,
    { credentialFormats, attachId, offerAttachment }: FormatAcceptOfferOptions<JsonLdCredentialFormat>
  ): Promise<FormatCreateReturn> {
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
  public async createRequest(
    agentContext: AgentContext,
    { credentialFormats }: FormatCreateRequestOptions<JsonLdCredentialFormat>
  ): Promise<FormatCreateReturn> {
    const jsonLdFormat = credentialFormats?.jsonld

    const format = new CredentialFormatSpec({
      format: JSONLD_VC_DETAIL,
    })

    if (!jsonLdFormat) {
      throw new AriesFrameworkError('Missing jsonld payload in createRequest')
    }

    // FIXME: validating an interface doesn't work.
    MessageValidator.validateSync(jsonLdFormat)

    // FIXME: SignCredentialOptions doesn't follow RFC0593
    const attachment = this.getFormatData(jsonLdFormat, format.attachId)

    return { format, attachment }
  }

  public async processRequest(agentContext: AgentContext, { attachment }: FormatProcessOptions): Promise<void> {
    // FIXME: SignCredentialOptions doesn't follow RFC0593
    const requestJson = attachment.getDataAsJson<SignCredentialOptionsRFC0593>()

    if (!requestJson) {
      throw new AriesFrameworkError('Missing jsonld credential request data payload')
    }

    // FIXME: validating an interface doesn't work.
    MessageValidator.validateSync(requestJson)
  }

  public async acceptRequest(
    agentContext: AgentContext,
    { credentialFormats, attachId, requestAttachment }: FormatAcceptRequestOptions<JsonLdCredentialFormat>
  ): Promise<FormatCreateReturn> {
    const jsonLdFormat = credentialFormats?.jsonld

    // sign credential here. credential to be signed is received as the request attachment
    // (attachment in the request message from holder to issuer)
    const credentialRequest = requestAttachment.getDataAsJson<SignCredentialOptionsRFC0593>()

    let verificationMethod = credentialFormats?.jsonld?.verificationMethod

    // FIXME: Need to transform from json to class instance
    // FIXME: SignCredentialOptions doesn't follow RFC0593
    // FIXME: Add validation of the jsonLdFormat data (if present)
    const credentialData = jsonLdFormat ?? credentialRequest

    // FIXME: we're not using all properties from the interface. If we're not using them,
    // they shouldn't be in the interface.
    if (!verificationMethod) {
      verificationMethod = await this.deriveVerificationMethod(
        agentContext,
        credentialData.credential,
        credentialRequest
      )
      if (!verificationMethod) {
        throw new AriesFrameworkError('Missing verification method in credential data')
      }
    }
    const format = new CredentialFormatSpec({
      attachId,
      format: JSONLD_VC,
    })

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
  public async deriveVerificationMethod(
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

    const keyType: string | undefined = proofTypeKeyTypeMapping[proofType]
    if (!keyType) {
      throw new AriesFrameworkError(`No Key Type found for proofType ${proofType}`)
    }

    const verificationMethod = await findVerificationMethodByKeyType(keyType, issuerDidDocument)

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

    // FIXME: we should verify the signature of the credential here to make sure we can work
    // with the credential we received.
    // FIXME: we should do a lot of checks to verify if the credential we received is actually the credential
    // we requested. We can take an example of the ACA-Py implementation:
    // https://github.com/hyperledger/aries-cloudagent-python/blob/main/aries_cloudagent/protocols/issue_credential/v2_0/formats/ld_proof/handler.py#L492
    // if (!this.areCredentialsEqual(attachment, requestAttachment)) {
    //   throw new AriesFrameworkError(
    //     `Received credential for credential record ${credentialRecord.id} does not match requested credential`
    //   )
    // }

    // compare stuff in the proof object of the credential and request...based on aca-py

    // const requestAsJson = requestAttachment.getDataAsJson<SignCredentialOptionsRFC0593>()
    // const request = JsonTransformer.fromJSON(requestAsJson, JsonLdCredential)
    // if (Array.isArray(credential.proof)) {
    //   const proofArray = credential.proof.map((proof) => new LinkedDataProof(proof))
    // } else {
    //   const credProof = new LinkedDataProof(credential.proof)

    //   this.compareStuff(credProof, request.options)
    // }

    const verifiableCredential = await this.w3cCredentialService.storeCredential(agentContext, {
      credential: credential,
    })

    credentialRecord.credentials.push({
      credentialRecordType: this.credentialRecordType,
      credentialRecordId: verifiableCredential.id,
    })
  }

  private compareStuff(credentialProof: LinkedDataProof, requestProof: JsonLdOptionsRFC0593): void {
    if (credentialProof.domain !== requestProof.domain) {
      throw Error('Received credential proof.domain does not match domain from credential request')
    }
  }

  public supportsFormat(format: string): boolean {
    const supportedFormats = [JSONLD_VC_DETAIL, JSONLD_VC]

    return supportedFormats.includes(format)
  }

  public async deleteCredentialById(): Promise<void> {
    throw new Error('Method not implemented.')
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
    // FIXME: we should do a lot of checks to verify if the credential we received is actually the credential
    // we requested. We can take an example of the ACA-Py implementation:
    // https://github.com/hyperledger/aries-cloudagent-python/blob/main/aries_cloudagent/protocols/issue_credential/v2_0/formats/ld_proof/handler.py#L492
    // TODO don't call areCredentialsEqual, call compareStuff() as per aca-py
    return true
  }
}
