import type { AgentContext } from '../../../../../agent'

import { getAgentContext } from '../../../../../../tests/helpers'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { DidJwk } from '../DidJwk'
import { JwkDidResolver } from '../JwkDidResolver'

import { p256DidJwkEyJjcnYi0iFixture } from './__fixtures__/p256DidJwkEyJjcnYi0i'

describe('DidResolver', () => {
  describe('JwkDidResolver', () => {
    let keyDidResolver: JwkDidResolver
    let agentContext: AgentContext

    beforeEach(() => {
      keyDidResolver = new JwkDidResolver()
      agentContext = getAgentContext()
    })

    it('should correctly resolve a did:jwk document', async () => {
      const fromDidSpy = vi.spyOn(DidJwk, 'fromDid')
      const result = await keyDidResolver.resolve(agentContext, p256DidJwkEyJjcnYi0iFixture.id)

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocument: p256DidJwkEyJjcnYi0iFixture,
        didDocumentMetadata: {},
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
      })
      expect(result.didDocument)
      expect(fromDidSpy).toHaveBeenCalledTimes(1)
      expect(fromDidSpy).toHaveBeenCalledWith(p256DidJwkEyJjcnYi0iFixture.id)
    })
  })
})
