import type { V2CredentialFormatSpec } from '../formats/V2CredentialFormat'
import type { CredReq } from 'indy-sdk'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../agent/AgentMessage'
import { Attachment } from '../../../../decorators/attachment/Attachment'
import { CRED_20_REQUEST } from '../formats/MessageTypes'

export interface V2RequestCredentialMessageOptions {
  id: string
  formats: V2CredentialFormatSpec
  requestsAttach: Attachment[]
  comment?: string
  credentialDefinitionId?: string
  attachments?: Attachment[] // Q: this is from the V1 message: do we need it in V2?
}

export class V2RequestCredentialMessage extends AgentMessage {
  public formats!: V2CredentialFormatSpec

  public constructor(options: V2RequestCredentialMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.credentialDefinitionId = options.credentialDefinitionId
      this.formats = options.formats
      this.requestsAttach = options.requestsAttach
      this.credentialDefinitionId = options.credentialDefinitionId
      this.attachments = options.attachments
    }
  }

  @Equals(V2RequestCredentialMessage.type)
  public readonly type = V2RequestCredentialMessage.type
  public static readonly type = CRED_20_REQUEST

  @Expose({ name: 'requests~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public requestsAttach!: Attachment[]

  /**
   * Human readable information about this Credential Proposal,
   * so the proposal can be evaluated by human judgment.
   */
  @IsOptional()
  @IsString()
  public comment?: string
  /**
   * Filter to request credential based on a particular Credential Definition.
   */
  @Expose({ name: 'cred_def_id' })
  @IsString()
  @IsOptional()
  public credentialDefinitionId?: string

  // MJR-TODO This needs moving into the format service as it is indy specific
  // this is needed for the CredentialResponseCoordinator (which needs reworking into V1 and V2 versions)
  public get indyCredentialRequest(): CredReq | null {
    // const attachment = this.requestsAttach.find(
    //   (attachment) => attachment.id === INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID
    // )
    // Extract proof request from attachment
    // MJR Q: what should the id be set to (so we can do a find on the correct attachment above)
    // const credentialReqJson = this.requestsAttach[0]?.data?.getDataAsJson<CredReq>() ?? null

    // return credentialReqJson

    return null
  }
}
