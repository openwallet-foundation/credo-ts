import type { AskarModuleConfigStoreOptions } from '@credo-ts/askar'
import { AskarModule } from '@credo-ts/askar'
import { Agent } from '@credo-ts/core'
import type { DidCommModuleConfigOptions, DidCommVersion } from '@credo-ts/didcomm'
import {
  DidCommAutoAcceptCredential,
  DidCommAutoAcceptProof,
  DidCommCredentialV2Protocol,
  DidCommDifPresentationExchangeProofFormatService,
  DidCommHttpOutboundTransport,
  DidCommJsonLdCredentialFormatService,
  DidCommModule,
  DidCommProofV2Protocol,
} from '@credo-ts/didcomm'
import { agentDependencies, DidCommHttpInboundTransport } from '@credo-ts/node'
import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import { greenText } from './OutputClass'

const didcommVersion: DidCommVersion = process.env.DIDCOMM_VERSION === 'v2' ? 'v2' : 'v1'

type DemoAgent = Agent<ReturnType<typeof getDemoModules>>

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
      modules: getDemoModules(
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

function getDemoModules(
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
            credentialFormats: [new DidCommJsonLdCredentialFormatService()],
          }),
        ],
      },
      proofs: {
        autoAcceptProofs: DidCommAutoAcceptProof.ContentApproved,
        proofProtocols: [
          new DidCommProofV2Protocol({
            proofFormats: [new DidCommDifPresentationExchangeProofFormatService()],
          }),
        ],
      },
    }),
    askar: new AskarModule({
      askar: NativeAskar,
      store: askarStoreConfig,
    }),
  } as const
}
