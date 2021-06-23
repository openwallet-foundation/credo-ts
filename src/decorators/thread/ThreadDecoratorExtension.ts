import type { BaseMessageConstructor } from '../../agent/BaseMessage'

import { Expose, Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

import { ThreadDecorator } from './ThreadDecorator'

export function ThreadDecorated<T extends BaseMessageConstructor>(Base: T) {
  class ThreadDecoratorExtension extends Base {
    /**
     * The ~thread decorator is generally required on any type of response, since this is what connects it with the original request.
     */
    @Expose({ name: '~thread' })
    @Type(() => ThreadDecorator)
    @ValidateNested()
    public thread?: ThreadDecorator

    public get threadId(): string {
      return this.thread?.threadId ?? this.id
    }

    public setThread(options: Partial<ThreadDecorator>) {
      this.thread = new ThreadDecorator(options)
    }
  }

  return ThreadDecoratorExtension
}
