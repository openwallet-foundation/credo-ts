# Proofs

As mentioned in the previous documentation ([Credentials](5-credentials.md)), after receiving a credential and saving it to your wallet, you will need to show it to a verifier who will verify the authenticity of this credential and that the credential assertions are not tampered with.

In VC proofs, we have two involved parties:

- Holder (prover)
- Verifier

The process for proving your VC starts by a verifier to request a presentation from a prover, and for the prover to respond by presenting a proof to the verifier or the prover to send a presentation proposal to the verifier.

## Method 1 - Prover (holder) responds to presentation proposal from the verifier

> Note: This setup is assumed for a react native mobile agent

> Note: This process assumes there is an established connection between the prover and the verifier

### 1. Configure agent

Please make sure you reviewed the [agent setup overview](0-agent.md).

### 2. Configure proof events handler

This handler will be triggered whenever there is a Proof state change.

```ts
const handleProofStateChange = async (agent: Agent, event: ProofStateChangedEvent) => {
  console.log(
    `>> Proof state changed: ${event.payload.proofRecord.id}, previous state -> ${event.payload.previousState} new state: ${event.payload.proofRecord.state}`
  )

  if (event.payload.proofRecord.state === ProofState.RequestReceived) {
    const retrievedCredentials = await agent.proofs.getRequestedCredentialsForProofRequest(
      event.payload.proofRecord.id,
      {
        filterByPresentationPreview: true,
      }
    )

    const requestedCredentials = agent.proofs.autoSelectCredentialsForProofRequest(retrievedCredentials)

    agent.proofs.acceptRequest(event.payload.proofRecord.id, requestedCredentials)
  }
}
```

- `filterByPresentationPreview`: Whether to filter the retrieved credentials using the presentation preview. This configuration will only have effect if a presentation proposal message is available containing a presentation preview..

Make sure to add the event listener to the agent after initializing the wallet

```ts
agent.events.on<ProofStateChangedEvent>(ProofEventTypes.ProofStateChanged, (event) => {
  handleProofStateChange(event)
})
```

To interfere the process and display an optional message to the user

replace

```ts
agent.proofs.acceptRequest(event.payload.proofRecord.id, requestedCredentials)
```

by

```ts
Alert.alert('Attention!', message, [
  {
    text: 'Accept',
    onPress: () => {
      //Respond by
      agent.proofs.acceptRequest(event.payload.proofRecord.id, requestedCredentials)
    },
  },
  {
    text: 'Reject',
    onPress: () => {
      console.log('User rejected offer')
    },
  },
])
```

To loop through requested attributes and display some context to the user

```ts
const proofRequest = event.payload.proofRecord.requestMessage?.indyProofRequest
var message = '>> Proof Request Recieved <<\n'
message += `To prove:${proofRequest?.name}\n`
message += 'Attributes to prove:\n'

Object.values(proofRequest.requestedAttributes).forEach((attr) => {
  message += `${attr.name}\n`
})

message += `Accept proof request?`
```

By sending the response to the verifier, the verifier will go through the process of verifying the VC and respond with an ack message.
To give some context to the user you can add the following code to the Proof event handler

```ts
const handleProofStateChange = async (agent: Agent, event: ProofStateChangedEvent) => {
    ...
    if (
      event.payload.previousState === ProofState.PresentationSent &&
      event.payload.proofRecord.state === ProofState.Done
    ) {
      console.log('Done proving credentials');
      Alert.alert('Credential Proved!');
      return;
    }
    ....
  };
```

## Method 2 - Prover sends a presentation proposal to verifier

> To do

## Connectionless Proof Request

> To do

## References

- [Verifiable credentials model](https://www.w3.org/TR/vc-data-model/).
- [Present Proof Protocol 1.0](https://github.com/hyperledger/aries-rfcs/blob/main/features/0037-present-proof/README.md).
- [Present Proof Protocol 2.0](https://github.com/hyperledger/aries-rfcs/blob/main/features/0454-present-proof-v2/README.md).
