import type { AgentContext } from '@credo-ts/core'

import { WebVhDidCryptoSigner } from '../WebVhDidCryptoSigner'

describe('WebVhDidCryptoSigner', () => {
  const publicKeyMultibase = 'z6MkkkjG6shmZk6D2ghgDbpJQHD4xvpZhzYiWSLKDeznibiJ'
  const agentContext = {} as AgentContext

  describe('getVerificationMethodId', () => {
    it('should return a verification method url rather than a bare did', () => {
      const signer = new WebVhDidCryptoSigner(agentContext, publicKeyMultibase, 'key-id')

      expect(signer.getVerificationMethodId()).toBe(`did:key:${publicKeyMultibase}#${publicKeyMultibase}`)
    })
  })
})
