import { Equals, IsArray, ValidateNested, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

import { AgentMessage } from '../../../agent/AgentMessage';
import { RoutingMessageType as MessageType } from './RoutingMessageType';
import { Verkey } from 'indy-sdk';

export interface MediationGrantedMessageOptions {
    id: string;
    endpoint: string;
    rountingKeys: [Verkey]
}

/**
 * Used to notify the mediator of keys in use by the recipient.
 *
 * @see https://github.com/hyperledger/aries-rfcs/tree/master/features/0211-route-coordination
 */
export class MediationGrantedMessage extends AgentMessage {
  public constructor(options: MediationGrantedMessageOptions) {
    super();
    this.id = options.id;

  }

//   Add validation (make sure that these are valid . At least not null. See if you can pull. Check if it's not null and not an empty string.)
//  Routing key - at least one and has to be. 

  @Equals(MediationGrantedMessage.type)
  public readonly type = MediationGrantedMessage.type;
  public static readonly type = MessageType.MediationGrant;
}