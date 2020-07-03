import { Expose, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { BaseMessageConstructor } from '../../agent/AgentMessage';
import { TimingDecorator } from './TimingDecorator';

export function TimingDecorated<T extends BaseMessageConstructor>(Base: T) {
  class TimingDecoratorExtension extends Base {
    /**
     * Timing attributes of messages can be described with the ~timing decorator.
     */
    @Expose({ name: '~timing' })
    @Type(() => TimingDecorator)
    @ValidateNested()
    timing?: TimingDecorator;

    setTiming(options: Partial<TimingDecorator>) {
      this.timing = new TimingDecorator(options);
    }
  }

  return TimingDecoratorExtension;
}
