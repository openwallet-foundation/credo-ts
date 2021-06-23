import { ConnectionInvitationMessage, ConnectionRecord, DidDoc } from '../../modules/connections'
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

    it('transforms JSON string to nested class instance', () => {
      const connectionString = `{"createdAt":"2021-06-06T10:16:02.740Z","did":"5AhYREdFcNAdxMhuFfMrG8","didDoc":{"@context":"https://w3id.org/did/v1","publicKey":[{"id":"5AhYREdFcNAdxMhuFfMrG8#1","controller":"5AhYREdFcNAdxMhuFfMrG8","type":"Ed25519VerificationKey2018","publicKeyBase58":"3GjajqxDHZfD4FCpMsA6K5mey782oVJgizapkYUTkYJC"}],"service":[{"id":"5AhYREdFcNAdxMhuFfMrG8#did-communication","serviceEndpoint":"didcomm:transport/queue","type":"did-communication","priority":1,"recipientKeys":["3GjajqxDHZfD4FCpMsA6K5mey782oVJgizapkYUTkYJC"],"routingKeys":[]},{"id":"5AhYREdFcNAdxMhuFfMrG8#IndyAgentService","serviceEndpoint":"didcomm:transport/queue","type":"IndyAgent","priority":0,"recipientKeys":["3GjajqxDHZfD4FCpMsA6K5mey782oVJgizapkYUTkYJC"],"routingKeys":[]}],"authentication":[{"publicKey":"5AhYREdFcNAdxMhuFfMrG8#1","type":"Ed25519SignatureAuthentication2018"}],"id":"5AhYREdFcNAdxMhuFfMrG8"},"verkey":"3GjajqxDHZfD4FCpMsA6K5mey782oVJgizapkYUTkYJC","state":"complete","role":"invitee","alias":"Mediator","invitation":{"@type":"https://didcomm.org/connections/1.0/invitation","@id":"f2938e83-4ea4-44ef-acb1-be2351112fec","label":"RoutingMediator02","recipientKeys":["DHf1TwnRHQdkdTUFAoSdQBPrVToNK6ULHo165Cbq7woB"],"serviceEndpoint":"https://mediator.animo.id/msg","routingKeys":[]},"theirDid":"PYYVEngpK4wsWM5aQuBQt5","theirDidDoc":{"@context":"https://w3id.org/did/v1","publicKey":[{"id":"PYYVEngpK4wsWM5aQuBQt5#1","controller":"PYYVEngpK4wsWM5aQuBQt5","type":"Ed25519VerificationKey2018","publicKeyBase58":"DHf1TwnRHQdkdTUFAoSdQBPrVToNK6ULHo165Cbq7woB"}],"service":[{"id":"PYYVEngpK4wsWM5aQuBQt5#did-communication","serviceEndpoint":"https://mediator.animo.id/msg","type":"did-communication","priority":1,"recipientKeys":["DHf1TwnRHQdkdTUFAoSdQBPrVToNK6ULHo165Cbq7woB"],"routingKeys":[]},{"id":"PYYVEngpK4wsWM5aQuBQt5#IndyAgentService","serviceEndpoint":"https://mediator.animo.id/msg","type":"IndyAgent","priority":0,"recipientKeys":["DHf1TwnRHQdkdTUFAoSdQBPrVToNK6ULHo165Cbq7woB"],"routingKeys":[]}],"authentication":[{"publicKey":"PYYVEngpK4wsWM5aQuBQt5#1","type":"Ed25519SignatureAuthentication2018"}],"id":"PYYVEngpK4wsWM5aQuBQt5"}}`

      const connection = JsonTransformer.deserialize(connectionString, ConnectionRecord)

      expect(connection.didDoc).toBeInstanceOf(DidDoc)
    })
  })
})
