import { Equals, IsArray, ValidateNested, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

import { AgentMessage } from '../../../agent/AgentMessage';
import { RoutingMessageType as MessageType } from './RoutingMessageType';

export interface RequestMediationMessageOptions {
    id: string;
    // Maybe add support for mediator_terms, recipient_terms
}

/**
 * Used to notify the mediator of keys in use by the recipient.
 *
 * @see https://github.com/hyperledger/aries-rfcs/tree/master/features/0211-route-coordination
 */
export class RequestMediationMessage extends AgentMessage {
  public constructor(options: RequestMediationMessageOptions) {
    super();
    this.id = options.id;

  }

  @Equals(RequestMediationMessage.type)
  public readonly type = RequestMediationMessage.type;
  public static readonly type = MessageType.RequestMediation;
}
