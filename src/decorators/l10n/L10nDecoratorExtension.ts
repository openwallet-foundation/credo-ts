import { Expose, Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

import { BaseMessageConstructor } from '../../agent/BaseMessage'
import { L10nDecorator } from './L10nDecorator'

export function L10nDecorated<T extends BaseMessageConstructor>(Base: T) {
  class L10nDecoratorExtension extends Base {
    @Expose({ name: '~l10n' })
    @Type(() => L10nDecorator)
    @ValidateNested()
    public l10n?: L10nDecorator

    public addLocale(locale: string) {
      this.l10n = new L10nDecorator({
        locale,
      })
    }

    public getLocale(): string | undefined {
      if (this.l10n?.locale) return this.l10n.locale

      return undefined
    }
  }

  return L10nDecoratorExtension
}
