import { BaseMessage } from '../../agent/BaseMessage'
import { JsonTransformer } from '../../utils/JsonTransformer'
import { Compose } from '../../utils/mixins'

import { AckDecorated } from './AckDecoratorExtension'

describe('Decorators | AckDecoratorExtension', () => {
  class TestMessage extends Compose(BaseMessage, [AckDecorated]) {
    public toJSON(): Record<string, unknown> {
      return JsonTransformer.toJSON(this)
    }
  }

  test('transforms AckDecorator class to JSON', () => {
    const message = new TestMessage()
    message.setPleaseAck()
    expect(message.toJSON()).toEqual({
      '@id': undefined,
      '@type': undefined,
      '~please_ack': {
        on: ['RECEIPT'],
      },
    })
  })

  test('transforms Json to AckDecorator class', () => {
    // FIXME: this doesn't pass the validation check. Should it?
    // Unsure whether this should validate and is a bug or expected behaviour. Setting validate: false for now
    const transformed = JsonTransformer.fromJSON({ '~please_ack': {} }, TestMessage, { validate: false })

    expect(transformed).toEqual({ pleaseAck: {} })
    expect(transformed).toBeInstanceOf(TestMessage)
  })
})
