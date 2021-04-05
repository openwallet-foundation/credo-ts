import { ConnectionInvitationMessage } from '../../modules/connections'
import { JsonTransformer } from '../JsonTransformer'

describe('JsonTransformer', () => {
  describe('toJSON', () => {
    it('transforms class instance to JSON object', () => {
      const invitation = new ConnectionInvitationMessage({
        did: 'did:sov:test1234',
        id: 'afe2867e-58c3-4a8d-85b2-23370dd9c9f0',
        label: 'test-label',
      })

      const json = {
        '@type': 'https://didcomm.org/connections/1.0/invitation',
        '@id': 'afe2867e-58c3-4a8d-85b2-23370dd9c9f0',
        label: 'test-label',
        did: 'did:sov:test1234',
      }

      expect(JsonTransformer.toJSON(invitation)).toEqual(json)
    })
  })

  describe('fromJSON', () => {
    it('transforms JSON object to class instance', () => {
      const json = {
        '@type': 'https://didcomm.org/connections/1.0/invitation',
        '@id': 'afe2867e-58c3-4a8d-85b2-23370dd9c9f0',
        label: 'test-label',
        did: 'did:sov:test1234',
      }

      const invitation = new ConnectionInvitationMessage({
        did: 'did:sov:test1234',
        id: 'afe2867e-58c3-4a8d-85b2-23370dd9c9f0',
        label: 'test-label',
      })

      expect(JsonTransformer.fromJSON(json, ConnectionInvitationMessage)).toEqual(invitation)
    })
  })

  describe('serialize', () => {
    it('transforms class instance to JSON string', () => {
      const invitation = new ConnectionInvitationMessage({
        did: 'did:sov:test1234',
        id: 'afe2867e-58c3-4a8d-85b2-23370dd9c9f0',
        label: 'test-label',
      })

      const jsonString =
        '{"@type":"https://didcomm.org/connections/1.0/invitation","@id":"afe2867e-58c3-4a8d-85b2-23370dd9c9f0","label":"test-label","did":"did:sov:test1234"}'

      expect(JsonTransformer.serialize(invitation)).toEqual(jsonString)
    })
  })

  describe('deserialize', () => {
    it('transforms JSON string to class instance', () => {
      const jsonString =
        '{"@type":"https://didcomm.org/connections/1.0/invitation","@id":"afe2867e-58c3-4a8d-85b2-23370dd9c9f0","label":"test-label","did":"did:sov:test1234"}'

      const invitation = new ConnectionInvitationMessage({
        did: 'did:sov:test1234',
        id: 'afe2867e-58c3-4a8d-85b2-23370dd9c9f0',
        label: 'test-label',
      })

      expect(JsonTransformer.deserialize(jsonString, ConnectionInvitationMessage)).toEqual(invitation)
    })
  })
})
