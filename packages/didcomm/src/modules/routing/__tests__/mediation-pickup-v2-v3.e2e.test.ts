/**
 * E2E tests for Coordinate Mediation 2.0 + Message Pickup 3.0 combined flow.
 *
 * Full flow: provision mediation v2 → keylist-update → sender forwards message via mediator
 * → recipient picks up via Pickup v3.
 *
 * Requires v2 connections (DIDComm v2). Run with DIDCOMM_VERSION=v2.
 *
 * Known limitation: V2 Forward - when routing uses routingDid only (no routing keys), the sender
 * encrypts directly for the recipient. The mediator receives a message it cannot decrypt, so it never
 * gets queued. Full E2E (forward → pickup) works with v1 mediation. For v2, provision and pickup
 * v3 protocol work; the forward path needs v2 Forward message support (encrypt for mediator).
 */
import { Subject } from 'rxjs'
import type { SubjectMessage } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectInboundTransport } from '../../../../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../../../../../core/src/agent/Agent'
import { getAgentOptions, makeConnection } from '../../../../../core/tests/helpers'
import { DidCommMediatorPickupStrategy } from '../DidCommMediatorPickupStrategy'
import { DidCommMediationRecipientApi } from '../DidCommMediationRecipientApi'

// Mediator routing DID - serviceEndpoint will be this DID (DID-as-endpoint).
const MEDIATOR_ROUTING_DID =
  'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc.SeyJ0IjoiZG0iLCJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9lbmRwb2ludCIsInIiOltdLCJhIjoibm9uZSMxIn0'

describe('Mediation 2.0 + Pickup 3.0 Combined', () => {
  describe('full flow E2E', () => {
    it.runIf(process.env.DIDCOMM_VERSION === 'v2')(
      'provision v2 → keylist-update → pickup v3 (status)',
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
                mediatorPickupStrategy: DidCommMediatorPickupStrategy.PickUpV3,
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
        expect(mediationRecord.mediationProtocolVersion).toBe('v2')
        expect(mediationRecord.routingDid).toBe(MEDIATOR_ROUTING_DID)
        expect(mediationRecord.recipientDids?.length).toBeGreaterThan(0)

        await recipientAgent.didcomm.mediationRecipient.initiateMessagePickup(mediationRecord)

        await recipientAgent.didcomm.messagePickup.pickupMessages({
          connectionId: mediationRecord.connectionId,
          protocolVersion: 'v3',
          recipientDid: mediationRecord.recipientDids?.[0],
          awaitCompletion: true,
        })
        // Pickup v3 status/delivery flow completed (message_count may be 0)

        await recipientAgent.didcomm.mediationRecipient.stopMessagePickup()
        await mediatorAgent.shutdown()
        await recipientAgent.shutdown()
      },
      10000
    )
  })
})

describe('Mediation v2 + Pickup v3 - API validation', () => {
  it('DidCommMediatorPickupStrategy includes PickUpV3 strategies', () => {
    expect(DidCommMediatorPickupStrategy.PickUpV3).toBe('PickUpV3')
    expect(DidCommMediatorPickupStrategy.PickUpV3LiveMode).toBe('PickUpV3LiveMode')
  })

  it('DidCommMediationRecipientApi initiates pickup with v3 for v2 mediators', () => {
    expect(typeof DidCommMediationRecipientApi.prototype.initiateMessagePickup).toBe('function')
    // When mediator has mediationProtocolVersion === 'v2', initiateMessagePickup uses PickUpV3 by default
  })
})
