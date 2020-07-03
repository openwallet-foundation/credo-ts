/**
 * Represents `~l10n` decorator
 */
export class L10nDecorator {
  constructor(partial?: Partial<L10nDecorator>) {
    this.locale = partial?.locale;
  }

  locale?: string;
}
