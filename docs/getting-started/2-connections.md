# Connections

> TODO
>
> - Creating a connection (as inviter or invitee)
> - Mention the need for a mediator (2-routing) if using in react native

If you want to start issuing and verifying credentials, you need a connection first. This connection can be created by the inviter or invitee.

When using React Native a mediator is required [3. Routing](3-routing.md).

### Creating an invitation

```ts
const { invitation, connectionRecord } = await agent.connections.createConnection({
  autoAcceptConnection: true,
  alias: 'inviter',
})
```

### Receiving an invitation

```ts
const { connectionRecord } = await agent.connections.receiveInvitation(invitation, {
  autoAcceptConnection: true,
  alias: 'invitee',
})
```
