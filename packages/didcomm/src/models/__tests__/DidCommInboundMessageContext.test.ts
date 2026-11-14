import { Kms, TypedArrayEncoder } from '@credo-ts/core'
import { getAgentContext, getMockConnection } from '../../../../core/tests/helpers'
import { DidCommTrustPingMessage } from '../../modules/connections/messages'
import { DidCommDidExchangeState } from '../../modules/connections/models'
import { DidCommInboundMessageContext } from '../DidCommInboundMessageContext'

describe('DidCommInboundMessageContext', () => {
  const agentContext = getAgentContext()
  const connection = getMockConnection({ state: DidCommDidExchangeState.Completed, theirDid: 'did:example:peer' })
  const message = new DidCommTrustPingMessage({})
  const senderKey = Kms.PublicJwk.fromPublicKey({
    kty: 'OKP',
    crv: 'Ed25519',
    publicKey: TypedArrayEncoder.fromBase58('8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'),
  }) as Kms.PublicJwk<Kms.Ed25519PublicJwk>

  describe('assertReadyConnection', () => {
    it('returns the connection when a v1 sender key authenticated the message', () => {
      const context = new DidCommInboundMessageContext(message, { agentContext, connection, senderKey })

      expect(context.assertReadyConnection()).toBe(connection)
    })

    it('returns the connection when a v2 sender DID authenticated the message', () => {
      const context = new DidCommInboundMessageContext(message, {
        agentContext,
        connection,
        senderDid: 'did:example:peer',
      })

      expect(context.assertReadyConnection()).toBe(connection)
    })

    it('rejects a plaintext message that has a connection but no authenticated sender', () => {
      const context = new DidCommInboundMessageContext(message, { agentContext, connection })

      expect(() => context.assertReadyConnection()).toThrow(/has no authenticated sender/)
    })

    it('returns the connection of a plaintext message when the handler allows an unauthenticated sender', () => {
      const context = new DidCommInboundMessageContext(message, { agentContext, connection })

      expect(context.assertReadyConnection({ allowUnauthenticatedSender: true })).toBe(connection)
    })

    it('rejects a message without a connection', () => {
      const context = new DidCommInboundMessageContext(message, { agentContext, senderKey })

      expect(() => context.assertReadyConnection()).toThrow(/No connection associated/)
    })

    it('rejects a connection that is not ready', () => {
      const context = new DidCommInboundMessageContext(message, {
        agentContext,
        connection: getMockConnection({ state: DidCommDidExchangeState.RequestSent }),
        senderKey,
      })

      expect(() => context.assertReadyConnection()).toThrow()
    })
  })
})
