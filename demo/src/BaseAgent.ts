import type {
  DidProps,
  InboundTransport,
  InitConfig,
  OutboundTransport,
  ValueTransferConfig,
} from '@aries-framework/core'
import {
  Agent,
  AutoAcceptCredential,
  AutoAcceptProof,
  HttpOutboundTransport,
  MediatorDeliveryStrategy,
  MediatorPickupStrategy,
  Transports,
  WsOutboundTransport,
} from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'

import { greenText } from './OutputClass'
import { FileInboundTransport } from './transports/FileInboundTransport'
import { FileOutboundTransport } from './transports/FileOutboundTransport'

const bcovrin = `{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node1","blskey":"4N8aUNHSgjQVgkpm8nhNEfDf6txHznoYREg9kirmJrkivgL4oSEimFF6nsQ6M41QvhM2Z33nves5vfSn9n1UwNFJBYtWVnHYMATn76vLuL3zU88KyeAYcHfsih3He6UHcXDxcaecHVz6jhCYz1P2UZn2bDVruL5wXpehgBfBaLKm3Ba","blskey_pop":"RahHYiCvoNCtPTrVtP7nMC5eTYrsUA8WjXbdhNc8debh1agE9bGiJxWBXYNFbnJXoXhWFMvyqhqhRoq737YQemH5ik9oL7R4NTTCz2LEZhkgLJzB3QRQqJyBNyv7acbdHrAT8nQ9UkLbaVL9NBpnWXBTw4LEMePaSHEw66RzPNdAX1","client_ip":"138.197.138.255","client_port":9702,"node_ip":"138.197.138.255","node_port":9701,"services":["VALIDATOR"]},"dest":"Gw6pDLhcBcoQesN72qfotTgFa7cbuqZpkX3Xo6pLhPhv"},"metadata":{"from":"Th7MpTaRZVRYnPiabds81Y"},"type":"0"},"txnMetadata":{"seqNo":1,"txnId":"fea82e10e894419fe2bea7d96296a6d46f50f93f9eeda954ec461b2ed2950b62"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node2","blskey":"37rAPpXVoxzKhz7d9gkUe52XuXryuLXoM6P6LbWDB7LSbG62Lsb33sfG7zqS8TK1MXwuCHj1FKNzVpsnafmqLG1vXN88rt38mNFs9TENzm4QHdBzsvCuoBnPH7rpYYDo9DZNJePaDvRvqJKByCabubJz3XXKbEeshzpz4Ma5QYpJqjk","blskey_pop":"Qr658mWZ2YC8JXGXwMDQTzuZCWF7NK9EwxphGmcBvCh6ybUuLxbG65nsX4JvD4SPNtkJ2w9ug1yLTj6fgmuDg41TgECXjLCij3RMsV8CwewBVgVN67wsA45DFWvqvLtu4rjNnE9JbdFTc1Z4WCPA3Xan44K1HoHAq9EVeaRYs8zoF5","client_ip":"138.197.138.255","client_port":9704,"node_ip":"138.197.138.255","node_port":9703,"services":["VALIDATOR"]},"dest":"8ECVSk179mjsjKRLWiQtssMLgp6EPhWXtaYyStWPSGAb"},"metadata":{"from":"EbP4aYNeTHL6q385GuVpRV"},"type":"0"},"txnMetadata":{"seqNo":2,"txnId":"1ac8aece2a18ced660fef8694b61aac3af08ba875ce3026a160acbc3a3af35fc"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node3","blskey":"3WFpdbg7C5cnLYZwFZevJqhubkFALBfCBBok15GdrKMUhUjGsk3jV6QKj6MZgEubF7oqCafxNdkm7eswgA4sdKTRc82tLGzZBd6vNqU8dupzup6uYUf32KTHTPQbuUM8Yk4QFXjEf2Usu2TJcNkdgpyeUSX42u5LqdDDpNSWUK5deC5","blskey_pop":"QwDeb2CkNSx6r8QC8vGQK3GRv7Yndn84TGNijX8YXHPiagXajyfTjoR87rXUu4G4QLk2cF8NNyqWiYMus1623dELWwx57rLCFqGh7N4ZRbGDRP4fnVcaKg1BcUxQ866Ven4gw8y4N56S5HzxXNBZtLYmhGHvDtk6PFkFwCvxYrNYjh","client_ip":"138.197.138.255","client_port":9706,"node_ip":"138.197.138.255","node_port":9705,"services":["VALIDATOR"]},"dest":"DKVxG2fXXTU8yT5N7hGEbXB3dfdAnYv1JczDUHpmDxya"},"metadata":{"from":"4cU41vWW82ArfxJxHkzXPG"},"type":"0"},"txnMetadata":{"seqNo":3,"txnId":"7e9f355dffa78ed24668f0e0e369fd8c224076571c51e2ea8be5f26479edebe4"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node4","blskey":"2zN3bHM1m4rLz54MJHYSwvqzPchYp8jkHswveCLAEJVcX6Mm1wHQD1SkPYMzUDTZvWvhuE6VNAkK3KxVeEmsanSmvjVkReDeBEMxeDaayjcZjFGPydyey1qxBHmTvAnBKoPydvuTAqx5f7YNNRAdeLmUi99gERUU7TD8KfAa6MpQ9bw","blskey_pop":"RPLagxaR5xdimFzwmzYnz4ZhWtYQEj8iR5ZU53T2gitPCyCHQneUn2Huc4oeLd2B2HzkGnjAff4hWTJT6C7qHYB1Mv2wU5iHHGFWkhnTX9WsEAbunJCV2qcaXScKj4tTfvdDKfLiVuU2av6hbsMztirRze7LvYBkRHV3tGwyCptsrP","client_ip":"138.197.138.255","client_port":9708,"node_ip":"138.197.138.255","node_port":9707,"services":["VALIDATOR"]},"dest":"4PS3EDQ3dW1tci1Bp6543CfuuebjFrg36kLAUcskGfaA"},"metadata":{"from":"TWwCRQRZ2ZHMJFn9TzLp7W"},"type":"0"},"txnMetadata":{"seqNo":4,"txnId":"aa5e817d7cc626170eca175822029339a444eb0ee8f0bd20d3b0b76e566fb008"},"ver":"1"}`

export class BaseAgent {
  public static defaultMediatorConnectionInvite =
    'http://localhost:3000/api/v1?oob=eyJ0eXAiOiJhcHBsaWNhdGlvbi9kaWRjb21tLXBsYWluK2pzb24iLCJpZCI6Ijg0NmI0OGYxLTZkZDItNDM3NS04MTI3LTY0OTEyZTM0MDNjMyIsImZyb20iOiJkaWQ6cGVlcjoyLkV6NkxTbkhTOWYzaHJNdUxyTjl6NlpobzdUY0JSdlN5SzdIUGpRdHdLbXUzb3NXd0YuVno2TWtyYWhBb1ZMUVM5UzVHRjVzVUt0dWRYTWVkVVNaZGRlSmhqSHRBRmFWNGhvVi5TVzNzaWN5STZJbWgwZEhBNkx5OXNiMk5oYkdodmMzUTZNekF3TUM5aGNHa3ZkakVpTENKMElqb2laRzBpTENKeUlqcGJYU3dpWVNJNld5SmthV1JqYjIxdEwzWXlJbDE5TEhzaWN5STZJbmR6T2k4dmJHOWpZV3hvYjNOME9qTXdNREF2WVhCcEwzWXhJaXdpZENJNkltUnRJaXdpY2lJNlcxMHNJbUVpT2xzaVpHbGtZMjl0YlM5Mk1pSmRmVjAiLCJib2R5Ijp7ImdvYWxfY29kZSI6Im1lZGlhdG9yLXByb3Zpc2lvbiJ9LCJ0eXBlIjoiaHR0cHM6Ly9kaWRjb21tLm9yZy9vdXQtb2YtYmFuZC8yLjAvaW52aXRhdGlvbiIsImFsZyI6IkhTMjU2In0='
  public port?: number
  public name: string
  public config: InitConfig
  public agent: Agent
  public inBoundTransport!: InboundTransport
  public outBoundTransport!: OutboundTransport

  public constructor(props: {
    name: string
    publicDidSeed?: string
    staticDids?: DidProps[]
    port?: number
    transports?: Transports[]
    valueTransferConfig?: ValueTransferConfig
    mediatorConnectionsInvite?: string
  }) {
    this.name = props.name
    this.port = props.port

    const config: InitConfig = {
      label: props.name,
      walletConfig: {
        id: props.name,
        key: props.name,
      },
      publicDidSeed: props.publicDidSeed,
      staticDids: props.staticDids,
      indyLedgers: [
        {
          genesisTransactions: bcovrin,
          id: 'greenlights' + props.name,
          isProduction: false,
        },
      ],
      connectToIndyLedgersOnStartup: false,
      endpoints: props.port ? [`http://localhost:${this.port}`] : undefined,
      autoAcceptConnections: true,
      autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
      autoAcceptProofs: AutoAcceptProof.ContentApproved,
      mediatorPickupStrategy: MediatorPickupStrategy.Combined,
      mediatorPollingInterval: 5000,
      valueTransferConfig: props.valueTransferConfig,
      transports: props.transports,
      mediatorConnectionsInvite: props.mediatorConnectionsInvite,
      mediatorDeliveryStrategy: MediatorDeliveryStrategy.WebSocket,
    }

    this.config = config

    this.agent = new Agent(config, agentDependencies)

    const transports = props.transports || []

    if (transports.includes(Transports.HTTP) || transports.includes(Transports.HTTPS)) {
      this.outBoundTransport = new HttpOutboundTransport()
      this.agent.registerOutboundTransport(this.outBoundTransport)
    }

    if (transports.includes(Transports.WS) || transports.includes(Transports.WSS)) {
      this.outBoundTransport = new WsOutboundTransport()
      this.agent.registerOutboundTransport(this.outBoundTransport)
    }

    if (transports.includes(Transports.NFC)) {
      this.inBoundTransport = new FileInboundTransport({ alias: props.name, schema: Transports.NFC })
      this.outBoundTransport = new FileOutboundTransport({
        alias: props.name,
        schema: Transports.NFC,
      })

      this.agent.registerInboundTransport(this.inBoundTransport)
      this.agent.registerOutboundTransport(this.outBoundTransport)
    }

    if (transports.includes(Transports.IPC)) {
      this.inBoundTransport = new FileInboundTransport({ alias: props.name, schema: Transports.IPC })
      this.outBoundTransport = new FileOutboundTransport({
        alias: props.name,
        schema: Transports.IPC,
      })

      this.agent.registerInboundTransport(this.inBoundTransport)
      this.agent.registerOutboundTransport(this.outBoundTransport)
    }

    if (transports.includes(Transports.Nearby)) {
      this.inBoundTransport = new FileInboundTransport({ alias: props.name, schema: Transports.Nearby })
      this.outBoundTransport = new FileOutboundTransport({
        alias: props.name,
        schema: Transports.Nearby,
      })

      this.agent.registerInboundTransport(this.inBoundTransport)
      this.agent.registerOutboundTransport(this.outBoundTransport)
    }
  }

  public async initializeAgent() {
    await this.agent.initialize()
    console.log(greenText(`\nAgent ${this.name} created!\n`))
  }
}
