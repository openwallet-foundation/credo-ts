import type { DidCommMessageProcessedEvent, DidCommMessageSentEvent } from '@credo-ts/didcomm'
import type { AnonCredsTestsAgent } from '../packages/anoncreds/tests/anoncredsSetup'

import { filter, map } from 'rxjs'

import { issueAnonCredsCredential, presentAnonCredsProof } from '../packages/anoncreds/tests/anoncredsSetup'
import {
  anoncredsDefinitionFourAttributesNoRevocation,
  storePreCreatedAnonCredsDefinition,
} from '../packages/anoncreds/tests/preCreatedAnonCredsDefinition'
import { setupEventReplaySubjects } from '../packages/core/tests'
import { firstValueWithStackTrace, makeConnection } from '../packages/core/tests/helpers'

import {
  DidCommBatchMessage,
  DidCommBatchPickupMessage,
  DidCommCredentialEventTypes,
  DidCommCredentialState,
  DidCommCredentialV2Preview,
  DidCommDeliveryRequestV2Message,
  DidCommEventTypes,
  DidCommMediationState,
  DidCommMessageDeliveryV2Message,
  DidCommProofEventTypes,
  DidCommProofState,
} from '@credo-ts/didcomm'

export async function e2eTest({
  mediatorAgent,
  recipientAgent,
  senderAgent,
}: {
  mediatorAgent: AnonCredsTestsAgent
  recipientAgent: AnonCredsTestsAgent
  senderAgent: AnonCredsTestsAgent
}) {
  const [senderReplay, recipientReplay] = setupEventReplaySubjects(
    [senderAgent, recipientAgent, mediatorAgent],
    [
      DidCommCredentialEventTypes.DidCommCredentialStateChanged,
      DidCommProofEventTypes.ProofStateChanged,
      DidCommEventTypes.DidCommMessageProcessed,
      DidCommEventTypes.DidCommMessageSent,
    ]
  )

  // Make connection between mediator and recipient
  const [mediatorRecipientConnection, recipientMediatorConnection] = await makeConnection(mediatorAgent, recipientAgent)
  expect(recipientMediatorConnection).toBeConnectedWith(mediatorRecipientConnection)

  // Request mediation from mediator
  const mediationRecord =
    await recipientAgent.didcomm.mediationRecipient.requestAndAwaitGrant(recipientMediatorConnection)
  expect(mediationRecord.state).toBe(DidCommMediationState.Granted)

  // Set mediator as default for recipient, start picking up messages
  await recipientAgent.didcomm.mediationRecipient.setDefaultMediator(mediationRecord)
  await recipientAgent.didcomm.mediationRecipient.initiateMessagePickup(mediationRecord)
  const defaultMediator = await recipientAgent.didcomm.mediationRecipient.findDefaultMediator()
  expect(defaultMediator?.id).toBe(mediationRecord.id)

  // Make connection between sender and recipient
  const [recipientSenderConnection, senderRecipientConnection] = await makeConnection(recipientAgent, senderAgent)
  expect(recipientSenderConnection).toBeConnectedWith(senderRecipientConnection)

  const { credentialDefinitionId } = await storePreCreatedAnonCredsDefinition(
    senderAgent,
    anoncredsDefinitionFourAttributesNoRevocation
  )

  const { holderCredentialExchangeRecord, issuerCredentialExchangeRecord } = await issueAnonCredsCredential({
    issuerAgent: senderAgent,
    issuerReplay: senderReplay,
    holderAgent: recipientAgent,
    holderReplay: recipientReplay,
    revocationRegistryDefinitionId: null,

    issuerHolderConnectionId: senderRecipientConnection.id,
    offer: {
      credentialDefinitionId,
      attributes: DidCommCredentialV2Preview.fromRecord({
        name: 'John',
        age: '25',
        'x-ray': 'not taken',
        profile_picture: 'looking good',
      }).attributes,
    },
  })

  expect(holderCredentialExchangeRecord.state).toBe(DidCommCredentialState.Done)
  expect(issuerCredentialExchangeRecord.state).toBe(DidCommCredentialState.Done)

  // Present Proof from recipient to sender
  const { holderProofExchangeRecord, verifierProofExchangeRecord } = await presentAnonCredsProof({
    verifierAgent: senderAgent,
    verifierReplay: senderReplay,

    holderAgent: recipientAgent,
    holderReplay: recipientReplay,

    verifierHolderConnectionId: senderRecipientConnection.id,
    request: {
      attributes: {
        name: {
          name: 'name',
          restrictions: [
            {
              cred_def_id: credentialDefinitionId,
            },
          ],
        },
      },
      predicates: {
        olderThan21: {
          name: 'age',
          restrictions: [
            {
              cred_def_id: credentialDefinitionId,
            },
          ],
          p_type: '<=',
          p_value: 20000712,
        },
      },
    },
  })

  expect(holderProofExchangeRecord.state).toBe(DidCommProofState.Done)
  expect(verifierProofExchangeRecord.state).toBe(DidCommProofState.Done)

  // We want to stop the mediator polling before the agent is shutdown.
  await recipientAgent.didcomm.mediationRecipient.stopMessagePickup()

  const pickupRequestMessages = [
    DidCommDeliveryRequestV2Message.type.messageTypeUri,
    DidCommBatchPickupMessage.type.messageTypeUri,
  ]
  const deliveryMessages = [
    DidCommMessageDeliveryV2Message.type.messageTypeUri,
    DidCommBatchMessage.type.messageTypeUri,
  ]

  let lastSentPickupMessageThreadId: undefined | string = undefined
  recipientReplay
    .pipe(
      filter((e): e is DidCommMessageSentEvent => e.type === DidCommEventTypes.DidCommMessageSent),
      filter((e) => pickupRequestMessages.includes(e.payload.message.message.type)),
      map((e) => e.payload.message.message.threadId)
    )
    // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
    .subscribe((threadId) => (lastSentPickupMessageThreadId = threadId))

  // Wait for the response to the pickup message to be processed
  if (lastSentPickupMessageThreadId) {
    await firstValueWithStackTrace(
      recipientReplay.pipe(
        filter((e): e is DidCommMessageProcessedEvent => e.type === DidCommEventTypes.DidCommMessageProcessed),
        filter((e) => deliveryMessages.includes(e.payload.message.type)),
        filter((e) => e.payload.message.threadId === lastSentPickupMessageThreadId)
      )
    )
  }

  // FIXME: we should add some fancy logic here that checks whether the last sent message has been received by the other
  // agent and possibly wait for the response. So e.g. if pickup v1 is used, we wait for the delivery message to be returned
  // as that is the final message that will be exchange after we've called stopMessagePickup. We can hook into the
  // replay subject DidCommMessageProcessed and DidCommMessageSent events.
  // await sleep(5000)
}
