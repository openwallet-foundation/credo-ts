import { AttachmentFormats, CredentialFormatService } from '../CredentialFormatService'
import { V2CredentialFormatSpec } from '../V2CredentialFormat'
import { Attachment } from 'packages/core/src/decorators/attachment/Attachment'
import { ProposeCredentialOptions } from '../../interfaces'
import { LinkedAttachment } from 'packages/core/src/utils/LinkedAttachment'
import { CredentialPreviewAttribute } from '../../../CredentialPreviewV2'
import { CredentialRecord } from '../../..'

export class JsonLdCredentialFormatService extends CredentialFormatService {
  getCredentialDefinitionId(proposal: ProposeCredentialOptions): string | undefined {
    throw new Error('Method not implemented.')
  }
  getCredentialLinkedAttachments(proposal: ProposeCredentialOptions): LinkedAttachment[] | undefined {
    throw new Error('Method not implemented.')
  }
  getCredentialAttributes(proposal: ProposeCredentialOptions): CredentialPreviewAttribute[] | undefined {
    throw new Error('Method not implemented.')
  }
  setMetaDataAndEmitEvent(proposal: ProposeCredentialOptions, credentialRecord: CredentialRecord): Promise<void> {
    throw new Error('Method not implemented.')
  }
  getCredentialProposeAttachFormats(proposal: ProposeCredentialOptions, messageType: string): AttachmentFormats {
    throw new Error('Method not implemented.')
  }
  getFormatIdentifier(messageType: string): V2CredentialFormatSpec {
    throw new Error('Method not implemented.')
  }
  getFormatData(messageType: string, data: ProposeCredentialOptions): Attachment {
    throw new Error('Method not implemented.')
  }
}