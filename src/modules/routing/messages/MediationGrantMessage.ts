import type { Verkey } from 'indy-sdk';
import { Equals, IsArray, IsString } from 'class-validator';

import { AgentMessage } from '../../../agent/AgentMessage';
import { RoutingMessageType as MessageType } from './RoutingMessageType';

export interface MediationGrantMessageOptions {
  id?: string;
  endpoint: string;
  routing_keys: Verkey[];
}

/**
 * Used to notify the mediator of keys in use by the recipient.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#keylist-update
 */
export class MediationGrantMessage extends AgentMessage {
  public constructor(options: MediationGrantMessageOptions) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
      this.endpoint = options.endpoint;
      this.routing_keys = options.routing_keys;
    }
  }

  @Equals(MediationGrantMessage.type)
  public readonly type = MediationGrantMessage.type;
  public static readonly type = MessageType.MediationGrant;

  @IsArray()
  public routing_keys!: Verkey[];

  @IsString()
  public endpoint!: string;
}