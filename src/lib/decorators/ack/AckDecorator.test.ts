import { JsonTransformer } from '../../utils/JsonTransformer';

import { AckDecorator } from './AckDecorator';

describe('Decorators | AckDecorator', () => {
  it('should correctly transform Json to AckDecorator class', () => {
    const pleaseAck = {};
    const decorator = JsonTransformer.fromJSON({ pleaseAck }, AckDecorator);

    expect(decorator.pleaseAck).toEqual(pleaseAck);
  });

  it('should correctly transform AckDecorator class to Json', () => {
    const pleaseAck = {};

    const decorator = new AckDecorator({
      pleaseAck,
    });

    const json = JsonTransformer.toJSON(decorator);
    const transformed = {
      pleaseAck,
    };

    expect(json).toEqual(transformed);
  });
});
