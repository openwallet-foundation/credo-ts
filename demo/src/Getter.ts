/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { Transport } from '@aries-framework/core'
import type { ValueTransferConfig } from '@aries-framework/core/src/types'

import { ValueTransferRole } from '@aries-framework/core/src/modules/value-transfer'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class Getter extends BaseAgent {
  public valueTransferRecordId?: string
  public connectionRecordWitnessId?: string
  public connected: boolean
  public static transport: Transport = 'ipc'

  public constructor(
    name: string,
    port?: number,
    offlineTransports?: string[],
    valueTransferConfig?: ValueTransferConfig
  ) {
    super(name, port, offlineTransports, valueTransferConfig)
    this.connected = false
  }

  public static async build(): Promise<Getter> {
    const valueTransferConfig: ValueTransferConfig = {
      role: ValueTransferRole.Getter,
    }
    const getter = new Getter('getter', undefined, [Getter.transport], valueTransferConfig)
    await getter.initializeAgent()
    return getter
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
    const invite = await this.agent.connections.createConnection({
      transport: Getter.transport,
    })
    this.connectionRecordWitnessId = invite.connectionRecord.id

    console.log(Output.ConnectionLink, invite.invitation.toUrl({ domain: `http://localhost:${this.port}` }), '\n')
    return invite.connectionRecord
  }

  private async waitForConnection() {
    const connectionRecord = await this.getConnectionRecord()

    console.log('Waiting for Witness to finish connection...')
    try {
      await this.agent.connections.returnWhenIsConnected(connectionRecord.id)
    } catch (e) {
      console.log(redText(`\nTimeout of 20 seconds reached.. Returning to home screen.\n`))
      return
    }
    console.log(greenText(Output.ConnectionEstablished))
    this.connected = true
  }

  private async waitForPayment() {
    const valueTransferRecord = await this.getValueTransferRecord()

    console.log('Waiting for Giver to pay...')
    try {
      const record = await this.agent.valueTransfer.returnWhenIsCompleted(valueTransferRecord.id)
      console.log(greenText(Output.PaymentReceived))
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
  //   console.log(Output.ConnectionLink, JsonEncoder.toString(invite.connectionRecord.didDoc), '\n')
  //   console.log(Output.ConnectionLink, JsonEncoder.toString(invite.invitation), '\n')
  //   return invite.connectionRecord
  // }

  public async requestPayment(giver: string) {
    if (!this.connectionRecordWitnessId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }
    const { record } = await this.agent.valueTransfer.requestPayment(this.connectionRecordWitnessId, 10, giver)
    this.valueTransferRecordId = record.id
    console.log(greenText('\nRequest Sent!\n'))
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
