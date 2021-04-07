import type { Verkey } from 'indy-sdk';
import { Equals, IsArray, ValidateNested, IsString, IsEnum } from 'class-validator';
import { Expose, Type } from 'class-transformer';

import { AgentMessage } from '../../../agent/AgentMessage';
import { RoutingMessageType as MessageType } from './RoutingMessageType';

export interface KeylistUpdateMessageOptions {
  id?: string;
  updates: KeylistUpdate[];
}

/**
 * Used to notify the mediator of keys in use by the recipient.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#keylist-update
 */
export class KeylistUpdateMessage extends AgentMessage {
  public constructor(options: KeylistUpdateMessageOptions) {
    super();

    if (options) {
      this.id = options.id || this.generateId();
      this.updates = options.updates;
    }
  }

  @Equals(KeylistUpdateMessage.type)
  public readonly type = KeylistUpdateMessage.type;
  public static readonly type = MessageType.KeylistUpdate;

  @Type(() => KeylistUpdate)
  @IsArray()
  @ValidateNested()
  public updates!: KeylistUpdate[];
}

export enum KeylistUpdateAction {
  add = 'add',
  remove = 'remove',
}

export class KeylistUpdate {
  public constructor(options: { recipientKey: Verkey; action: KeylistUpdateAction }) {
    if (options) {
      this.recipientKey = options.recipientKey;
      this.action = options.action;
    }
  }

  @IsString()
  @Expose({ name: 'recipient_key' })
  public recipientKey!: Verkey;

  @IsEnum(KeylistUpdateAction)
  public action!: KeylistUpdateAction;
}
