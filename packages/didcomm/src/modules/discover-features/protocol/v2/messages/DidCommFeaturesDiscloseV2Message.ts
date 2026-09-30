import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import { DidCommFeaturesDisclosuresMessage } from './DidCommFeaturesDisclosuresMessage'

export class DidCommFeaturesDiscloseV2Message extends DidCommFeaturesDisclosuresMessage {
  @IsValidMessageType(DidCommFeaturesDiscloseV2Message.type)
  public readonly type = DidCommFeaturesDiscloseV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/discover-features/2.0/disclose')
}
