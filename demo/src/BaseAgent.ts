import { AnonCredsModule } from '@credo-ts/anoncreds'
import {
  AnonCredsDidCommCredentialFormatService,
  AnonCredsDidCommProofFormatService,
} from '@credo-ts/anoncreds/didcomm'
import type { AskarModuleConfigStoreOptions } from '@credo-ts/askar'
import { AskarModule } from '@credo-ts/askar'
import { CheqdDidRegistrar, CheqdDidResolver, CheqdModule, CheqdModuleConfig } from '@credo-ts/cheqd'
import { CheqdAnonCredsRegistry } from '@credo-ts/cheqd/anoncreds'
import { Agent, DidsModule } from '@credo-ts/core'
import type { DidCommModuleConfigOptions, DidCommVersion } from '@credo-ts/didcomm'
import {
  DidCommAutoAcceptCredential,
  DidCommAutoAcceptProof,
  DidCommCredentialV2Protocol,
  DidCommHttpOutboundTransport,
  DidCommModule,
  DidCommProofV2Protocol,
} from '@credo-ts/didcomm'
import { HederaDidRegistrar, HederaDidResolver, HederaModule } from '@credo-ts/hedera'
import { HederaAnonCredsRegistry } from '@credo-ts/hedera/anoncreds'
import { agentDependencies, DidCommHttpInboundTransport } from '@credo-ts/node'
import type { HederaNetwork } from '@hiero-did-sdk/client'
import { NativeAnoncreds } from '@hyperledger/anoncreds-nodejs'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import { greenText } from './OutputClass'

const didcommVersion: DidCommVersion = process.env.DIDCOMM_VERSION === 'v2' ? 'v2' : 'v1'

type DemoAgent = Agent<ReturnType<typeof getAskarAnonCredsModules>>

export class BaseAgent {
  public port: number
  public name: string
  public agent: DemoAgent
  public didcommVersion: DidCommVersion

  public constructor({ port, name }: { port: number; name: string }) {
    this.name = name
    this.port = port
    this.didcommVersion = didcommVersion

    this.agent = new Agent({
      config: {},
      dependencies: agentDependencies,
      modules: getAskarAnonCredsModules(
        {
          endpoints: [`http://localhost:${this.port}`],
          transports: {
            inbound: [new DidCommHttpInboundTransport({ port })],
            outbound: [new DidCommHttpOutboundTransport()],
          },
        },
        { id: name, key: name },
        { didcommVersion }
      ),
    })
  }

  public async initializeAgent() {
    await this.agent.initialize()

    console.log(greenText(`\nAgent ${this.name} created! (DIDComm ${this.didcommVersion})\n`))
  }
}

function getAskarAnonCredsModules(
  didcommConfig: Omit<DidCommModuleConfigOptions, 'credentials' | 'proofs' | 'connections'>,
  askarStoreConfig: AskarModuleConfigStoreOptions,
  options?: { didcommVersion?: DidCommVersion }
) {
  return {
    didcomm: new DidCommModule({
      ...didcommConfig,
      didcommVersions: [options?.didcommVersion ?? 'v1'],
      connections: {
        autoAcceptConnections: true,
        autoCreateConnectionOnFirstMessage: true,
      },
      credentials: {
        autoAcceptCredentials: DidCommAutoAcceptCredential.ContentApproved,
        credentialProtocols: [
          new DidCommCredentialV2Protocol({
            credentialFormats: [new AnonCredsDidCommCredentialFormatService()],
          }),
        ],
      },
      proofs: {
        autoAcceptProofs: DidCommAutoAcceptProof.ContentApproved,
        proofProtocols: [
          new DidCommProofV2Protocol({
            proofFormats: [new AnonCredsDidCommProofFormatService()],
          }),
        ],
      },
    }),
    anoncreds: new AnonCredsModule({
      registries: [new CheqdAnonCredsRegistry(), new HederaAnonCredsRegistry()],
      anoncreds: NativeAnoncreds,
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
      resolvers: [new CheqdDidResolver(), new HederaDidResolver()],
      registrars: [new CheqdDidRegistrar(), new HederaDidRegistrar()],
    }),
    askar: new AskarModule({
      askar: NativeAskar,
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
