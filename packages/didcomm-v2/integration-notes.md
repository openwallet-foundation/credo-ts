## DIDComm V2 integration notes

This document contains the plan (what's done, questions, issues) of DIDComm V2 messaging integration into Aries Framework Javascript.

[DIDComm V2 Specification](https://identity.foundation/didcomm-messaging/spec/)

### Proof of work

**State:** Done

Update [Alice/Faber demo](../../demo/README.md) scripts.\
Faber can generate DidComm V2 based [Out-of-Band invitation](https://identity.foundation/didcomm-messaging/spec/#invitation)
Alice can accept it and `ping` Faber using DidComm V2 messaging.\

> Note: Issuance and Verification protocols are not adopted! So these options not working now.

### DidComm V2 as independent optional package

**State:** Done

- AFJ Core package contains:

  - Definitions for general DIDComm V1/V2 messages.
  - Service interfaces for DIDComm V1 / V2 massages encryption
  - DIDComm V1 encryption service implementation which is based on indy wallet.
  - For DIDComm V2 stub is registered into the dependency injection container. Agent initialization works fine without providing actual implementation. Error will be thrown if DidComm V2 methods are called and there has not been done registration of actual implementation for DidComm V2 encryption service.
  - Common `EnvelopeService` injecting DIDComm V1 / V2 services and used by message sender and receiver.

- `didcomm-v2` package:

  - DIDComm V2 encryption service implementation which is based on [Sicpa didcomm libraries](https://github.com/sicpa-dlab/didcomm-rust).
  - [Node](https://www.npmjs.com/package/didcomm-node) or [React Native](https://www.npmjs.com/package/@sicpa_open_source/didcomm-react-native) package must be passed into `DidCommV2Module` module constructor as parameter.
  - `didCommV2` modules should be passed into Agent constructor for proper registration in the dependency injection container.
  - Example of agent initialization:

    ```
    import * as didcomm from 'didcomm-node'

    const didCommV2Module = new DidCommV2Module({ didcomm })
    const modules = { didCommV2: didCommV2Module }

    const agent = new Agent({ config, modules, dependencies: agentDependencies })
    ```

### Private Keys out of Wallet issue

**State:** To discuss

`didcomm-v2` package requires resolving of private keys and passing their values into native didcomm libraries. Right now, there is no way to bypass this.

### Connections

**State:** Done simple option. Need to discuss

Right now, DIDComm V2 messaging specification does not provide any definition for DID Exchange protocol. There is only definition for single out-of-band message which should be used for sharing DIDs.
At the same time, all AFJ protocols (issuance, proofs, etc.) require existence of Connection state outOfBandRecord stored in the Wallet.

Currently, there is implemented straight forward option:

- Sender can create DidComm V2 specific out-of-band invitation
- Receiver can accept invitation - Connection state outOfBandRecord will be created in the `ready` state.

  > Note: Current Out-of-Band implementation is really trivial and limited. It should be evaluated in the future.

  ```
  // Inviter
  const outOfBandRecord = await this.agent.oob.createInvitation({ version: 'v2' })
  const invitationUrl = outOfBandRecord.v2OutOfBandInvitation.toUrl({ domain: `http://localhost:${this.port}` })

  // Receiver
  const { connectionRecord } = await this.agent.oob.receiveInvitationFromUrl(invitationUrl)
  // connectionRecord.isReady === true
  ```

- Note: So that connection will be created only on one side! Inviter still will not be able to trigger protocols. But still will be able to reply on incoming messages.

We need to discuss whether this approach is acceptable and provide better design on how to make connections if it is not.

### Mediator

**State:** There is independent [open sourced implementation of Cloud Mediator agent supporting DidComm V2 protocols](https://github.com/sicpa-dlab/didcomm-v2-mediator-ts).

AFJ core modules related to Mediator functionality have not been updated to provide mediation for DidComm V2 edge agents.
This work should be done during the next steps.

### Mediation Recipient

**State:** Completed initial implementation

[Repository](https://github.com/decentralized-identity/didcomm.org/tree/main/site/content/protocols) contacting protocols specifications.

This repository contains protocols adoptions for DidComm V2 messaging:

- [Mediator Coordination](https://github.com/decentralized-identity/didcomm.org/tree/main/site/content/protocols/mediator-coordination/2.0)
- [Pickup](https://github.com/decentralized-identity/didcomm.org/tree/main/site/content/protocols/pickup/3.0)
- [Routing](https://github.com/decentralized-identity/didcomm.org/tree/main/site/content/protocols/routing/2.0)

The work devoted to the adoption of these protocols already has been done in the separate [didcommv2-contribution-routing](https://github.com/sicpa-dlab/aries-framework-javascript/tree/didcommv2-contribution-routing) branch.
This branch has been created from the main `didcommv2-contribution` branch but got significantly behind and need to be updated.

We need to merge general DidComm V2 MR firstly. After that we will actualize the branch with routing support.

### Peer DID package

**State:** There is [peer-did-ts](https://www.npmjs.com/package/@sicpa_open_source/peer-did-ts) package providing implementation of the Peer DID method specification in Typescript. The source code for this package has been mainly taken from AFJ Core package and probably should be reworked.

It will be good to extract sup-packages providing TypeScript implementations for `DidDocument` and `PeerDid` from AFJ Core.

> Should be postponed and done later in a separate PR

### Peer DID format

**State:** Need to discuss

There is a contradiction between the two specifications:

- According to the [Peer DID spec](https://identity.foundation/peer-did-method-spec/#multi-key-creation) key ids doesn't have `z` prefix in `did-url` (fragment after #).
- According to the [DIDComm spec](https://identity.foundation/didcomm-messaging/spec/#:~:text=%22id%22%3A%20%22did%3Aexample%3A123%23zC9ByQ8aJs8vrNXyDhPHHNNMSHPcaSgNpjjsBYpMMjsTdS%22%2C) key ids must have `z` prefix in `did-url` (fragment after #).

In our understanding, `z` prefix should always be used for multi-base key representation which is currently used there.\
Sicpa `didcomm-rust` library requests keys from the Wallet by id containing additional `z` letter at the start of the did-url.
If we consider this behaviour wrong, we will need to change `didcomm-rust` libraries.

> Should be postponed if possible and changed later in a separate PR if current behaviour is wrong

### Protocols adoptions

**State:** To be done

- [Trust Ping](https://identity.foundation/didcomm-messaging/spec/#trust-ping-protocol-20) protocol.
  - For the DidComm V2 testing and demonstration purpose was added public `sendPing` function to Connection API. Right now, this ping function does not depend on the Connection state outOfBandRecord and requires the passing of sender and receiver DIDs to send DidComm V2-based ping message.

> Should be postponed and done later in a separate PR

### Rework Message Sender / Receiver

**State:** To discuss.

Right now seems sensible to split Message Sender classes into two subclasses providing functionality for processing of corresponding DidComm message version (V1/V2).
So instead of having sendV1/sendV2 functions there will be call send method of the corresponding subclass.
BUT: right now we do not have full integration of Connection state objects for DidComm V2 protocols. This is one of main cause of adding new `sendV2` methods. In future this issue may go away once we get Connections for DidComm V2.
So it looks lite this kind of refactoring should be postponed.

Regarding Message Receiver, there is no actually many specific v1/v2 methods.

> Should be postponed and done later in a separate PR

### Envelop unpack result

**State:** To discuss - related to the [comment](https://github.com/hyperledger/aries-framework-javascript/pull/1096#discussion_r1023938917)

The `DecryptedMessageContext` object returning as result of message unpacking contains keys while for DidComm V2 messaging it rather should be DIDs. For the current implementation we adopted V2 unpack function to return keys as well but in the future we probably need to revise this structure.

> Should be postponed and done later in a separate PR
