import { BaseMessage } from '../../agent/BaseMessage'
import { ClassValidationError } from '../../error/ClassValidationError'
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
    const transformed = () =>
      JsonTransformer.fromJSON(
        {
          '~please_ack': {},
          '@id': undefined,
          '@type': undefined,
        },
        TestMessage
      )

    expect(() => transformed()).toThrow(ClassValidationError)
    try {
      transformed()
    } catch (e) {
      const caughtError = e as ClassValidationError
      expect(caughtError.message).toEqual(
        'AckDecoratorExtension: Failed to validate class.\nAn instance of TestMessage has failed the validation:\n - property id has failed the following constraints: matches \n\nAn instance of TestMessage has failed the validation:\n - property type has failed the following constraints: matches \n'
      )
      expect(caughtError.validationErrors).toMatchObject([
        {
          children: [],
          constraints: {
            matches: 'id must match /[-_./a-zA-Z0-9]{8,64}/ regular expression',
          },
          property: 'id',
          target: {
            pleaseAck: {
              on: ['RECEIPT'],
            },
          },
          value: undefined,
        },
        {
          children: [],
          constraints: {
            matches: 'type must match /(.*?)([a-zA-Z0-9._-]+)\\/(\\d[^/]*)\\/([a-zA-Z0-9._-]+)$/ regular expression',
          },
          property: 'type',
          target: {
            pleaseAck: {
              on: ['RECEIPT'],
            },
          },
          value: undefined,
        },
      ])
    }
  })
})
