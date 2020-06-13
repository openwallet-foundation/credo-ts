import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { BaseMessageConstructor } from '../../agent/AgentMessage';
import { ThreadDecorator } from './ThreadDecorator';

export function ThreadDecorated<T extends BaseMessageConstructor>(Base: T) {
  class ThreadDecoratorExtension extends Base {
    @Expose({ name: '~thread' })
    @Type(() => ThreadDecorator)
    @ValidateNested()
    thread?: ThreadDecorator;

    getThreadId(): string | undefined {
      return this.thread?.threadId || this.id;
    }
  }

  return ThreadDecoratorExtension;
}
