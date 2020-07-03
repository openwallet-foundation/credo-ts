import { classToPlain, plainToClass } from 'class-transformer';
import { AgentMessage } from './AgentMessage';
import { ClassType } from 'class-transformer/ClassTransformer';

export class MessageTransformer {
  static toJSON<T extends AgentMessage>(classInstance: T) {
    return classToPlain(classInstance);
  }

  static toMessageInstance<T extends AgentMessage>(messageJson: unknown, MessageClass: ClassType<T>): T {
    return plainToClass(MessageClass, messageJson);
  }
}
