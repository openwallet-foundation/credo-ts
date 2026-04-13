import { JsonTransformer } from '@credo-ts/core'

import {
  KeylistUpdateActionV2,
  DidCommKeylistUpdateV2Message,
  KeylistUpdateResultV2,
  DidCommKeylistUpdateResponseV2Message,
  DidCommKeylistV2Message,
  DidCommKeylistQueryV2Message,
  DidCommMediateDenyV2Message,
  DidCommMediateGrantV2Message,
  DidCommMediateRequestV2Message,
  Paginate,
} from '../index'

describe('Coordinate Mediation 2.0 Messages', () => {
  describe('DidCommMediateRequestV2Message', () => {
    it('should create valid message', () => {
      const message = new DidCommMediateRequestV2Message()
      expect(message.type).toBe('https://didcomm.org/coordinate-mediation/2.0/mediate-request')
      expect(message.supportedDidCommVersions).toEqual(['v2'])
      expect(message.id).toBeDefined()
    })
  })

  describe('DidCommMediateGrantV2Message', () => {
    it('should create valid message with routing_did', () => {
      const message = new DidCommMediateGrantV2Message({
        routingDid: 'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc',
        threadId: 'thread-123',
      })
      expect(message.type).toBe('https://didcomm.org/coordinate-mediation/2.0/mediate-grant')
      expect(message.routingDid).toBe('did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc')

      const json = JsonTransformer.toJSON(message)
      expect(json['routing_did']).toBe('did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc')
    })
  })

  describe('DidCommMediateDenyV2Message', () => {
    it('should create valid message', () => {
      const message = new DidCommMediateDenyV2Message()
      expect(message.type).toBe('https://didcomm.org/coordinate-mediation/2.0/mediate-deny')
    })
  })

  describe('DidCommKeylistUpdateV2Message', () => {
    it('should create valid message with recipient_did updates', () => {
      const message = new DidCommKeylistUpdateV2Message({
        updates: [
          { recipientDid: 'did:peer:2.xxx', action: KeylistUpdateActionV2.add },
          { recipientDid: 'did:peer:2.yyy', action: KeylistUpdateActionV2.remove },
        ],
      })
      expect(message.type).toBe('https://didcomm.org/coordinate-mediation/2.0/keylist-update')
      expect(message.updates).toHaveLength(2)
      expect(message.updates[0].recipientDid).toBe('did:peer:2.xxx')
      expect(message.updates[0].action).toBe(KeylistUpdateActionV2.add)

      const json = JsonTransformer.toJSON(message)
      expect(json.updates[0]['recipient_did']).toBe('did:peer:2.xxx')
    })
  })

  describe('DidCommKeylistUpdateResponseV2Message', () => {
    it('should create valid message', () => {
      const message = new DidCommKeylistUpdateResponseV2Message({
        updated: [
          {
            recipientDid: 'did:peer:2.xxx',
            action: KeylistUpdateActionV2.add,
            result: KeylistUpdateResultV2.Success,
          },
        ],
      })
      expect(message.type).toBe('https://didcomm.org/coordinate-mediation/2.0/keylist-update-response')
      expect(message.updated[0].result).toBe(KeylistUpdateResultV2.Success)
    })
  })

  describe('DidCommKeylistQueryV2Message', () => {
    it('should create valid message without paginate', () => {
      const message = new DidCommKeylistQueryV2Message()
      expect(message.type).toBe('https://didcomm.org/coordinate-mediation/2.0/keylist-query')
    })

    it('should create valid message with paginate', () => {
      const message = new DidCommKeylistQueryV2Message({ paginate: { limit: 30, offset: 0 } })
      expect(message.paginate).toBeDefined()
      expect(message.paginate?.limit).toBe(30)
      expect(message.paginate?.offset).toBe(0)
    })
  })

  describe('DidCommKeylistV2Message', () => {
    it('should create valid message', () => {
      const message = new DidCommKeylistV2Message({
        keys: [{ recipientDid: 'did:peer:2.xxx' }],
        pagination: { count: 1, offset: 0, remaining: 0 },
      })
      expect(message.type).toBe('https://didcomm.org/coordinate-mediation/2.0/keylist')
      expect(message.keys).toHaveLength(1)
      expect(message.keys[0].recipientDid).toBe('did:peer:2.xxx')
    })
  })
})
