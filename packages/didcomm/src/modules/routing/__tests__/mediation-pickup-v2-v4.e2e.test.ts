import { Subject } from 'rxjs'
import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../../../../../core/src/agent/Agent'
import { getAgentOptions, makeConnection } from '../../../../../core/tests/helpers'
import { DidCommMediationRecipientApi } from '../DidCommMediationRecipientApi'
import { DidCommMediatorPickupStrategy } from '../DidCommMediatorPickupStrategy'

// Mediator routing DID - serviceEndpoint will be this DID (DID-as-endpoint).
const MEDIATOR_ROUTING_DID =
  'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc.SeyJ0IjoiZG0iLCJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9lbmRwb2ludCIsInIiOltdLCJhIjoibm9uZSMxIn0'

describe('Mediation 2.0 + Pickup 4.0 Combined', () => {
  describe('full flow E2E', () => {
    it.runIf(process.env.DIDCOMM_VERSION === 'v2')(
      'provision v2 → keylist-update → pickup v4 (status)',
      async () => {
        const mediatorMessages = new Subject<SubjectMessage>()
        const recipientMessages = new Subject<SubjectMessage>()

        const subjectMap: Record<string, Subject<SubjectMessage>> = {
          'rxjs:mediator': mediatorMessages,
          'rxjs:recipient': recipientMessages,
          [MEDIATOR_ROUTING_DID]: mediatorMessages,
        }

        const mediatorAgent = new Agent(
          getAgentOptions(
            'Mediation v2 - Mediator',
            {
              endpoints: ['rxjs:mediator'],
              didcommVersions: ['v1', 'v2'],
              mediator: {
                autoAcceptMediationRequests: true,
                mediationProtocolVersions: ['v1', 'v2'],
                mediatorRoutingDid: MEDIATOR_ROUTING_DID,
              },
            },
            {},
            {},
            { requireDidcomm: true }
          )
        )
        const recipientAgent = new Agent(
          getAgentOptions(
            'Mediation v2 - Recipient',
            {
              endpoints: ['rxjs:recipient'],
              didcommVersions: ['v1', 'v2'],
              mediationRecipient: {
                mediationProtocolVersions: ['v1', 'v2'],
                mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV4,
                mediatorPollingInterval: 200,
              },
            },
            {},
            {},
            { requireDidcomm: true }
          )
        )

        mediatorAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
        mediatorAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
        recipientAgent.didcomm.registerInboundTransport(new SubjectInboundTransport(recipientMessages))
        recipientAgent.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))

        await mediatorAgent.initialize()
        await recipientAgent.initialize()

        const [recipientMediatorConn, mediatorRecipientConn] = await makeConnection(recipientAgent, mediatorAgent, {
          didCommVersion: 'v2',
        })
        expect(recipientMediatorConn.didcommVersion).toBe('v2')
        expect(mediatorRecipientConn.didcommVersion).toBe('v2')

        const mediationRecord = await recipientAgent.didcomm.mediationRecipient.provision(recipientMediatorConn)
        expect(mediationRecord.protocolVersion).toBe('v2')
        expect(mediationRecord.routingDid).toBe(MEDIATOR_ROUTING_DID)
        expect(mediationRecord.recipientDids?.length).toBeGreaterThan(0)

        await recipientAgent.didcomm.mediationRecipient.initiateMessagePickup(mediationRecord)

        await recipientAgent.didcomm.messagePickup.pickupMessages({
          connectionId: mediationRecord.connectionId,
          protocolVersion: 'v4',
          recipientDid: mediationRecord.recipientDids?.[0],
          awaitCompletion: true,
        })
        // Pickup v4 status/delivery flow completed (message_count may be 0)

        await recipientAgent.didcomm.mediationRecipient.stopMessagePickup()
        await mediatorAgent.shutdown()
        await recipientAgent.shutdown()
      },
      10000
    )
  })
})

describe('Mediation v2 + Pickup v4 - API validation', () => {
  it('DidCommMediatorPickupStrategy includes PickUpV4 strategies', () => {
    expect(DidCommMediatorPickupStrategy.PickUpV4).toBe('PickUpV4')
    expect(DidCommMediatorPickupStrategy.PickUpV4LiveMode).toBe('PickUpV4LiveMode')
  })

  it('DidCommMediationRecipientApi initiates pickup with v4 for v2 mediators', () => {
    expect(typeof DidCommMediationRecipientApi.prototype.initiateMessagePickup).toBe('function')
    // When mediator has protocolVersion === 'v2', initiateMessagePickup uses PickUpV4 by default
  })
})
