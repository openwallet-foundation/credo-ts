import {
  AnonCredsDidCommCredentialFormatService,
  AnonCredsDidCommProofFormatService,
  AnonCredsModule,
  DidCommCredentialV1Protocol,
  DidCommProofV1Protocol,
  LegacyIndyDidCommCredentialFormatService,
  LegacyIndyDidCommProofFormatService,
} from '@credo-ts/anoncreds'
import type { AskarModuleConfigStoreOptions } from '@credo-ts/askar'
import { AskarModule } from '@credo-ts/askar'
import {
  CheqdAnonCredsRegistry,
  CheqdDidRegistrar,
  CheqdDidResolver,
  CheqdModule,
  CheqdModuleConfig,
} from '@credo-ts/cheqd'
import { Agent, DidsModule } from '@credo-ts/core'
import type { DidCommModuleConfigOptions } from '@credo-ts/didcomm'
import {
  DidCommAutoAcceptCredential,
  DidCommAutoAcceptProof,
  DidCommCredentialV2Protocol,
  DidCommHttpOutboundTransport,
  DidCommModule,
  DidCommProofV2Protocol,
} from '@credo-ts/didcomm'
import { HederaAnonCredsRegistry, HederaDidRegistrar, HederaDidResolver, HederaModule } from '@credo-ts/hedera'
import type { IndyVdrPoolConfig } from '@credo-ts/indy-vdr'
import { IndyVdrAnonCredsRegistry, IndyVdrIndyDidResolver, IndyVdrModule } from '@credo-ts/indy-vdr'
import { agentDependencies, DidCommHttpInboundTransport } from '@credo-ts/node'
import type { HederaNetwork } from '@hiero-did-sdk/client'
import { anoncreds } from '@hyperledger/anoncreds-nodejs'
import { indyVdr } from '@hyperledger/indy-vdr-nodejs'
import { askar } from '@openwallet-foundation/askar-nodejs'
import { greenText } from './OutputClass'

const bcovrin = `{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node1","blskey":"4N8aUNHSgjQVgkpm8nhNEfDf6txHznoYREg9kirmJrkivgL4oSEimFF6nsQ6M41QvhM2Z33nves5vfSn9n1UwNFJBYtWVnHYMATn76vLuL3zU88KyeAYcHfsih3He6UHcXDxcaecHVz6jhCYz1P2UZn2bDVruL5wXpehgBfBaLKm3Ba","blskey_pop":"RahHYiCvoNCtPTrVtP7nMC5eTYrsUA8WjXbdhNc8debh1agE9bGiJxWBXYNFbnJXoXhWFMvyqhqhRoq737YQemH5ik9oL7R4NTTCz2LEZhkgLJzB3QRQqJyBNyv7acbdHrAT8nQ9UkLbaVL9NBpnWXBTw4LEMePaSHEw66RzPNdAX1","client_ip":"138.197.138.255","client_port":9702,"node_ip":"138.197.138.255","node_port":9701,"services":["VALIDATOR"]},"dest":"Gw6pDLhcBcoQesN72qfotTgFa7cbuqZpkX3Xo6pLhPhv"},"metadata":{"from":"Th7MpTaRZVRYnPiabds81Y"},"type":"0"},"txnMetadata":{"seqNo":1,"txnId":"fea82e10e894419fe2bea7d96296a6d46f50f93f9eeda954ec461b2ed2950b62"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node2","blskey":"37rAPpXVoxzKhz7d9gkUe52XuXryuLXoM6P6LbWDB7LSbG62Lsb33sfG7zqS8TK1MXwuCHj1FKNzVpsnafmqLG1vXN88rt38mNFs9TENzm4QHdBzsvCuoBnPH7rpYYDo9DZNJePaDvRvqJKByCabubJz3XXKbEeshzpz4Ma5QYpJqjk","blskey_pop":"Qr658mWZ2YC8JXGXwMDQTzuZCWF7NK9EwxphGmcBvCh6ybUuLxbG65nsX4JvD4SPNtkJ2w9ug1yLTj6fgmuDg41TgECXjLCij3RMsV8CwewBVgVN67wsA45DFWvqvLtu4rjNnE9JbdFTc1Z4WCPA3Xan44K1HoHAq9EVeaRYs8zoF5","client_ip":"138.197.138.255","client_port":9704,"node_ip":"138.197.138.255","node_port":9703,"services":["VALIDATOR"]},"dest":"8ECVSk179mjsjKRLWiQtssMLgp6EPhWXtaYyStWPSGAb"},"metadata":{"from":"EbP4aYNeTHL6q385GuVpRV"},"type":"0"},"txnMetadata":{"seqNo":2,"txnId":"1ac8aece2a18ced660fef8694b61aac3af08ba875ce3026a160acbc3a3af35fc"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node3","blskey":"3WFpdbg7C5cnLYZwFZevJqhubkFALBfCBBok15GdrKMUhUjGsk3jV6QKj6MZgEubF7oqCafxNdkm7eswgA4sdKTRc82tLGzZBd6vNqU8dupzup6uYUf32KTHTPQbuUM8Yk4QFXjEf2Usu2TJcNkdgpyeUSX42u5LqdDDpNSWUK5deC5","blskey_pop":"QwDeb2CkNSx6r8QC8vGQK3GRv7Yndn84TGNijX8YXHPiagXajyfTjoR87rXUu4G4QLk2cF8NNyqWiYMus1623dELWwx57rLCFqGh7N4ZRbGDRP4fnVcaKg1BcUxQ866Ven4gw8y4N56S5HzxXNBZtLYmhGHvDtk6PFkFwCvxYrNYjh","client_ip":"138.197.138.255","client_port":9706,"node_ip":"138.197.138.255","node_port":9705,"services":["VALIDATOR"]},"dest":"DKVxG2fXXTU8yT5N7hGEbXB3dfdAnYv1JczDUHpmDxya"},"metadata":{"from":"4cU41vWW82ArfxJxHkzXPG"},"type":"0"},"txnMetadata":{"seqNo":3,"txnId":"7e9f355dffa78ed24668f0e0e369fd8c224076571c51e2ea8be5f26479edebe4"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node4","blskey":"2zN3bHM1m4rLz54MJHYSwvqzPchYp8jkHswveCLAEJVcX6Mm1wHQD1SkPYMzUDTZvWvhuE6VNAkK3KxVeEmsanSmvjVkReDeBEMxeDaayjcZjFGPydyey1qxBHmTvAnBKoPydvuTAqx5f7YNNRAdeLmUi99gERUU7TD8KfAa6MpQ9bw","blskey_pop":"RPLagxaR5xdimFzwmzYnz4ZhWtYQEj8iR5ZU53T2gitPCyCHQneUn2Huc4oeLd2B2HzkGnjAff4hWTJT6C7qHYB1Mv2wU5iHHGFWkhnTX9WsEAbunJCV2qcaXScKj4tTfvdDKfLiVuU2av6hbsMztirRze7LvYBkRHV3tGwyCptsrP","client_ip":"138.197.138.255","client_port":9708,"node_ip":"138.197.138.255","node_port":9707,"services":["VALIDATOR"]},"dest":"4PS3EDQ3dW1tci1Bp6543CfuuebjFrg36kLAUcskGfaA"},"metadata":{"from":"TWwCRQRZ2ZHMJFn9TzLp7W"},"type":"0"},"txnMetadata":{"seqNo":4,"txnId":"aa5e817d7cc626170eca175822029339a444eb0ee8f0bd20d3b0b76e566fb008"},"ver":"1"}
{"reqSignature":{"type":"ED25519","values":[{"from":"QacK4UiSTf1aaK48TxuEGR","value":"4DmDvSN6GactxZBNs1TmoLvFST4aKUir83DxBnwvM9aoZS8NkouhmZjck2yNGgNUYkNkLQdf2NFthCC3shLiEk7b"}]},"txn":{"data":{"data":{"alias":"BCovrin01","blskey":"4B2YFAa8MDiGuh7CvjD5nuApqXMGvgYbdbZq3D8pQywTaLZmuMKcNu9KHZM7E64ZypBfKfgfPzADdQaLhhh5NA1ycuoG84pQz1Q1RjaRNf9HP5YH9NFjSnS1ssVNjLyX2courwdVfYbNZ2MTNY8nAuiD3g1Jn3MJcvchAK1xGeeqkuy","blskey_pop":"QrCvZzZJoGMsDM16XMryE2p2vvfr3ah3ZXj2PQe5DBKpdcnc6Lcb6m8TTRtJLvFbFWhcbUXVZVeESEWFu4hmawimcrytUUvwukP2m1chAL35rF7Yw9htnNVf6yRPcuJvyFucYKLvESSueCzt1gb7E6dersqij18yqoeHEismXZct3h","client_ip":"130.107.207.129","client_port":9702,"node_ip":"130.107.207.129","node_port":9701,"services":["VALIDATOR"]},"dest":"HKG8kcARyViNsZhXZiUpPZKXfQEWAyd34LusbqGTBmNe"},"metadata":{"digest":"d632c4f256783cfa41373036494d6d5a8da186143a3ecfbdbbfdf0f23fe91a05","from":"QacK4UiSTf1aaK48TxuEGR","payloadDigest":"d4f4f9fef10d3b71b5d231a9d1443bda4d575fe349daccbdbbdb0819bbc457a9","reqId":1757965190326432796},"protocolVersion":2,"type":"0"},"txnMetadata":{"seqNo":5,"txnTime":1757965188},"ver":"1"}
{"reqSignature":{"type":"ED25519","values":[{"from":"QacK4UiSTf1aaK48TxuEGR","value":"3ZStF5Rjh9JyYnSCD6BZftMtY2Cp8xnptj2fJfXUAh9xARm7tGVy7nbDvsgaYSkZ3Xi6eNMuJwLptVqCv5pdpA2N"}]},"txn":{"data":{"data":{"alias":"BCovrin01","services":[]},"dest":"HKG8kcARyViNsZhXZiUpPZKXfQEWAyd34LusbqGTBmNe"},"metadata":{"digest":"a63fde55671b0b38a39109cedf5f4a20f33e62840bdc895947c0bb254ec9724f","from":"QacK4UiSTf1aaK48TxuEGR","payloadDigest":"6912fdf0278d1e81e7f1eb51c7c1f22876846638172a960c28b3a70eb0131cb0","reqId":1757965418732675268},"protocolVersion":2,"type":"0"},"txnMetadata":{"seqNo":6,"txnTime":1757965417},"ver":"1"}
{"reqSignature":{"type":"ED25519","values":[{"from":"QacK4UiSTf1aaK48TxuEGR","value":"66f2YgxoCTcGhCxejwpXbjxLf4HDa4uKDp2uETLADzmW1Zy6P8X6rnmJm3bSDCwkuDQ1MBsabhK3SJoEE2C2UQJC"}]},"txn":{"data":{"data":{"alias":"BCovrin01","services":["VALIDATOR"]},"dest":"HKG8kcARyViNsZhXZiUpPZKXfQEWAyd34LusbqGTBmNe"},"metadata":{"digest":"87078cbf94319c6bfeadcf5658533508622835a9169a2ed0578e820e93083f5d","from":"QacK4UiSTf1aaK48TxuEGR","payloadDigest":"d51b5f912ad397560669973e31b80ed1950fbc37343b962a6f64e51997228021","reqId":1757966728426907714},"protocolVersion":2,"type":"0"},"txnMetadata":{"seqNo":7,"txnTime":1757966727},"ver":"1"}
{"reqSignature":{"type":"ED25519","values":[{"from":"GP6VVbdWPjKcL8ahbbxS21","value":"3iBuKUYwMXgLywU1o2aWUcqTzJupLMfe91Y3gEnkWA9WtUxsXBfX2MtPqPuF7cRxGnCEtWQAXAwESvZeJjYxZbib"}]},"txn":{"data":{"data":{"alias":"BCovrin02","blskey":"2Lwv1yGbK9pfouhSgMBU5gM4pkKckRpm2banfsm2Erk8tAXR2HJYmYmysm7sKWPQw7nF3qzFxMuvx3B2uWFyxqk23Qhdc9iZKKKmE4CxND9GqzBoDNVz8yC6CyiTTkqvC2cGvGcf7fWRBicZoMzLwfsUuYYuo9sUnG2eh6JfUpRS597","blskey_pop":"RRYeUCfFAcgzBZoCdkjq77VGaJdS2uuKite92mE4RKxspkJbvNpGUoQt8Yk6SVN6LK8pEnTZggPByYUzwKv3uE9etbzAYBKuQ5MadAL3wTdUfpZisHqUqpuPoroR1YsTNPwNFyzdenL3WwAqcs95ZHuNf8XuFyaxdWiNLhHzcsYvwy","client_ip":"130.107.207.129","client_port":9704,"node_ip":"130.107.207.129","node_port":9703,"services":["VALIDATOR"]},"dest":"E3gWL16C74AGtdNABGNtPrS8xAfgNVdZHeD1B9gQNojQ"},"metadata":{"digest":"b6e53f5fda5804b23b0e58b592ea031d5f490d54cf89a92d159af1de9f61bb56","from":"GP6VVbdWPjKcL8ahbbxS21","payloadDigest":"9a75b39db6b1b06f520d931ed02521e26a5350bb834780dcd5a1b61ba1f644e0","reqId":1758027129447701708},"protocolVersion":2,"type":"0"},"txnMetadata":{"seqNo":8,"txnTime":1758027129},"ver":"1"}
{"reqSignature":{"type":"ED25519","values":[{"from":"B3d91BzBvxeJY29S53kvZS","value":"3Vd7GHXrr7B1Nox4AGLVUWk9eJUUzzcfk6sh8AimNJ8PQEGbbNyoZ8ieK8hVJworutg15PALLgxmUz7oyhpQ5P7Y"}]},"txn":{"data":{"data":{"alias":"BCovrin03","blskey":"15q94XEnswiaCbJWLNFfw1sX4LNeivqRK4z4wHDnEVscCjYs1aJFPZyWmsU7DzNo31ZzqHrxGkYvZBiMAWR5WEB98ipQodVWrYy7GNibhCTs9F18HhYNzKgQWYcvXknYCL7e6KzrNU4qbodNCdy3k1pmWdSQHetsiR6ZbqnVZdrJKFt","blskey_pop":"QySdiYeES9Qy3BacCS5kFqGF2Gfc25mXni7a4rnrfXFmLFh73BKVhaLPL4Nr4cuCkMPYkN6HziTGS15fs9hzE4s4YZYuiHp83GnSWdmxnBiFGEUSUUwJDUXMhHUwxcNsCuTmrBbJoxcv2D8eecqoqD4QCRiiBGtbVpFVeJzBtm787R","client_ip":"130.107.207.129","client_port":9706,"node_ip":"130.107.207.129","node_port":9705,"services":["VALIDATOR"]},"dest":"3bH3KWZ2q8TFQ8Bdyj9skAvWet99CDWjYVqJS4yUbBxn"},"metadata":{"digest":"1a4e33e56fb93498cd6d3d63c8302b419990bd624c79b7f3bcd1c4b477bd4222","from":"B3d91BzBvxeJY29S53kvZS","payloadDigest":"ec58f2474e1f2cab5037e043df2c0200868476e058ef46813264b6fc2464c304","reqId":1758028609248616672},"protocolVersion":2,"type":"0"},"txnMetadata":{"seqNo":9,"txnTime":1758028609},"ver":"1"}
{"reqSignature":{"type":"ED25519","values":[{"from":"LukV4612A9ro4JhTM6o4GJ","value":"5VHd6H2wbrVjcWUrSnvnZU25BZAP2T65dkemDkcQis9iz2yS2ez7mwQGcLook1UarAHp6mcmYgwZw58ixArhonxq"}]},"txn":{"data":{"data":{"alias":"BCovrin04","blskey":"2GQf9xmHsraSZqgDi44dgit98Jf2yzKY9Ky5McPUswUVwjnUyssfUbUxJJrhbYNNEeAcaThL3tRpGFWbCjQwRDSyBQ6BNRG7D7Xvvq3HhvNbeY4uFGURq5u1mua3vFEugMJVpRLTuFCaaFq7a1TEFS6BenBzV6SnqUcMsRZBrXUnyHh","blskey_pop":"R33FtSQnjQK5KsZqDbmJ9VcqzwYyJYtv68hQ1q5JEsy8G1LV1Y4VCeUjbVqHvQyqrZ4gzyVNLMZq1pxksN7hfSJ6vRJoFK9KKk4Tq1w4ChXEkTrDo7NbnZBvxz1cPDk2xPsj6tMvse7wNNADWTkc3isB4TyGmQx4gsfM7BaYMvmv87","client_ip":"130.107.207.129","client_port":9708,"node_ip":"130.107.207.129","node_port":9707,"services":["VALIDATOR"]},"dest":"7zGQEHtRvdTEBMftor2EEMqUjsyq4TTq35EwkZvwFQ7G"},"metadata":{"digest":"56481aaaadef7e18e7dbdcf946cecff8c5ffe4a36c73eda053f687c484ddc039","from":"LukV4612A9ro4JhTM6o4GJ","payloadDigest":"c991ff00d185f0e969e4f05e5180313c2f9ca5fca429b91731a4308d0ed12c7f","reqId":1758029835980946655},"protocolVersion":2,"type":"0"},"txnMetadata":{"seqNo":10,"txnTime":1758029836},"ver":"1"}
{"reqSignature":{"type":"ED25519","values":[{"from":"6WdiPynfLWAp67M9TtX5hR","value":"2QKLsxyZfqiFJ4uxZhErbem9DK44CKhQyBaytYztvzsT38vAxdJyFXDJq3bytLEPee4mUsqKpn4ivBMvAxeHEGec"},{"from":"MjjBAYk1ef7PGdXAx7zR5J","value":"2RwBGhhvZZ6NjXfAMPCtBYv5UNrHHEPDjJAZEqHhRYCky5BJZ1GyYAEJU7dndYu5ZmiFkf82TTF2VdMRPhVgEqKy"}]},"txn":{"data":{"data":{"alias":"Node1","services":[]},"dest":"Gw6pDLhcBcoQesN72qfotTgFa7cbuqZpkX3Xo6pLhPhv"},"metadata":{"digest":"05d3d61f30e39720db180ecfe0c71b484624c922e4dad0fd675738590299a416","from":"6WdiPynfLWAp67M9TtX5hR","payloadDigest":"fd08771e613205b29cceb98ba6f747d71f290bfc3a9f40b53b40a9343e674697","reqId":1758282360126895134},"protocolVersion":2,"type":"0"},"txnMetadata":{"seqNo":11,"txnTime":1758282814},"ver":"1"}
{"reqSignature":{"type":"ED25519","values":[{"from":"6WdiPynfLWAp67M9TtX5hR","value":"3UMbEeaekPaEGmaKvLDY6mJEry9tPditDnLpEcnCr2unvW18oEBDfvtQnMpyQvRVnEu7AWrecrmmXDF5V7x45tvm"},{"from":"MjjBAYk1ef7PGdXAx7zR5J","value":"3EzfxhdaZRg7JPQ9ZU7hoEpkxqz3eQdhMi6M8G3yXWsWzBMbtitoLsfvJovSrF3mNWBwLaeycqr1hr9f93HBbhNz"}]},"txn":{"data":{"data":{"alias":"Node2","services":[]},"dest":"8ECVSk179mjsjKRLWiQtssMLgp6EPhWXtaYyStWPSGAb"},"metadata":{"digest":"51e493edb3780f39685b69997d32398c1d369a78c9d90061e7cfaa623f971ab6","from":"6WdiPynfLWAp67M9TtX5hR","payloadDigest":"6410198918b9fa3470d8f9087dd33491c581b9173d7559b82d88eeef3881522c","reqId":1758282381408073735},"protocolVersion":2,"type":"0"},"txnMetadata":{"seqNo":12,"txnTime":1758285422},"ver":"1"}
{"reqSignature":{"type":"ED25519","values":[{"from":"6WdiPynfLWAp67M9TtX5hR","value":"65yM7JJPfApoRAh7J3TymkihVHFi3AxJCbD8XRkJ9gerFqtSsHdcCNpJE5e6n2k4UaZefP4aqx6k29VsZAs8EoRj"},{"from":"MjjBAYk1ef7PGdXAx7zR5J","value":"4wfubtzyyn3y1pbNa4XtmRxm8SNN4oRmLWvsU85wzvT84Fy6Hcoqp7zDuEqq7h3Pa9uJkuT4Agtsxsk3ZpRWSHdp"}]},"txn":{"data":{"data":{"alias":"Node3","services":[]},"dest":"DKVxG2fXXTU8yT5N7hGEbXB3dfdAnYv1JczDUHpmDxya"},"metadata":{"digest":"e5f6242087aa0fb6cb252b1b649f327e041a8649cc4eddb6286b29abcbf7c64b","from":"6WdiPynfLWAp67M9TtX5hR","payloadDigest":"4ff076fcd21144775995d92b7e609338ff78eb7f05b8de341aec3d850845a1d9","reqId":1758282408190098518},"protocolVersion":2,"type":"0"},"txnMetadata":{"seqNo":13,"txnTime":1758285888},"ver":"1"}
{"reqSignature":{"type":"ED25519","values":[{"from":"6WdiPynfLWAp67M9TtX5hR","value":"4BNUD13NrDx2ADAV13kyePTvbC1iJq5YWwAPDg42m1JSGQkJgacAHtdunD22sJKiiRuijhnL5HaYXD5qKgLZ2pfE"},{"from":"MjjBAYk1ef7PGdXAx7zR5J","value":"4hLK4N4esjaMRRgViAfjQ5FWijM5hkLdurmFh6qPTrTvHQhkgjAQw8qzkYHD5QshRKgXtLut3icJtXQ9C7PNrmEk"}]},"txn":{"data":{"data":{"alias":"Node4","services":[]},"dest":"4PS3EDQ3dW1tci1Bp6543CfuuebjFrg36kLAUcskGfaA"},"metadata":{"digest":"9c8e078bab9179d53d236906f9bc500c89dfaba9db628ddebc688e7d8a6b3914","from":"6WdiPynfLWAp67M9TtX5hR","payloadDigest":"c39040f5ca85d04d21419ac895c0eafaa0168095302ecd780d35da46bf9af92b","reqId":1758282424273905271},"protocolVersion":2,"type":"0"},"txnMetadata":{"seqNo":14,"txnTime":1758286183},"ver":"1"}`

export const indyNetworkConfig = {
  genesisTransactions: bcovrin,
  indyNamespace: 'bcovrin:test',
  isProduction: false,
  connectOnStartup: true,
} satisfies IndyVdrPoolConfig

const useDidCommV2 = process.env.DIDCOMM_V2 === 'true'

type DemoAgent = Agent<ReturnType<typeof getAskarAnonCredsIndyModules>>

export class BaseAgent {
  public port: number
  public name: string
  public agent: DemoAgent
  public useDidCommV2: boolean

  public constructor({ port, name }: { port: number; name: string }) {
    this.name = name
    this.port = port
    this.useDidCommV2 = useDidCommV2

    this.agent = new Agent({
      config: {},
      dependencies: agentDependencies,
      modules: getAskarAnonCredsIndyModules(
        {
          endpoints: [`http://localhost:${this.port}`],
          transports: {
            inbound: [new DidCommHttpInboundTransport({ port })],
            outbound: [new DidCommHttpOutboundTransport()],
          },
        },
        { id: name, key: name },
        { useDidCommV2 }
      ),
    })
  }

  public async initializeAgent() {
    await this.agent.initialize()

    console.log(greenText(`\nAgent ${this.name} created!${this.useDidCommV2 ? ' (DIDComm v2 enabled)' : ''}\n`))
  }
}

function getAskarAnonCredsIndyModules(
  didcommConfig: Omit<DidCommModuleConfigOptions, 'credentials' | 'proofs' | 'connections'>,
  askarStoreConfig: AskarModuleConfigStoreOptions,
  options?: { useDidCommV2?: boolean }
) {
  const legacyIndyCredentialFormatService = new LegacyIndyDidCommCredentialFormatService()
  const legacyIndyProofFormatService = new LegacyIndyDidCommProofFormatService()

  const useDidCommV2 = options?.useDidCommV2 ?? false

  return {
    didcomm: new DidCommModule({
      ...didcommConfig,
      ...(useDidCommV2 && {
        didcommVersions: ['v1', 'v2'],
      }),
      basicMessages: { protocols: ['1.0', '2.0'] },
      connections: {
        autoAcceptConnections: true,
        ...(useDidCommV2 && { autoCreateConnectionOnFirstMessage: true }),
      },
      credentials: {
        autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
        credentialProtocols: [
          new DidCommCredentialV1Protocol({
            indyCredentialFormat: legacyIndyCredentialFormatService,
          }),
          new DidCommCredentialV2Protocol({
            credentialFormats: [legacyIndyCredentialFormatService, new AnonCredsDidCommCredentialFormatService()],
          }),
        ],
      },
      proofs: {
        autoAcceptProofs: DidCommAutoAcceptProof.ContentApproved,
        proofProtocols: [
          new DidCommProofV1Protocol({
            indyProofFormat: legacyIndyProofFormatService,
          }),
          new DidCommProofV2Protocol({
            proofFormats: [legacyIndyProofFormatService, new AnonCredsDidCommProofFormatService()],
          }),
        ],
      },
    }),
    anoncreds: new AnonCredsModule({
      registries: [new IndyVdrAnonCredsRegistry(), new CheqdAnonCredsRegistry(), new HederaAnonCredsRegistry()],
      anoncreds,
    }),
    indyVdr: new IndyVdrModule({
      indyVdr,
      networks: [indyNetworkConfig],
    }),
    cheqd: new CheqdModule(
      new CheqdModuleConfig({
        networks: [
          {
            network: 'testnet',
            cosmosPayerSeed:
              'robust across amount corn curve panther opera wish toe ring bleak empower wreck party abstract glad average muffin picnic jar squeeze annual long aunt',
          },
        ],
      })
    ),
    dids: new DidsModule({
      resolvers: [new IndyVdrIndyDidResolver(), new CheqdDidResolver(), new HederaDidResolver()],
      registrars: [new CheqdDidRegistrar(), new HederaDidRegistrar()],
    }),
    askar: new AskarModule({
      askar,
      store: askarStoreConfig,
    }),
    hedera: new HederaModule({
      networks: [
        {
          network: (process.env.HEDERA_NETWORK as HederaNetwork) ?? 'testnet',
          operatorId: process.env.HEDERA_OPERATOR_ID ?? '0.0.5489553',
          operatorKey:
            process.env.HEDERA_OPERATOR_KEY ??
            '302e020100300506032b6570042204209f54b75b6238ced43e41b1463999cb40bf2f7dd2c9fd4fd3ef780027c016a138',
        },
      ],
    }),
  } as const
}
