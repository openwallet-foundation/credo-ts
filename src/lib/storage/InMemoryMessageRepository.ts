import { MessageRepository } from './MessageRepository';
import { WireMessage } from '../types';

export class InMemoryMessageRepository implements MessageRepository {
  messages: { [key: string]: WireMessage } = {};

  findByVerkey(theirKey: Verkey): WireMessage[] {
    if (this.messages[theirKey]) {
      return this.messages[theirKey];
    }
    return [];
  }

  deleteAllByVerkey(theirKey: Verkey): void {
    this.messages[theirKey] = [];
  }

  save(theirKey: Verkey, payload: WireMessage) {
    if (!this.messages[theirKey]) {
      this.messages[theirKey] = [];
    }
    this.messages[theirKey].push(payload);
  }
}
