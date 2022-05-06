/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ValueTransferRecord } from '@aries-framework/core/src/modules/value-transfer'
import type { ValueTransferConfig } from '@aries-framework/core/src/types'

import { ValueTransferRole } from '@aries-framework/core/src/modules/value-transfer'
import { createVerifiableNotes } from '@value-transfer/value-transfer-lib'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class Giver extends BaseAgent {
  public valueTransferRecordId?: string
  public connectionRecordWitnessId?: string
  public connected: boolean

  public constructor(port: number, name: string, valueTransferConfig: ValueTransferConfig) {
    super(port, name, valueTransferConfig)
    this.connected = false
  }

  public static async build(): Promise<Giver> {
    const valueTransferConfig: ValueTransferConfig = {
      role: ValueTransferRole.Giver,
      verifiableNotes: createVerifiableNotes(10),
    }
    const giver = new Giver(9001, 'giver', valueTransferConfig)
    await giver.initializeAgent()
    return giver
  }

  private async getConnectionRecord() {
    if (!this.connectionRecordWitnessId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }
    return await this.agent.connections.getById(this.connectionRecordWitnessId)
  }

  private async getValueTransferRecord() {
    if (!this.valueTransferRecordId) {
      throw Error(redText(Output.MissingValueTransferRecord))
    }
    return await this.agent.valueTransfer.getById(this.valueTransferRecordId)
  }

  private async printConnectionInvite() {
    const invite = await this.agent.connections.createConnection()
    this.connectionRecordWitnessId = invite.connectionRecord.id

    console.log(Output.ConnectionLink, invite.invitation.toUrl({ domain: `http://localhost:${this.port}` }), '\n')
    return invite.connectionRecord
  }

  private async waitForConnection() {
    const connectionRecord = await this.getConnectionRecord()

    console.log('Waiting for Witness to finish connection...')
    try {
      await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
      const giverConnectionRecord = await this.getConnectionRecord()
      console.log('Giver DID: ' + giverConnectionRecord.did)
    } catch (e) {
      console.log(redText(`\nTimeout of 20 seconds reached.. Returning to home screen.\n`))
      return
    }
    console.log(greenText(Output.ConnectionEstablished))
    this.connected = true
  }

  private async waitForPayment() {
    const valueTransferRecord = await this.getValueTransferRecord()

    console.log('Waiting for finishing payment...')
    try {
      const record = await this.agent.valueTransfer.returnWhenIsCompleted(valueTransferRecord.id)
      console.log(greenText(Output.PaymentDone))
      console.log(greenText('Receipt:'))
      console.log(record.receiptMessage)
      const balance = await this.agent.valueTransfer.getBalance()
      console.log(greenText('Balance: ' + balance))
    } catch (e) {
      console.log(redText(`\nTimeout of 120 seconds reached.. Returning to home screen.\n`))
      return
    }
  }

  public async setupConnection() {
    await this.printConnectionInvite()
    await this.waitForConnection()
  }

  // private async printConnectionInvite() {
  //   const invite = await this.agent.connections.createOutOfBandConnection({
  //     goalCode: 'pay.cash.vtp',
  //     accept: ['didcomm/v2'],
  //   })
  //   this.connectionRecordWitnessId = invite.connectionRecord.id
  //   console.log(Output.ConnectionLink, JsonEncoder.toString(invite.invitation), '\n')
  //   return invite.invitation
  // }

  public async acceptPaymentRequest(valueTransferRecord: ValueTransferRecord) {
    const { record } = await this.agent.valueTransfer.acceptPaymentRequest(valueTransferRecord.id)
    this.valueTransferRecordId = record.id
    console.log(greenText('\nPayment request accepted!\n'))
    await this.waitForPayment()
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
