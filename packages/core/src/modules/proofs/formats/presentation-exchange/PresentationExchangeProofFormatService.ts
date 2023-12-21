import type { PresentationExchangeProofFormat } from './PresentationExchangeProofFormat'
import type { AgentContext } from '../../../../agent'
import type {
  PresentationDefinition,
  VerifiablePresentation,
} from '../../../presentation-exchange/PresentationExchangeService'
import type { W3cCredentialRecord, W3cVerifiablePresentation } from '../../../vc'
import type { InputDescriptorToCredentials } from '../../models'
import type { ProofFormatService } from '../ProofFormatService'
import type {
  ProofFormatCreateProposalOptions,
  ProofFormatCreateReturn,
  ProofFormatProcessOptions,
  ProofFormatAcceptProposalOptions,
  FormatCreateRequestOptions,
  ProofFormatAcceptRequestOptions,
  ProofFormatProcessPresentationOptions,
  ProofFormatGetCredentialsForRequestOptions,
  ProofFormatSelectCredentialsForRequestOptions,
  ProofFormatAutoRespondProposalOptions,
  ProofFormatAutoRespondRequestOptions,
  ProofFormatAutoRespondPresentationOptions,
} from '../ProofFormatServiceOptions'
import type { PresentationSubmission } from '@sphereon/pex-models'

import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../error'
import { deepEquality } from '../../../../utils'
import { PresentationExchangeService } from '../../../presentation-exchange/PresentationExchangeService'
import { ProofFormatSpec } from '../../models'

const PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL = 'dif/presentation-exchange/definitions@v1.0'
const PRESENTATION_EXCHANGE_PRESENTATION_REQUEST = 'dif/presentation-exchange/definitions@v1.0'
const PRESENTATION_EXCHANGE_PRESENTATION = 'dif/presentation-exchange/submission@v1.0'

export class PresentationExchangeProofFormatService implements ProofFormatService<PresentationExchangeProofFormat> {
  public readonly formatKey = 'presentationExchange' as const

  private presentationExchangeService(agentContext: AgentContext) {
    if (!agentContext.dependencyManager.isRegistered(PresentationExchangeService)) {
      throw new AriesFrameworkError(
        'PresentationExchangeService is not registered on the Agent. Please provide the PresentationExchangeModule as a module on the agent'
      )
    }

    return agentContext.dependencyManager.resolve(PresentationExchangeService)
  }

  public supportsFormat(formatIdentifier: string): boolean {
    return [
      PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL,
      PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
      PRESENTATION_EXCHANGE_PRESENTATION,
    ].includes(formatIdentifier)
  }

  public async createProposal(
    agentContext: AgentContext,
    { proofFormats, attachmentId }: ProofFormatCreateProposalOptions<PresentationExchangeProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    const ps = this.presentationExchangeService(agentContext)

    const pexFormat = proofFormats.presentationExchange
    if (!pexFormat) {
      throw new AriesFrameworkError('Missing Presentation Exchange format in create proposal attachment format')
    }

    const { presentationDefinition } = pexFormat

    ps?.validatePresentationDefinition(presentationDefinition)

    const format = new ProofFormatSpec({ format: PRESENTATION_EXCHANGE_PRESENTATION_PROPOSAL, attachmentId })

    const attachment = this.getFormatData(presentationDefinition, format.attachmentId)

    return { format, attachment }
  }

  public async processProposal(agentContext: AgentContext, { attachment }: ProofFormatProcessOptions): Promise<void> {
    const ps = this.presentationExchangeService(agentContext)
    const proposal = attachment.getDataAsJson<PresentationDefinition>()
    ps.validatePresentationDefinition(proposal)
  }

  public async acceptProposal(
    agentContext: AgentContext,
    { attachmentId, proposalAttachment }: ProofFormatAcceptProposalOptions<PresentationExchangeProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    const ps = this.presentationExchangeService(agentContext)

    const format = new ProofFormatSpec({
      format: PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
      attachmentId,
    })

    const presentationDefinition = proposalAttachment.getDataAsJson<PresentationDefinition>()

    ps.validatePresentationDefinition(presentationDefinition)

    const attachment = this.getFormatData({ presentation_definition: presentationDefinition }, format.attachmentId)

    return { format, attachment }
  }

  public async createRequest(
    agentContext: AgentContext,
    { attachmentId, proofFormats }: FormatCreateRequestOptions<PresentationExchangeProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    const ps = this.presentationExchangeService(agentContext)

    const presentationExchangeFormat = proofFormats.presentationExchange

    if (!presentationExchangeFormat) {
      throw Error('Missing presentation exchange format in create request attachment format')
    }

    const { presentationDefinition } = presentationExchangeFormat

    ps.validatePresentationDefinition(presentationDefinition)

    const format = new ProofFormatSpec({
      format: PRESENTATION_EXCHANGE_PRESENTATION_REQUEST,
      attachmentId,
    })

    const options = { challenge: 'TODO' }

    const attachment = this.getFormatData(
      { options, presentation_definition: presentationDefinition },
      format.attachmentId
    )

    return { attachment, format }
  }

  public async processRequest(agentContext: AgentContext, { attachment }: ProofFormatProcessOptions): Promise<void> {
    const ps = this.presentationExchangeService(agentContext)
    const { presentation_definition: presentationDefinition } = attachment.getDataAsJson<{
      presentation_definition: PresentationDefinition
    }>()
    ps.validatePresentationDefinition(presentationDefinition)
  }

  public async acceptRequest(
    agentContext: AgentContext,
    { attachmentId, requestAttachment }: ProofFormatAcceptRequestOptions<PresentationExchangeProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    const ps = this.presentationExchangeService(agentContext)

    const format = new ProofFormatSpec({
      format: PRESENTATION_EXCHANGE_PRESENTATION,
      attachmentId,
    })

    const { presentation_definition: presentationDefinition, options } = requestAttachment.getDataAsJson<{
      presentation_definition: PresentationDefinition
      options?: { challenge?: string; domain?: string }
    }>()

    const { areRequirementsSatisfied, requirements } = await ps.selectCredentialsForRequest(
      agentContext,
      presentationDefinition
    )

    if (!areRequirementsSatisfied) {
      throw new AriesFrameworkError('Requirements of the presentation definition could not be satifsied')
    }

    const credentials: InputDescriptorToCredentials = {}

    requirements.forEach((r) => {
      r.submissionEntry.forEach((r) => {
        credentials[r.inputDescriptorId] = r.verifiableCredentials.map((c) => c.credential)
      })
    })

    const presentation = await ps.createPresentation(agentContext, {
      presentationDefinition,
      credentialsForInputDescriptor: credentials,
      challenge: options?.challenge,
      domain: options?.domain,
    })

    if (presentation.verifiablePresentations.length > 1) {
      throw new AriesFrameworkError('Invalid amount of verifiable presentations. Only one is allowed.')
    }

    const data = {
      presentation_submission: presentation.presentationSubmission,
      ...presentation.verifiablePresentations[0],
    }

    const attachment = this.getFormatData(data, format.attachmentId)

    return { attachment, format }
  }

  public async processPresentation(
    agentContext: AgentContext,
    { requestAttachment, attachment }: ProofFormatProcessPresentationOptions
  ): Promise<boolean> {
    const ps = this.presentationExchangeService(agentContext)
    const { presentation_definition: presentationDefinition } = requestAttachment.getDataAsJson<{
      presentation_definition: PresentationDefinition
    }>()
    const presentation = attachment.getDataAsJson<
      W3cVerifiablePresentation & { presentation_submission: PresentationSubmission }
    >()

    try {
      ps.validatePresentationDefinition(presentationDefinition)
      if (presentation.presentation_submission) {
        ps.validatePresentationSubmission(presentation.presentation_submission)
      }

      ps.validatePresentation(presentationDefinition, presentation as unknown as VerifiablePresentation)
      return true
    } catch (e) {
      agentContext.config.logger.error(e)
      return false
    }
  }

  public async getCredentialsForRequest(
    agentContext: AgentContext,
    { requestAttachment }: ProofFormatGetCredentialsForRequestOptions<PresentationExchangeProofFormat>
  ): Promise<Array<W3cCredentialRecord>> {
    const ps = this.presentationExchangeService(agentContext)
    const { presentation_definition: presentationDefinition } = requestAttachment.getDataAsJson<{
      presentation_definition: PresentationDefinition
    }>()

    ps.validatePresentationDefinition(presentationDefinition)

    const presentationSubmission = await ps.selectCredentialsForRequest(agentContext, presentationDefinition)

    const credentials = presentationSubmission.requirements.flatMap((r) =>
      r.submissionEntry.flatMap((e) => e.verifiableCredentials)
    )

    return credentials
  }

  public async selectCredentialsForRequest(
    agentContext: AgentContext,
    { requestAttachment }: ProofFormatSelectCredentialsForRequestOptions<PresentationExchangeProofFormat>
  ): Promise<Array<W3cCredentialRecord>> {
    const ps = this.presentationExchangeService(agentContext)
    const { presentation_definition: presentationDefinition } = requestAttachment.getDataAsJson<{
      presentation_definition: PresentationDefinition
    }>()

    ps.validatePresentationDefinition(presentationDefinition)

    const presentationSubmission = await ps.selectCredentialsForRequest(agentContext, presentationDefinition)

    const credentials = presentationSubmission.requirements.flatMap((r) =>
      r.submissionEntry.flatMap((e) => e.verifiableCredentials)
    )

    return credentials
  }

  public async shouldAutoRespondToProposal(
    _agentContext: AgentContext,
    { requestAttachment, proposalAttachment }: ProofFormatAutoRespondProposalOptions
  ): Promise<boolean> {
    const proposalData = proposalAttachment.getDataAsJson<PresentationDefinition>()
    const requestData = requestAttachment.getDataAsJson<PresentationDefinition>()

    return deepEquality(requestData, proposalData)
  }

  public async shouldAutoRespondToRequest(
    _agentContext: AgentContext,
    { requestAttachment, proposalAttachment }: ProofFormatAutoRespondRequestOptions
  ): Promise<boolean> {
    const proposalData = proposalAttachment.getDataAsJson<PresentationDefinition>()
    const requestData = requestAttachment.getDataAsJson<PresentationDefinition>()

    return deepEquality(requestData, proposalData)
  }
  /**
   *
   * The presentation is already verified in processPresentation, so we can just return true here.
   * It's only an ack, so it's just that we received the presentation.
   *
   */
  public async shouldAutoRespondToPresentation(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _agentContext: AgentContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options: ProofFormatAutoRespondPresentationOptions
  ): Promise<boolean> {
    return true
  }

  private getFormatData<T extends Record<string, unknown>>(data: T, id: string): Attachment {
    const attachment = new Attachment({
      id,
      mimeType: 'application/json',
      data: new AttachmentData({
        json: data,
      }),
    })

    return attachment
  }
}