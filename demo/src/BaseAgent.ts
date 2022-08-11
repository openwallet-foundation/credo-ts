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
import { VerifiableNote } from '@sicpa-dlab/value-transfer-protocol-ts'

import { greenText } from './OutputClass'
import { FileInboundTransport } from './transports/FileInboundTransport'
import { FileOutboundTransport } from './transports/FileOutboundTransport'

const bcovrin = `{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node1","blskey":"4N8aUNHSgjQVgkpm8nhNEfDf6txHznoYREg9kirmJrkivgL4oSEimFF6nsQ6M41QvhM2Z33nves5vfSn9n1UwNFJBYtWVnHYMATn76vLuL3zU88KyeAYcHfsih3He6UHcXDxcaecHVz6jhCYz1P2UZn2bDVruL5wXpehgBfBaLKm3Ba","blskey_pop":"RahHYiCvoNCtPTrVtP7nMC5eTYrsUA8WjXbdhNc8debh1agE9bGiJxWBXYNFbnJXoXhWFMvyqhqhRoq737YQemH5ik9oL7R4NTTCz2LEZhkgLJzB3QRQqJyBNyv7acbdHrAT8nQ9UkLbaVL9NBpnWXBTw4LEMePaSHEw66RzPNdAX1","client_ip":"138.197.138.255","client_port":9702,"node_ip":"138.197.138.255","node_port":9701,"services":["VALIDATOR"]},"dest":"Gw6pDLhcBcoQesN72qfotTgFa7cbuqZpkX3Xo6pLhPhv"},"metadata":{"from":"Th7MpTaRZVRYnPiabds81Y"},"type":"0"},"txnMetadata":{"seqNo":1,"txnId":"fea82e10e894419fe2bea7d96296a6d46f50f93f9eeda954ec461b2ed2950b62"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node2","blskey":"37rAPpXVoxzKhz7d9gkUe52XuXryuLXoM6P6LbWDB7LSbG62Lsb33sfG7zqS8TK1MXwuCHj1FKNzVpsnafmqLG1vXN88rt38mNFs9TENzm4QHdBzsvCuoBnPH7rpYYDo9DZNJePaDvRvqJKByCabubJz3XXKbEeshzpz4Ma5QYpJqjk","blskey_pop":"Qr658mWZ2YC8JXGXwMDQTzuZCWF7NK9EwxphGmcBvCh6ybUuLxbG65nsX4JvD4SPNtkJ2w9ug1yLTj6fgmuDg41TgECXjLCij3RMsV8CwewBVgVN67wsA45DFWvqvLtu4rjNnE9JbdFTc1Z4WCPA3Xan44K1HoHAq9EVeaRYs8zoF5","client_ip":"138.197.138.255","client_port":9704,"node_ip":"138.197.138.255","node_port":9703,"services":["VALIDATOR"]},"dest":"8ECVSk179mjsjKRLWiQtssMLgp6EPhWXtaYyStWPSGAb"},"metadata":{"from":"EbP4aYNeTHL6q385GuVpRV"},"type":"0"},"txnMetadata":{"seqNo":2,"txnId":"1ac8aece2a18ced660fef8694b61aac3af08ba875ce3026a160acbc3a3af35fc"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node3","blskey":"3WFpdbg7C5cnLYZwFZevJqhubkFALBfCBBok15GdrKMUhUjGsk3jV6QKj6MZgEubF7oqCafxNdkm7eswgA4sdKTRc82tLGzZBd6vNqU8dupzup6uYUf32KTHTPQbuUM8Yk4QFXjEf2Usu2TJcNkdgpyeUSX42u5LqdDDpNSWUK5deC5","blskey_pop":"QwDeb2CkNSx6r8QC8vGQK3GRv7Yndn84TGNijX8YXHPiagXajyfTjoR87rXUu4G4QLk2cF8NNyqWiYMus1623dELWwx57rLCFqGh7N4ZRbGDRP4fnVcaKg1BcUxQ866Ven4gw8y4N56S5HzxXNBZtLYmhGHvDtk6PFkFwCvxYrNYjh","client_ip":"138.197.138.255","client_port":9706,"node_ip":"138.197.138.255","node_port":9705,"services":["VALIDATOR"]},"dest":"DKVxG2fXXTU8yT5N7hGEbXB3dfdAnYv1JczDUHpmDxya"},"metadata":{"from":"4cU41vWW82ArfxJxHkzXPG"},"type":"0"},"txnMetadata":{"seqNo":3,"txnId":"7e9f355dffa78ed24668f0e0e369fd8c224076571c51e2ea8be5f26479edebe4"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node4","blskey":"2zN3bHM1m4rLz54MJHYSwvqzPchYp8jkHswveCLAEJVcX6Mm1wHQD1SkPYMzUDTZvWvhuE6VNAkK3KxVeEmsanSmvjVkReDeBEMxeDaayjcZjFGPydyey1qxBHmTvAnBKoPydvuTAqx5f7YNNRAdeLmUi99gERUU7TD8KfAa6MpQ9bw","blskey_pop":"RPLagxaR5xdimFzwmzYnz4ZhWtYQEj8iR5ZU53T2gitPCyCHQneUn2Huc4oeLd2B2HzkGnjAff4hWTJT6C7qHYB1Mv2wU5iHHGFWkhnTX9WsEAbunJCV2qcaXScKj4tTfvdDKfLiVuU2av6hbsMztirRze7LvYBkRHV3tGwyCptsrP","client_ip":"138.197.138.255","client_port":9708,"node_ip":"138.197.138.255","node_port":9707,"services":["VALIDATOR"]},"dest":"4PS3EDQ3dW1tci1Bp6543CfuuebjFrg36kLAUcskGfaA"},"metadata":{"from":"TWwCRQRZ2ZHMJFn9TzLp7W"},"type":"0"},"txnMetadata":{"seqNo":4,"txnId":"aa5e817d7cc626170eca175822029339a444eb0ee8f0bd20d3b0b76e566fb008"},"ver":"1"}`

export const notes = [
  new VerifiableNote({
    sno: '29fe17e8-7513-4952-9aec-5027757f3e4a',
    srs: 'some-cool-series?uoa=eur&den=120&key=asddasdgdfcdasdasdasddasdasasdadadadadasdasdasdasdasd9adadadasdasdvvxvxvxbcvb&aud-rus=123213',
    sig: 'deadbeefcafebabedeadbeefcafebabe',
    ixz: undefined,
    hxz: undefined,
  }),
  new VerifiableNote({
    sno: '79c60e29-b088-425a-8ec9-70cb912dbbcd',
    srs: 'some-cool-series?uoa=eur&den=120&key=asddasdgdfcdasdasdasddasdasasdadadadadasdasdasdasdasd9adadadasdasdvvxvxvxbcvb&aud-rus=123213',
    sig: 'deadbeefcafebabedeadbeefcafebabe',
    ixz: undefined,
    hxz: undefined,
  }),
  new VerifiableNote({
    sno: 'f1116d33-4cf1-43dc-9464-c5b4607adf58',
    srs: 'some-cool-series?uoa=eur&den=120&key=asddasdgdfcdasdasdasddasdasasdadadadadasdasdasdasdasd9adadadasdasdvvxvxvxbcvb&aud-rus=123213',
    sig: 'deadbeefcafebabedeadbeefcafebabe',
    ixz: undefined,
    hxz: undefined,
  }),
  new VerifiableNote({
    sno: 'a20adfb5-d0ec-465f-80e0-d26bbdaeed5e',
    srs: 'some-cool-series?uoa=eur&den=120&key=asddasdgdfcdasdasdasddasdasasdadadadadasdasdasdasdasd9adadadasdasdvvxvxvxbcvb&aud-rus=123213',
    sig: 'deadbeefcafebabedeadbeefcafebabe',
    ixz: undefined,
    hxz: undefined,
  }),
  new VerifiableNote({
    sno: 'e5bc7b15-9edc-48dc-a13e-274655eba995',
    srs: 'some-cool-series?uoa=eur&den=120&key=asddasdgdfcdasdasdasddasdasasdadadadadasdasdasdasdasd9adadadasdasdvvxvxvxbcvb&aud-rus=123213',
    sig: 'deadbeefcafebabedeadbeefcafebabe',
    ixz: undefined,
    hxz: undefined,
  }),
  new VerifiableNote({
    sno: '96f58bea-37b8-41a7-ae0f-61895781a656',
    srs: 'some-cool-series?uoa=eur&den=120&key=asddasdgdfcdasdasdasddasdasasdadadadadasdasdasdasdasd9adadadasdasdvvxvxvxbcvb&aud-rus=123213',
    sig: 'deadbeefcafebabedeadbeefcafebabe',
    ixz: undefined,
    hxz: undefined,
  }),
  new VerifiableNote({
    sno: '92136368-3d3a-4571-b378-d3bd92e27bfa',
    srs: 'some-cool-series?uoa=eur&den=120&key=asddasdgdfcdasdasdasddasdasasdadadadadasdasdasdasdasd9adadadasdasdvvxvxvxbcvb&aud-rus=123213',
    sig: 'deadbeefcafebabedeadbeefcafebabe',
    ixz: undefined,
    hxz: undefined,
  }),
  new VerifiableNote({
    sno: 'b8278f4f-d6a4-4711-9ed7-d60046e37097',
    srs: 'some-cool-series?uoa=eur&den=120&key=asddasdgdfcdasdasdasddasdasasdadadadadasdasdasdasdasd9adadadasdasdvvxvxvxbcvb&aud-rus=123213',
    sig: 'deadbeefcafebabedeadbeefcafebabe',
    ixz: undefined,
    hxz: undefined,
  }),
  new VerifiableNote({
    sno: 'f57f3bba-7ca3-4a1b-ac5d-9d462a206cd5',
    srs: 'some-cool-series?uoa=eur&den=120&key=asddasdgdfcdasdasdasddasdasasdadadadadasdasdasdasdasd9adadadasdasdvvxvxvxbcvb&aud-rus=123213',
    sig: 'deadbeefcafebabedeadbeefcafebabe',
    ixz: undefined,
    hxz: undefined,
  }),
  new VerifiableNote({
    sno: '4b98a19c-129e-47c8-b662-b0662793ee67',
    srs: 'some-cool-series?uoa=eur&den=120&key=asddasdgdfcdasdasdasddasdasasdadadadadasdasdasdasdasd9adadadasdasdvvxvxvxbcvb&aud-rus=123213',
    sig: 'deadbeefcafebabedeadbeefcafebabe',
    ixz: undefined,
    hxz: undefined,
  }),
]

export class BaseAgent {
  public static defaultMediatorConnectionInvite =
    'http://192.168.1.145:3000/api/v1/api/v1?oob=eyJ0eXAiOiJhcHBsaWNhdGlvbi9kaWRjb21tLXBsYWluK2pzb24iLCJpZCI6IjkwNGUxZjdmLTUzYjYtNDEyNC05OGFjLTFiOWM4MzViYTcxMCIsImZyb20iOiJkaWQ6cGVlcjoyLkV6NkxTbkhTOWYzaHJNdUxyTjl6NlpobzdUY0JSdlN5SzdIUGpRdHdLbXUzb3NXd0YuVno2TWtyYWhBb1ZMUVM5UzVHRjVzVUt0dWRYTWVkVVNaZGRlSmhqSHRBRmFWNGhvVi5TVzNzaWN5STZJbWgwZEhBNkx5OHhPVEl1TVRZNExqRXVNVFExT2pNd01EQXZZWEJwTDNZeElpd2lkQ0k2SW1SdElpd2ljaUk2VzEwc0ltRWlPbHNpWkdsa1kyOXRiUzkyTWlKZGZTeDdJbk1pT2lKM2N6b3ZMekU1TWk0eE5qZ3VNUzR4TkRVNk16QXdNQzloY0drdmRqRWlMQ0owSWpvaVpHMGlMQ0p5SWpwYlhTd2lZU0k2V3lKa2FXUmpiMjF0TDNZeUlsMTlYUSIsImJvZHkiOnsiZ29hbF9jb2RlIjoibWVkaWF0b3ItcHJvdmlzaW9uIn0sInR5cGUiOiJodHRwczovL2RpZGNvbW0ub3JnL291dC1vZi1iYW5kLzIuMC9pbnZpdGF0aW9uIiwiYWxnIjoiSFMyNTYifQ=='

  public static witnessTable = [
    {
      wid: '1',
      publicDid:
        'gossipDid:peer:2.Ez6LSfsT5gHMCVEya8VDwW9QbAdVUhJCKbVscrrb82SwCPKKT.Vz6MkgNdE8ad1k8cPCHnXZ6vSxrTuFauRKDzzUHLPvdsLycz5.SeyJzIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS92MSIsInQiOiJkbSIsInIiOlsiZGlkOnBlZXI6Mi5FejZMU25IUzlmM2hyTXVMck45ejZaaG83VGNCUnZTeUs3SFBqUXR3S211M29zV3dGLlZ6Nk1rcmFoQW9WTFFTOVM1R0Y1c1VLdHVkWE1lZFVTWmRkZUpoakh0QUZhVjRob1YuU1czc2ljeUk2SW1oMGRIQTZMeTlzYjJOaGJHaHZjM1E2TXpBd01DOWhjR2t2ZGpFaUxDSjBJam9pWkcwaUxDSnlJanBiWFN3aVlTSTZXeUprYVdSamIyMXRMM1l5SWwxOUxIc2ljeUk2SW5kek9pOHZiRzlqWVd4b2IzTjBPak13TURBdllYQnBMM1l4SWl3aWRDSTZJbVJ0SWl3aWNpSTZXMTBzSW1FaU9sc2laR2xrWTI5dGJTOTJNaUpkZlYwIl0sImEiOlsiZGlkY29tbS92MiJdfQ',
      gossipDid:
        'gossipDid:peer:2.Ez6LSfsT5gHMCVEya8VDwW9QbAdVUhJCKbVscrrb82SwCPKKT.Vz6MkgNdE8ad1k8cPCHnXZ6vSxrTuFauRKDzzUHLPvdsLycz5.SeyJzIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS92MSIsInQiOiJkbSIsInIiOlsiZGlkOnBlZXI6Mi5FejZMU25IUzlmM2hyTXVMck45ejZaaG83VGNCUnZTeUs3SFBqUXR3S211M29zV3dGLlZ6Nk1rcmFoQW9WTFFTOVM1R0Y1c1VLdHVkWE1lZFVTWmRkZUpoakh0QUZhVjRob1YuU1czc2ljeUk2SW1oMGRIQTZMeTlzYjJOaGJHaHZjM1E2TXpBd01DOWhjR2t2ZGpFaUxDSjBJam9pWkcwaUxDSnlJanBiWFN3aVlTSTZXeUprYVdSamIyMXRMM1l5SWwxOUxIc2ljeUk2SW5kek9pOHZiRzlqWVd4b2IzTjBPak13TURBdllYQnBMM1l4SWl3aWRDSTZJbVJ0SWl3aWNpSTZXMTBzSW1FaU9sc2laR2xrWTI5dGJTOTJNaUpkZlYwIl0sImEiOlsiZGlkY29tbS92MiJdfQ',
      type: '1',
    },
    {
      wid: '2',
      publicDid:
        'gossipDid:peer:2.Ez6LSrBqyFyuFyjhCsq8cHyB323nMQmK3P1bimYjDda4pKznt.Vz6MkkNzZMiDUaJpikZDe3qymeAJNcwuCz8gotsQjR65FxGjT.SeyJzIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS92MSIsInQiOiJkbSIsInIiOlsiZGlkOnBlZXI6Mi5FejZMU25IUzlmM2hyTXVMck45ejZaaG83VGNCUnZTeUs3SFBqUXR3S211M29zV3dGLlZ6Nk1rcmFoQW9WTFFTOVM1R0Y1c1VLdHVkWE1lZFVTWmRkZUpoakh0QUZhVjRob1YuU1czc2ljeUk2SW1oMGRIQTZMeTlzYjJOaGJHaHZjM1E2TXpBd01DOWhjR2t2ZGpFaUxDSjBJam9pWkcwaUxDSnlJanBiWFN3aVlTSTZXeUprYVdSamIyMXRMM1l5SWwxOUxIc2ljeUk2SW5kek9pOHZiRzlqWVd4b2IzTjBPak13TURBdllYQnBMM1l4SWl3aWRDSTZJbVJ0SWl3aWNpSTZXMTBzSW1FaU9sc2laR2xrWTI5dGJTOTJNaUpkZlYwIl0sImEiOlsiZGlkY29tbS92MiJdfQ',

      gossipDid:
        'gossipDid:peer:2.Ez6LSrBqyFyuFyjhCsq8cHyB323nMQmK3P1bimYjDda4pKznt.Vz6MkkNzZMiDUaJpikZDe3qymeAJNcwuCz8gotsQjR65FxGjT.SeyJzIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS92MSIsInQiOiJkbSIsInIiOlsiZGlkOnBlZXI6Mi5FejZMU25IUzlmM2hyTXVMck45ejZaaG83VGNCUnZTeUs3SFBqUXR3S211M29zV3dGLlZ6Nk1rcmFoQW9WTFFTOVM1R0Y1c1VLdHVkWE1lZFVTWmRkZUpoakh0QUZhVjRob1YuU1czc2ljeUk2SW1oMGRIQTZMeTlzYjJOaGJHaHZjM1E2TXpBd01DOWhjR2t2ZGpFaUxDSjBJam9pWkcwaUxDSnlJanBiWFN3aVlTSTZXeUprYVdSamIyMXRMM1l5SWwxOUxIc2ljeUk2SW5kek9pOHZiRzlqWVd4b2IzTjBPak13TURBdllYQnBMM1l4SWl3aWRDSTZJbVJ0SWl3aWNpSTZXMTBzSW1FaU9sc2laR2xrWTI5dGJTOTJNaUpkZlYwIl0sImEiOlsiZGlkY29tbS92MiJdfQ',
      type: '2',
    },
    {
      wid: '3',
      publicDid:
        'gossipDid:peer:2.Ez6LSbnBiAoatfuxLwzotC8UjUW4RGRezHQom34W3x65r1WbZ.Vz6MkodK1b4VEngLqN3cPPqhuFrvUgadNJfbcAjQAP6KHQwUz.SeyJzIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS92MSIsInQiOiJkbSIsInIiOlsiZGlkOnBlZXI6Mi5FejZMU25IUzlmM2hyTXVMck45ejZaaG83VGNCUnZTeUs3SFBqUXR3S211M29zV3dGLlZ6Nk1rcmFoQW9WTFFTOVM1R0Y1c1VLdHVkWE1lZFVTWmRkZUpoakh0QUZhVjRob1YuU1czc2ljeUk2SW1oMGRIQTZMeTlzYjJOaGJHaHZjM1E2TXpBd01DOWhjR2t2ZGpFaUxDSjBJam9pWkcwaUxDSnlJanBiWFN3aVlTSTZXeUprYVdSamIyMXRMM1l5SWwxOUxIc2ljeUk2SW5kek9pOHZiRzlqWVd4b2IzTjBPak13TURBdllYQnBMM1l4SWl3aWRDSTZJbVJ0SWl3aWNpSTZXMTBzSW1FaU9sc2laR2xrWTI5dGJTOTJNaUpkZlYwIl0sImEiOlsiZGlkY29tbS92MiJdfQ',
      gossipDid:
        'gossipDid:peer:2.Ez6LSbnBiAoatfuxLwzotC8UjUW4RGRezHQom34W3x65r1WbZ.Vz6MkodK1b4VEngLqN3cPPqhuFrvUgadNJfbcAjQAP6KHQwUz.SeyJzIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS92MSIsInQiOiJkbSIsInIiOlsiZGlkOnBlZXI6Mi5FejZMU25IUzlmM2hyTXVMck45ejZaaG83VGNCUnZTeUs3SFBqUXR3S211M29zV3dGLlZ6Nk1rcmFoQW9WTFFTOVM1R0Y1c1VLdHVkWE1lZFVTWmRkZUpoakh0QUZhVjRob1YuU1czc2ljeUk2SW1oMGRIQTZMeTlzYjJOaGJHaHZjM1E2TXpBd01DOWhjR2t2ZGpFaUxDSjBJam9pWkcwaUxDSnlJanBiWFN3aVlTSTZXeUprYVdSamIyMXRMM1l5SWwxOUxIc2ljeUk2SW5kek9pOHZiRzlqWVd4b2IzTjBPak13TURBdllYQnBMM1l4SWl3aWRDSTZJbVJ0SWl3aWNpSTZXMTBzSW1FaU9sc2laR2xrWTI5dGJTOTJNaUpkZlYwIl0sImEiOlsiZGlkY29tbS92MiJdfQ',
      type: '2',
    },
  ]

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
    endpoints?: string[]
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
      endpoints: props.endpoints,
      autoAcceptConnections: true,
      autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
      autoAcceptProofs: AutoAcceptProof.ContentApproved,
      mediatorPickupStrategy: MediatorPickupStrategy.Implicit,
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
