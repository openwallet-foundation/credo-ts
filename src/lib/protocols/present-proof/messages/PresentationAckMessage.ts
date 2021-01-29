import { Equals } from 'class-validator';

import { AgentMessage } from '../../../agent/AgentMessage';
import { PresentProofMessageType } from './PresentProofMessageType';

interface PresentationAckMessageOptions {
  id?: string;
}

export class PresentationAckMessage extends AgentMessage {
  public constructor(options: PresentationAckMessageOptions) {
    super();

    if (options) {
      this.id = options.id ?? this.generateId();
    }
  }

  @Equals(PresentationAckMessage.type)
  public readonly type = PresentationAckMessage.type;
  public static readonly type = PresentProofMessageType.PresentationAck;
}
