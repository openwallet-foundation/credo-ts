import type { Agent } from '@aries-framework/core'

import { issueCredential, makeConnection, prepareForIssuance, presentProof } from '../packages/core/tests/helpers'

import {
  CredentialPreview,
  AttributeFilter,
  CredentialState,
  MediationState,
  PredicateType,
  ProofAttributeInfo,
  ProofPredicateInfo,
  ProofState,
} from '@aries-framework/core'

export async function e2eTest({
  mediatorAgent,
  recipientAgent,
  senderAgent,
}: {
  mediatorAgent: Agent
  recipientAgent: Agent
  senderAgent: Agent
}) {
  // Make connection between mediator and recipient
  const [mediatorRecipientConnection, recipientMediatorConnection] = await makeConnection(mediatorAgent, recipientAgent)
  expect(recipientMediatorConnection).toBeConnectedWith(mediatorRecipientConnection)

  // Request mediation from mediator
  const mediationRecord = await recipientAgent.mediationRecipient.requestAndAwaitGrant(
    mediatorAgent.publicDid?.did || '',
    ''
  )
  expect(mediationRecord.state).toBe(MediationState.Granted)

  // Set mediator as default for recipient, start picking up messages
  await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
  await recipientAgent.mediationRecipient.initiateMessagePickup(mediationRecord)
  const defaultMediator = await recipientAgent.mediationRecipient.findDefaultMediator()
  expect(defaultMediator?.id).toBe(mediationRecord.id)

  // Make connection between sender and recipient
  const [recipientSenderConnection, senderRecipientConnection] = await makeConnection(recipientAgent, senderAgent)
  expect(recipientSenderConnection).toBeConnectedWith(senderRecipientConnection)

  // Issue credential from sender to recipient
  const { definition } = await prepareForIssuance(senderAgent, ['name', 'age', 'dateOfBirth'])
  const { holderCredential, issuerCredential } = await issueCredential({
    issuerAgent: senderAgent,
    holderAgent: recipientAgent,
    issuerConnectionId: senderRecipientConnection.id,
    credentialTemplate: {
      credentialDefinitionId: definition.id,
      preview: CredentialPreview.fromRecord({
        name: 'John',
        age: '25',
        // year month day
        dateOfBirth: '19950725',
      }),
    },
  })

  expect(holderCredential.state).toBe(CredentialState.Done)
  expect(issuerCredential.state).toBe(CredentialState.Done)

  // Present Proof from recipient to sender
  const definitionRestriction = [
    new AttributeFilter({
      credentialDefinitionId: definition.id,
    }),
  ]
  const { holderProof, verifierProof } = await presentProof({
    verifierAgent: senderAgent,
    holderAgent: recipientAgent,
    verifierConnectionId: senderRecipientConnection.id,
    presentationTemplate: {
      attributes: {
        name: new ProofAttributeInfo({
          name: 'name',
          restrictions: definitionRestriction,
        }),
      },
      predicates: {
        olderThan21: new ProofPredicateInfo({
          name: 'age',
          restrictions: definitionRestriction,
          predicateType: PredicateType.LessThan,
          predicateValue: 20000712,
        }),
      },
    },
  })

  expect(holderProof.state).toBe(ProofState.Done)
  expect(verifierProof.state).toBe(ProofState.Done)
}
