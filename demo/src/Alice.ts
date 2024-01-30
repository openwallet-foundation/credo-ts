import type {
  KeyDidCreateOptions,
  ConnectionRecord,
  CredentialExchangeRecord,
  ProofExchangeRecord,
  CredentialStateChangedEvent,
} from '@aries-framework/core'
import type BottomBar from 'inquirer/lib/ui/bottom-bar'

import {
  AutoAcceptCredential,
  CredentialEventTypes,
  CredentialState,
  DidsApi,
  KeyType,
  TypedArrayEncoder,
} from '@aries-framework/core'
import { randomInt } from 'crypto'
import { ui } from 'inquirer'

import { BaseAgent } from './BaseAgent'
import { Color, greenText, Output, redText } from './OutputClass'

export class Alice extends BaseAgent {
  public connected: boolean
  public connectionRecordFaberId?: string
  public did?: string
  public ui: BottomBar

  public constructor(port: number, name: string) {
    super({ port, name, useLegacyIndySdk: true })
    this.connected = false
    this.ui = new ui.BottomBar()
  }

  public static async build(): Promise<Alice> {
    const alice = new Alice(9000, 'alice' + randomInt(100000))
    await alice.initializeAgent()

    await alice.agent.modules.anoncreds.createLinkSecret({ linkSecretId: 'linkSecretId' })

    const dids = alice.agent.context.dependencyManager.resolve(DidsApi)
    const didCreateResult = await dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyType: KeyType.Ed25519 },
      secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598f') },
    })

    if (!didCreateResult.didState.did) throw new Error('failed to created did')
    return alice
  }

  private async getConnectionRecord() {
    if (!this.connectionRecordFaberId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }
    return await this.agent.connections.getById(this.connectionRecordFaberId)
  }

  private async receiveConnectionRequest(invitationUrl: string) {
    const { connectionRecord } = await this.agent.oob.receiveInvitationFromUrl(invitationUrl)
    if (!connectionRecord) {
      throw new Error(redText(Output.NoConnectionRecordFromOutOfBand))
    }
    return connectionRecord
  }

  private async waitForConnection(connectionRecord: ConnectionRecord) {
    connectionRecord = await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    this.connected = true
    console.log(greenText(Output.ConnectionEstablished))
    return connectionRecord.id
  }

  public async acceptConnection(invitation_url: string) {
    const connectionRecord = await this.receiveConnectionRequest(invitation_url)
    this.connectionRecordFaberId = await this.waitForConnection(connectionRecord)
  }

  public async acceptCredentialOffer(credentialRecord: CredentialExchangeRecord) {
    await this.agent.credentials.acceptOffer({
      autoAcceptCredential: AutoAcceptCredential.Never,
      credentialRecordId: credentialRecord.id,
      credentialFormats: {
        dataIntegrity: {
          anonCredsLinkSecretCredentialRequestOptions: {
            linkSecretId: 'linkSecretId',
          },
        },
      },
    })

    this.agent.events.on<CredentialStateChangedEvent>(CredentialEventTypes.CredentialStateChanged, async (afjEvent) => {
      const credentialRecord = afjEvent.payload.credentialRecord

      if (afjEvent.payload.credentialRecord.state !== CredentialState.CredentialReceived) return

      console.log(`\nReceived Credential. Processing and storing it!\n\n${Color.Reset}`)
      await this.agent.credentials.acceptCredential({
        credentialRecordId: credentialRecord.id,
      })
    })
  }

  public async acceptProofRequest(proofRecord: ProofExchangeRecord) {
    const requestedCredentials = await this.agent.proofs.selectCredentialsForRequest({
      proofRecordId: proofRecord.id,
    })

    const selectedCredentials = requestedCredentials.proofFormats.presentationExchange?.credentials
    if (!selectedCredentials) {
      throw new Error('No credentials found for presentation exchange')
    }

    await this.agent.proofs.acceptRequest({
      proofRecordId: proofRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    })
    console.log(greenText('\nProof request accepted!\n'))
  }

  public async sendMessage(message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.basicMessages.sendMessage(connectionRecord.id, message)
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
