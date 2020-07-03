import { plainToClass, classToPlain } from 'class-transformer';

import { L10nDecorator } from './L10nDecorator';

describe('Decorators | L10nDecorator', () => {
  it('should correctly transform Json to L10nDecorator class', () => {
    const locale = 'en';
    const decorator = plainToClass(L10nDecorator, { locale });

    expect(decorator.locale).toBe(locale);
  });

  it('should correctly transform L10nDecorator class to Json', () => {
    const locale = 'nl';

    const decorator = new L10nDecorator({
      locale,
    });

    const json = classToPlain(decorator);
    const transformed = {
      locale,
    };

    expect(json).toEqual(transformed);
  });
});
