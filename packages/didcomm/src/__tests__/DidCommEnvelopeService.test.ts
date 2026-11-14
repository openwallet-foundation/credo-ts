import { DidKey, Kms } from '@credo-ts/core'
import { Agent } from '../../../core/src/agent/Agent'
import { getAgentOptions } from '../../../core/tests/helpers'
import { DidCommEnvelopeService } from '../DidCommEnvelopeService'
import { DidCommModuleConfig } from '../DidCommModuleConfig'
import { DidCommTrustPingMessage } from '../modules/connections/messages'

describe('DidCommEnvelopeService', () => {
  // A low cap keeps the tests cheap; the default is covered separately
  const maxRecipients = 3
  const agent = new Agent(
    getAgentOptions('DidCommEnvelopeService', { maxV1EnvelopeRecipients: maxRecipients }, {}, undefined, {
      requireDidcomm: true,
    })
  )
  // Keys of another agent, which this agent resolves through every lookup before giving up
  const otherAgent = new Agent(
    getAgentOptions('DidCommEnvelopeServiceOther', {}, {}, undefined, { requireDidcomm: true })
  )
  let envelopeService: DidCommEnvelopeService
  let ourKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>

  const createOtherKeys = async (count: number) => {
    const kms = otherAgent.context.resolve(Kms.KeyManagementApi)
    const keys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[] = []
    for (let i = 0; i < count; i++) {
      const { publicJwk } = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      keys.push(Kms.PublicJwk.fromPublicJwk(publicJwk) as Kms.PublicJwk<Kms.Ed25519PublicJwk>)
    }
    return keys
  }

  const packTo = (recipientKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]) =>
    envelopeService.packMessage(agent.context, new DidCommTrustPingMessage({}), {
      recipientKeys,
      routingKeys: [],
      senderKey: null,
    })

  beforeAll(async () => {
    await agent.initialize()
    await otherAgent.initialize()
    envelopeService = agent.dependencyManager.resolve(DidCommEnvelopeService)

    // The inline service key of an invitation we created is one the agent can resolve from a recipient kid
    const { outOfBandInvitation } = await agent.didcomm.oob.createInvitation()
    const [service] = outOfBandInvitation.getInlineServices()
    ourKey = DidKey.fromDid(service.recipientKeys[0]).publicJwk as Kms.PublicJwk<Kms.Ed25519PublicJwk>
  })

  afterAll(async () => {
    await agent.shutdown()
    await otherAgent.shutdown()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('unpackMessage', () => {
    it('decrypts a message when our key is not the last recipient', async () => {
      const [otherKey] = await createOtherKeys(1)
      const encrypted = await packTo([otherKey, ourKey])

      const { plaintextMessage, recipientKey } = await envelopeService.unpackMessage(agent.context, encrypted)

      expect(plaintextMessage['@type']).toBe(DidCommTrustPingMessage.type.messageTypeUri)
      expect(recipientKey.equals(ourKey)).toBe(true)
    })

    it('stops resolving recipients at the first key of ours', async () => {
      const otherKeys = await createOtherKeys(2)
      const encrypted = await packTo([ourKey, ...otherKeys])
      const resolve = vi.spyOn(
        envelopeService as unknown as { extractOurRecipientKeyWithKeyId: () => unknown },
        'extractOurRecipientKeyWithKeyId'
      )

      await envelopeService.unpackMessage(agent.context, encrypted)

      expect(resolve).toHaveBeenCalledTimes(1)
    })

    it('rejects a message with more recipients than the configured maximum before resolving any of them', async () => {
      const encrypted = await packTo(await createOtherKeys(maxRecipients + 1))
      const resolve = vi.spyOn(
        envelopeService as unknown as { extractOurRecipientKeyWithKeyId: () => unknown },
        'extractOurRecipientKeyWithKeyId'
      )

      await expect(envelopeService.unpackMessage(agent.context, encrypted)).rejects.toThrow(
        `has ${maxRecipients + 1} recipients, the maximum is ${maxRecipients}`
      )
      expect(resolve).not.toHaveBeenCalled()
    })

    it('accepts a message with the maximum number of recipients', async () => {
      const encrypted = await packTo([...(await createOtherKeys(maxRecipients - 1)), ourKey])

      const { plaintextMessage } = await envelopeService.unpackMessage(agent.context, encrypted)

      expect(plaintextMessage['@type']).toBe(DidCommTrustPingMessage.type.messageTypeUri)
    })

    it('allows 8 recipients by default', () => {
      expect(new DidCommModuleConfig().maxV1EnvelopeRecipients).toBe(8)
    })
  })
})
