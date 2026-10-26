import { JsonTransformer } from '@credo-ts/core'

import { DidCommMessageHandlerRegistry } from '../../../../../DidCommMessageHandlerRegistry'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import { DidCommProtocol } from '../../../../../models'
import { normalizeV2PlaintextToV1 } from '../../../../../v2/normalize'
import { buildV2PlaintextFromMessage } from '../../../../../v2/plaintextBuilder'
import type { DidCommDiscoverFeaturesV2Service } from '../DidCommDiscoverFeaturesV2Service'
import { DidCommFeaturesDisclosuresMessageHandler } from '../handlers'
import { DidCommFeaturesDisclosuresMessage } from '../messages'

describe('DidCommFeaturesDisclosuresMessage', () => {
  const features = [new DidCommProtocol({ id: 'https://didcomm.org/tictactoe/1.0', roles: ['player'] })]

  it('uses disclose as the message name over DIDComm v2', () => {
    const message = new DidCommFeaturesDisclosuresMessage({ threadId: 'thread-1', features })

    expect(buildV2PlaintextFromMessage(message)).toEqual({
      id: message.id,
      type: 'https://didcomm.org/discover-features/2.0/disclose',
      thid: 'thread-1',
      body: {
        disclosures: [{ 'feature-type': 'protocol', id: 'https://didcomm.org/tictactoe/1.0', roles: ['player'] }],
      },
    })
    expect(message.toJSON()['@type']).toBe('https://didcomm.org/discover-features/2.0/disclosures')
  })

  it('keeps the return_route header over DIDComm v2', () => {
    const message = new DidCommFeaturesDisclosuresMessage({ threadId: 'thread-1', features })
    message.setReturnRouting(ReturnRouteTypes.all)

    expect(buildV2PlaintextFromMessage(message).return_route).toBe('all')
  })

  it('accepts both disclose and disclosures on receive', () => {
    const registry = new DidCommMessageHandlerRegistry()
    registry.registerMessageHandler(
      new DidCommFeaturesDisclosuresMessageHandler({} as DidCommDiscoverFeaturesV2Service)
    )

    for (const type of [
      'https://didcomm.org/discover-features/2.0/disclose',
      'https://didcomm.org/discover-features/2.0/disclosures',
    ]) {
      const MessageClass = registry.getMessageClassForMessageType(type)
      expect(MessageClass).toBeDefined()
      const message = JsonTransformer.fromJSON(
        normalizeV2PlaintextToV1({
          id: 'disclose-msg-1',
          type,
          thid: 'thread-1',
          body: { disclosures: [{ 'feature-type': 'protocol', id: 'https://didcomm.org/tictactoe/1.0' }] },
        }),
        MessageClass as unknown as typeof DidCommFeaturesDisclosuresMessage
      )
      expect(message).toBeInstanceOf(DidCommFeaturesDisclosuresMessage)
      expect(message.disclosures[0].id).toBe('https://didcomm.org/tictactoe/1.0')
    }
  })
})
