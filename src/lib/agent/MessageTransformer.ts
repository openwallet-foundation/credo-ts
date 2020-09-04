import { classToPlain, plainToClass, serialize } from 'class-transformer';
import { AgentMessage } from './AgentMessage';
import { ClassType } from 'class-transformer/ClassTransformer';

export class MessageTransformer {
  public static toJSON<T extends AgentMessage>(classInstance: T) {
    return classToPlain(classInstance);
  }

  public static toMessageInstance<T extends AgentMessage>(messageJson: unknown, MessageClass: ClassType<T>): T {
    return plainToClass(MessageClass, messageJson);
  }

  public static serialize<T extends AgentMessage>(classInstance: T): string {
    return serialize(classInstance);
  }
}
