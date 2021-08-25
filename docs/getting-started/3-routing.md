# Routing

> TODO
> - add configuration options docs for mediation and message pickup strategy.

Mediation behavior is managed by agent configuration. In the configuration you can provide a connection invite to a mediator which will cause AFJ to automatically establish a connection with the mediator and request mediation and set that mediation as the default mediator. In the configuration you can also set or clear the default mediator and choose the message pickup strategy 'explicit' or 'implicit'. After establishing a connection with a mediator also having mediation granted, you can use that mediator id for future did_comm connections. When creating, receiving or accepting a invitation intended to be Mediated, you provide `mediation_id` with the desired mediator id. if using a single mediator for all future connections, You can set a default mediation id. If no mediation_id is provided the default mediation id will be used instead. When the default mediator is set every new connection will use that mediator endpoint and routing key, this is accomplished by having the recipient agent sending a keylist update message every time a new "did" key pair is created.

## Recipient (client)
### Request Mediation from mediator

```ts
const mediationRecord = await recipientAgent.mediationRecipient.requestAndAwaitGrant(recipientMediatorConnection)
```

### Setting default mediator, start message pickup

```ts
await recipientAgent.mediationRecipient.setDefaultMediator(mediationRecord)
await recipientAgent.mediationRecipient.initiateMessagePickup(mediationRecord)
```

## mediator (server)
### Grant 

```ts
await recipientAgent.mediator.grantRequestedMediation(mediationRecordId)
```

### Queue message

```ts
await recipientAgent.mediator.queueMessage(connectionId,  message)
```

## Concepts
* **DIDComm Message Forwarding** - Sending an encrypted message to its recipient by first sending it to a third party responsible for forwarding the message on. Message contents are encrypted once for the recipient then wrapped in a [forward message](https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0094-cross-domain-messaging/README.md#corerouting10forward) encrypted to the third party.
* **Mediator** - An agent that forwards messages to a client over a DIDComm connection.
* **Mediated Agent** or **Mediation client** - The agent(s) to which a mediator is willing to forward messages.
* **Mediation Request** - A message from a client to a mediator requesting mediation or forwarding.
* **Keylist** - The list of public keys used by the mediator to lookup to which connection a forward message should be sent. Each mediated agent is responsible for maintaining the keylist with the mediator.
* **Keylist Update** - A message from a client to a mediator informing the mediator of changes to the keylist.
* **Default Mediator** - A mediator to be used with with every newly created DIDComm connection. 
* **Mediation Connection** - Connection between the mediator and the mediated agent or client. Agents can use as many mediators as the identity owner sees fit. Requests for mediation are handled on a per connection basis.
* See [Aries RFC 0211: Coordinate Mediation Protocol](https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md) for additional details on message attributes and more.

## DIDComm Messages

See [Aries RFC 0211: Coordinate Mediation Protocol](https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md).

## Mediator Message Flow Overview

![Mediator Message Flow](/docs/images/mediation-message-flow.png)