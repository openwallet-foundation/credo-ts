import { JsonTransformer } from '../../../utils'
import { ConnectionInvitationMessage } from '../../connections'
import { DidCommV1Service } from '../../dids'
import { convertToNewInvitation, convertToOldInvitation } from '../helpers'
import { OutOfBandInvitation } from '../messages'

describe('convertToNewInvitation', () => {
  it('should convert a connection invitation with service to an out of band invitation', () => {
    const connectionInvitation = new ConnectionInvitationMessage({
      id: 'd88ff8fd-6c43-4683-969e-11a87a572cf2',
      imageUrl: 'https://my-image.com',
      label: 'a-label',
      recipientKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
      serviceEndpoint: 'https://my-agent.com',
      routingKeys: ['6fioC1zcDPyPEL19pXRS2E4iJ46zH7xP6uSgAaPdwDrx'],
    })

    const oobInvitation = convertToNewInvitation(connectionInvitation)

    expect(oobInvitation).toMatchObject({
      id: 'd88ff8fd-6c43-4683-969e-11a87a572cf2',
      imageUrl: 'https://my-image.com',
      label: 'a-label',
      services: [
        {
          id: '#inline',
          recipientKeys: ['did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'],
          routingKeys: ['did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL'],
          serviceEndpoint: 'https://my-agent.com',
        },
      ],
    })
  })

  it('should convert a connection invitation with public did to an out of band invitation', () => {
    const connectionInvitation = new ConnectionInvitationMessage({
      id: 'd88ff8fd-6c43-4683-969e-11a87a572cf2',
      imageUrl: 'https://my-image.com',
      label: 'a-label',
      did: 'did:sov:a-did',
    })

    const oobInvitation = convertToNewInvitation(connectionInvitation)

    expect(oobInvitation).toMatchObject({
      id: 'd88ff8fd-6c43-4683-969e-11a87a572cf2',
      imageUrl: 'https://my-image.com',
      label: 'a-label',
      services: ['did:sov:a-did'],
    })
  })

  it('throws an error when no did and serviceEndpoint/routingKeys are present in the connection invitation', () => {
    const connectionInvitation = JsonTransformer.fromJSON(
      {
        '@id': 'd88ff8fd-6c43-4683-969e-11a87a572cf2',
        '@type': 'https://didcomm.org/connections/1.0/invitation',
        label: 'a-label',
        imageUrl: 'https://my-image.com',
      },
      ConnectionInvitationMessage,
      { validate: true }
    )

    expect(() => convertToNewInvitation(connectionInvitation)).toThrowError(
      'Missing required serviceEndpoint, routingKeys and/or did fields in connection invitation'
    )
  })
})

describe('convertToOldInvitation', () => {
  it('should convert an out of band invitation with inline service to a connection invitation', () => {
    const oobInvitation = new OutOfBandInvitation({
      id: 'd88ff8fd-6c43-4683-969e-11a87a572cf2',
      imageUrl: 'https://my-image.com',
      label: 'a-label',
      services: [
        new DidCommV1Service({
          id: '#inline',
          recipientKeys: ['did:key:z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'],
          routingKeys: ['did:key:z6Mkk7yqnGF3YwTrLpqrW6PGsKci7dNqh1CjnvMbzrMerSeL'],
          serviceEndpoint: 'https://my-agent.com',
        }),
      ],
    })

    const connectionInvitation = convertToOldInvitation(oobInvitation)

    expect(connectionInvitation).toMatchObject({
      id: 'd88ff8fd-6c43-4683-969e-11a87a572cf2',
      imageUrl: 'https://my-image.com',
      label: 'a-label',
      recipientKeys: ['8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'],
      routingKeys: ['6fioC1zcDPyPEL19pXRS2E4iJ46zH7xP6uSgAaPdwDrx'],
      serviceEndpoint: 'https://my-agent.com',
    })
  })

  it('should convert an out of band invitation with did service to a connection invitation', () => {
    const oobInvitation = new OutOfBandInvitation({
      id: 'd88ff8fd-6c43-4683-969e-11a87a572cf2',
      imageUrl: 'https://my-image.com',
      label: 'a-label',
      services: ['did:sov:a-did'],
    })

    const connectionInvitation = convertToOldInvitation(oobInvitation)

    expect(connectionInvitation).toMatchObject({
      id: 'd88ff8fd-6c43-4683-969e-11a87a572cf2',
      imageUrl: 'https://my-image.com',
      label: 'a-label',
      did: 'did:sov:a-did',
    })
  })
})
