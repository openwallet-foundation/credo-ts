import { DIDCommV1Message } from '../../agent/didcomm'
import { JsonTransformer } from '../../utils/JsonTransformer'
import { Compose } from '../../utils/mixins'

import { AckDecorated } from './AckDecoratorExtension'

describe('Decorators | AckDecoratorExtension', () => {
  class TestMessage extends Compose(DIDCommV1Message, [AckDecorated]) {
    public toJSON(): Record<string, unknown> {
      return JsonTransformer.toJSON(this)
    }
  }

  test('transforms AckDecorator class to JSON', () => {
    const message = new TestMessage()
    message.setPleaseAck()
    expect(message.toJSON()).toEqual({ '~please_ack': {} })
  })

  test('transforms Json to AckDecorator class', () => {
    const transformed = JsonTransformer.fromJSON({ '~please_ack': {} }, TestMessage)

    expect(transformed).toEqual({ pleaseAck: {} })
    expect(transformed).toBeInstanceOf(TestMessage)
  })
})
