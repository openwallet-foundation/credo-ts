import { validate } from 'class-validator'

import { JsonTransformer } from '../../../../core'

import { ThreadDecorator } from './ThreadDecorator'

describe('Decorators | ThreadDecorator', () => {
  it('should correctly transform Json to ThreadDecorator class', () => {
    const json = {
      thid: 'ceffce22-6471-43e4-8945-b604091981c9',
      pthid: '917a109d-eae3-42bc-9436-b02426d3ce2c',
      sender_order: 2,
      received_orders: {
        'did:sov:3ecf688c-cb3f-467b-8636-6b0c7f1d9022': 1,
      },
    }
    const decorator = JsonTransformer.fromJSON(json, ThreadDecorator)

    expect(decorator.threadId).toBe(json.thid)
    expect(decorator.parentThreadId).toBe(json.pthid)
    expect(decorator.senderOrder).toBe(json.sender_order)
    expect(decorator.receivedOrders).toEqual(json.received_orders)
  })

  it('should correctly transform ThreadDecorator class to Json', () => {
    const threadId = 'ceffce22-6471-43e4-8945-b604091981c9'
    const parentThreadId = '917a109d-eae3-42bc-9436-b02426d3ce2c'
    const senderOrder = 2
    const receivedOrders = {
      'did:sov:3ecf688c-cb3f-467b-8636-6b0c7f1d9022': 1,
    }

    const decorator = new ThreadDecorator({
      threadId,
      parentThreadId,
      senderOrder,
      receivedOrders,
    })

    const json = JsonTransformer.toJSON(decorator)
    const transformed = {
      thid: threadId,
      pthid: parentThreadId,
      sender_order: senderOrder,
      received_orders: receivedOrders,
    }

    expect(json).toEqual(transformed)
  })
  describe('PthidRegExp validation', () => {
    it('should accept valid message IDs for parentThreadId', async () => {
      const decorator = new ThreadDecorator({
        parentThreadId: 'ceffce22-6471-43e4-8945-b604091981c9',
      })
      const validationErrors = await validate(decorator)
      expect(validationErrors).toHaveLength(0)
    })

    it('should accept valid DIDs for parentThreadId', async () => {
      const validDids = [
        'did:example:123456789abcdefghi',
        'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH',
        'did:web:example.com',
        'did:web:example%3Acom',
        'did:sov:3ecf688c-cb3f-467b-8636-6b0c7f1d9022',
        'did:indy:sovrin:staging:3ecf688c-cb3f-467b-8636-6b0c7f1d9022',
        'did:peer:1zQmNbr8L7xqgCN7aQWG4TgH8xrp9Z3nR2vY6CqK8uDx',
      ]

      for (const did of validDids) {
        const decorator = new ThreadDecorator({
          parentThreadId: did,
        })
        const validationErrors = await validate(decorator)
        expect(validationErrors).toHaveLength(0)
      }
    })

    it('should accept valid DID URLs with query and fragment for parentThreadId', async () => {
      const validDidUrls = [
        'did:example:123456789abcdefghi?service=agent&relativeRef=my%20ref',
        'did:example:123456789abcdefghi#keys-1',
        'did:example:123456789abcdefghi?query=value#fragment',
      ]

      for (const didUrl of validDidUrls) {
        const decorator = new ThreadDecorator({
          parentThreadId: didUrl,
        })
        const validationErrors = await validate(decorator)
        expect(validationErrors).toHaveLength(0)
      }
    })

    it('should reject invalid formats for parentThreadId', async () => {
      const invalidValues = [
        'short', // too short
        'invalid-did:format', // invalid DID format
        'did:', // incomplete DID
        'did:method', // incomplete DID
        '12345678901234567890123456789012345678901234567890123456789012345', // too long
        'invalid!@#$%^&*()format', // invalid characters
        'did:example:incomplete%ZZencoding', // invalid percent-encoding
      ]

      for (const invalidValue of invalidValues) {
        const decorator = new ThreadDecorator({
          parentThreadId: invalidValue,
        })
        const validationErrors = await validate(decorator)
        expect(validationErrors.length).toBeGreaterThan(0) // expect to fail on each invalid value
        expect(validationErrors[0].property).toBe('parentThreadId')
      }
    })

    it('should accept valid message IDs for threadId', async () => {
      const decorator = new ThreadDecorator({
        threadId: 'ceffce22-6471-43e4-8945-b604091981c9',
      })
      const validationErrors = await validate(decorator)
      expect(validationErrors).toHaveLength(0)
    })

    it('should accept valid DIDs for threadId', async () => {
      const decorator = new ThreadDecorator({
        threadId: 'did:example:123456789abcdefghi',
      })
      const validationErrors = await validate(decorator)
      expect(validationErrors).toHaveLength(0)
    })
  })
})
