import { V2CredentialFormatSpec } from "../formats/V2CredentialFormat"
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import { Equals } from 'class-validator'
import { AgentMessage } from '../../../../agent/AgentMessage'
import { CredentialPreview } from '../../CredentialPreview'
import { CRED_20_PROPOSAL } from "../formats/MessageTypes"

export class V2ProposeCredentialMessage extends AgentMessage {

  // MJR-TODO is there a better way to declare these? (interface? decorators)
  public comment?: string
  public credentialProposal?: CredentialPreview
  public formats: V2CredentialFormatSpec
  public filtersAttach: Attachment
  public credentialDefinitionId?: string


  constructor(id: string, 
    formats: V2CredentialFormatSpec,
    filtersAttach: Attachment,
    comment?: string,
    credentialDefinitionId?: string,
    credentialPreview?: CredentialPreview,) {
    super()
    this.id = id
    this.comment = comment
    this.credentialProposal = credentialPreview
    this.formats = formats
    this.filtersAttach = filtersAttach
    this.credentialDefinitionId = credentialDefinitionId
  }

  @Equals(V2ProposeCredentialMessage.type)
  public readonly type = V2ProposeCredentialMessage.type
  public static readonly type = CRED_20_PROPOSAL


}