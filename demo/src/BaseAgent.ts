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
import { agentDependencies, DidCommHttpInboundTransport } from '@credo-ts/node'
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
      registries: [new CheqdAnonCredsRegistry()],
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
      resolvers: [new CheqdDidResolver()],
      registrars: [new CheqdDidRegistrar()],
    }),
    askar: new AskarModule({
      askar: NativeAskar,
      store: askarStoreConfig,
    }),
  } as const
}
