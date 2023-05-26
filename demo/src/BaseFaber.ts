import type { RegisterCredentialDefinitionReturnStateFinished } from '@aries-framework/anoncreds'
import type BottomBar from 'inquirer/lib/ui/bottom-bar'

import { KeyType, TypedArrayEncoder } from '@aries-framework/core'
import { ui } from 'inquirer'

import { BaseAgent, indyNetworkConfig } from './BaseAgent'
import { Output, redText } from './OutputClass'

export enum RegistryOptions {
  indy = 'did:indy',
  cheqd = 'did:cheqd',
}

export class BaseFaber extends BaseAgent {
  public outOfBandId?: string
  public credentialDefinition?: RegisterCredentialDefinitionReturnStateFinished
  public anonCredsIssuerId?: string
  public ui: BottomBar

  public constructor(port: number, name: string) {
    super({ port, name, useLegacyIndySdk: true })
    this.ui = new ui.BottomBar()
  }

  public static async build(): Promise<BaseFaber> {
    const faber = new BaseFaber(9001, 'faber')
    await faber.initializeAgent()
    return faber
  }

  public async importDid(registry: string) {
    // NOTE: we assume the did is already registered on the ledger, we just store the private key in the wallet
    // and store the existing did in the wallet
    // indy did is based on private key (seed)
    const unqualifiedIndyDid = '2jEvRuKmfBJTRa7QowDpNN'
    const cheqdDid = 'did:cheqd:testnet:d37eba59-513d-42d3-8f9f-d1df0548b675'
    const indyDid = `did:indy:${indyNetworkConfig.indyNamespace}:${unqualifiedIndyDid}`

    const did = registry === RegistryOptions.indy ? indyDid : cheqdDid
    await this.agent.dids.import({
      did,
      overwrite: true,
      privateKeys: [
        {
          keyType: KeyType.Ed25519,
          privateKey: TypedArrayEncoder.fromString('afjdemoverysercure00000000000000'),
        },
      ],
    })
    this.anonCredsIssuerId = did
  }

  protected async getConnectionRecord() {
    if (!this.outOfBandId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }

    const [connection] = await this.agent.connections.findAllByOutOfBandId(this.outOfBandId)

    if (!connection) {
      throw Error(redText(Output.MissingConnectionRecord))
    }

    return connection
  }

  protected async printConnectionInvite(version: 'v1' | 'v2') {
    const outOfBandRecord = await this.agent.oob.createInvitation({ version })
    this.outOfBandId = outOfBandRecord.id

    const outOfBandInvitation = outOfBandRecord.outOfBandInvitation || outOfBandRecord.v2OutOfBandInvitation
    if (outOfBandInvitation) {
      console.log(Output.ConnectionLink, outOfBandInvitation.toUrl({ domain: `http://localhost:${this.port}` }), '\n')
    }
  }

  public async exit() {
    console.log(Output.Exit)
    await this.agent.shutdown()
    process.exit(0)
  }

  public async restart() {
    await this.agent.shutdown()
  }
}
