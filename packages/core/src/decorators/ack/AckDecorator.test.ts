import { wordSize } from 'bn.js'

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
        TestMessage,
        {
          validate: true,
        }
      )

    expect(() => transformed()).toThrow(ClassValidationError)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let caughtError: any
    try {
      transformed()
    } catch (e) {
      caughtError = e
    }
    expect(caughtError.message.includes('An instance of TestMessage has failed the validation')).toBeTruthy()
    expect(caughtError.message.includes('property id has failed the following constraints: matches')).toBeTruthy()
    expect(caughtError.message.includes('- property type has failed the following constraints: matches')).toBeTruthy()
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
  })
})
