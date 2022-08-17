import type {
  ConnectionRecord,
  ConnectionStateChangedEvent,
  CredentialExchangeRecord,
  ProofRecord,
} from '@aries-framework/core'

import { ConnectionEventTypes } from '@aries-framework/core'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class Alice extends BaseAgent {
  public outOfBandId?: string
  public connected: boolean

  public constructor(port: number, name: string) {
    super(port, name)
    this.connected = false
  }

  public static async build(): Promise<Alice> {
    const alice = new Alice(9000, 'alice')
    await alice.initializeAgent()
    return alice
  }

  private async getConnectionRecord() {
    if (!this.outOfBandId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }

    const [connection] = await this.agent.connections.findAllByOutOfBandId(this.outOfBandId)

    if (!connection) {
      throw Error(redText(Output.MissingConnectionRecord))
    }

    return connection
  }

  private async printConnectionInvite() {
    const outOfBand = await this.agent.oob.createInvitation()
    this.outOfBandId = outOfBand.id

    console.log(
      Output.ConnectionLink,
      outOfBand.outOfBandInvitation.toUrl({ domain: `http://localhost:${this.port}` }),
      '\n'
    )
  }

  private async waitForConnection() {
    if (!this.outOfBandId) {
      throw new Error(redText(Output.MissingConnectionRecord))
    }

    console.log('Waiting for Faber to finish connection...')

    const getConnectionRecord = (outOfBandId: string) =>
      new Promise<ConnectionRecord>((resolve, reject) => {
        // Timeout of 20 seconds
        const timeoutId = setTimeout(() => reject(new Error(redText(Output.MissingConnectionRecord))), 20000)

        // Start listener
        this.agent.events.on<ConnectionStateChangedEvent>(ConnectionEventTypes.ConnectionStateChanged, (e) => {
          if (e.payload.connectionRecord.outOfBandId !== outOfBandId) return

          clearTimeout(timeoutId)
          resolve(e.payload.connectionRecord)
        })

        // Also retrieve the connection record by invitation if the event has already fired
        void this.agent.connections.findAllByOutOfBandId(outOfBandId).then(([connectionRecord]) => {
          if (connectionRecord) {
            clearTimeout(timeoutId)
            resolve(connectionRecord)
          }
        })
      })

    const connectionRecord = await getConnectionRecord(this.outOfBandId)

    try {
      await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    } catch (e) {
      console.log(redText(`\nTimeout of 20 seconds reached.. Returning to home screen.\n`))
      return
    }
    console.log(greenText(Output.ConnectionEstablished))
    this.connected = true
  }

  public async setupConnection() {
    await this.printConnectionInvite()
    await this.waitForConnection()
  }

  public async acceptCredentialOffer(credentialRecord: CredentialExchangeRecord) {
    await this.agent.credentials.acceptOffer({
      credentialRecordId: credentialRecord.id,
    })
  }

  public async acceptProofRequest(proofRecord: ProofRecord) {
    const requestedCredentials = await this.agent.proofs.autoSelectCredentialsForProofRequest({
      proofRecordId: proofRecord.id,
      config: {
        filterByPresentationPreview: true,
      },
    })

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
