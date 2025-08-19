import { JsonTransformer } from '../../../../../utils'
import didExample123DidcommV2 from '../../../__tests__/__fixtures__/didExample123DidcommV2Service.json'
import { DidDocument } from '../../DidDocument'
import { DidCommV2Service } from '../DidCommV2Service'
import { LegacyDidCommV2Service } from '../LegacyDidCommV2Service'

describe('Did | DidDocument | DidCommV2Service', () => {
  it('should correctly transforms Json to DidDocument class with didcomm v2 service', () => {
    const didDocument = JsonTransformer.fromJSON(didExample123DidcommV2, DidDocument)

    expect(didDocument.service?.[0]).toBeInstanceOf(DidCommV2Service)
    expect(didDocument.service?.[1]).toBeInstanceOf(LegacyDidCommV2Service)

    const didcommV2Service = didDocument.service?.[0] as DidCommV2Service
    const legacyDidcommV2Service = didDocument.service?.[1] as LegacyDidCommV2Service
    const didcommV2ServiceArray = didDocument.service?.[2] as DidCommV2Service

    expect(didcommV2Service).toEqual({
      id: 'did:example:123#service-1',
      type: 'DIDCommMessaging',
      serviceEndpoint: {
        uri: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
        routingKeys: ['Q4zqM7aXqm7gDQkUVLng9h'],
      },
    })

    expect(legacyDidcommV2Service).toEqual({
      id: 'did:example:123#service-2',
      type: 'DIDComm',
      serviceEndpoint: 'https://agent.com/did-comm',
      routingKeys: ['DADEajsDSaksLng9h'],
    })

    expect(didcommV2ServiceArray).toEqual({
      id: 'did:example:123#service-3',
      type: 'DIDCommMessaging',
      serviceEndpoint: [
        {
          uri: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
          routingKeys: ['Q4zqM7aXqm7gDQkUVLng9h'],
        },
      ],
    })

    expect(legacyDidcommV2Service.toNewDidCommV2()).toEqual({
      id: 'did:example:123#service-2',
      type: 'DIDCommMessaging',
      serviceEndpoint: {
        uri: 'https://agent.com/did-comm',
        routingKeys: ['DADEajsDSaksLng9h'],
      },
    })
  })
})
