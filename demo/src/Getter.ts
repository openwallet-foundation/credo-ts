/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ValueTransferConfig, ValueTransferRecord } from '@aries-framework/core'

import { Transports, ValueTransferState } from '@aries-framework/core'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class Getter extends BaseAgent {
  public valueTransferRecordId?: string
  public static seed = '6b8b882e2618fa5d45ee7229ca880082'

  public constructor(
    name: string,
    port?: number,
    transports?: Transports[],
    valueTransferConfig?: ValueTransferConfig,
    mediatorConnectionsInvite?: string
  ) {
    super(name, Getter.seed, port, transports, valueTransferConfig, mediatorConnectionsInvite)
  }

  public static async build(): Promise<Getter> {
    const valueTransferConfig: ValueTransferConfig = {
      defaultTransport: Transports.HTTP,
    }
    const getter = new Getter(
      'getter',
      undefined,
      [Transports.HTTP],
      valueTransferConfig,
      'http://localhost:3000/api/v1?oob=eyJ0eXAiOiJhcHBsaWNhdGlvbi9kaWRjb21tLXBsYWluK2pzb24iLCJpZCI6IjMyNGJiODQzLWFlOTYtNDBlOC04OTIzLWZiZDkwOGE3YTIwNCIsImZyb20iOiJkaWQ6cGVlcjoyLkV6NkxTcUpmbjdmeW15TE5SM0Fxc1VXbzEzZTMxc3JRcGFMOUYxb2NVbk5hc1VwOVYuVno2TWtwQnRSUGt1M0dVbUtqeU5DV2YyQnR4U0JoTmlGTWtTeGtBSlpzNnlXY24yeS5TZXlKeklqb2lhSFIwY0RvdkwyeHZZMkZzYUc5emREb3pNREF3TDJGd2FTOTJNU0lzSW5RaU9pSmtiU0lzSW5JaU9sdGRMQ0poSWpwYkltUnBaR052YlcwdmRqSWlYWDAiLCJib2R5Ijp7ImdvYWxfY29kZSI6Im1lZGlhdG9yLXByb3Zpc2lvbiJ9LCJ0eXBlIjoiaHR0cHM6Ly9kaWRjb21tLm9yZy9vdXQtb2YtYmFuZC8yLjAvaW52aXRhdGlvbiJ9'
    )
    await getter.initializeAgent()
    const publicDid = await getter.agent.getPublicDid()
    console.log(`Getter Public DID: ${publicDid?.did}`)
    return getter
  }

  private async getValueTransferRecord() {
    if (!this.valueTransferRecordId) {
      throw Error(redText(Output.MissingValueTransferRecord))
    }
    return await this.agent.valueTransfer.getById(this.valueTransferRecordId)
  }

  public async requestPayment(giver: string, witness: string) {
    const { record } = await this.agent.valueTransfer.requestPayment({ amount: 1, giver, witness })
    this.valueTransferRecordId = record.id
    console.log(greenText('\nRequest Sent!\n'))
    await this.waitForPayment()
  }

  public async acceptPaymentOffer(valueTransferRecord: ValueTransferRecord) {
    const { record } = await this.agent.valueTransfer.acceptPaymentOffer({
      recordId: valueTransferRecord.id,
      witness: valueTransferRecord.witness?.did,
    })
    this.valueTransferRecordId = record.id
    console.log(greenText('\nPayment offer accepted!\n'))
    await this.waitForPayment()
  }

  public async abortPaymentOffer(valueTransferRecord: ValueTransferRecord) {
    const { record } = await this.agent.valueTransfer.abortTransaction(valueTransferRecord.id)
    this.valueTransferRecordId = record.id
    console.log(redText('\nPayment request rejected!\n'))
    console.log(record.problemReportMessage)
  }

  private async waitForPayment() {
    const valueTransferRecord = await this.getValueTransferRecord()

    console.log('Waiting for Giver to pay...')
    try {
      const record = await this.agent.valueTransfer.returnWhenIsCompleted(valueTransferRecord.id)
      if (record.state === ValueTransferState.Completed) {
        console.log(greenText(Output.PaymentDone))
        console.log(greenText('Receipt:'))
        console.log(record.receipt)
        const balance = await this.agent.valueTransfer.getBalance()
        console.log(greenText('Balance: ' + balance))
      }
      if (record.state === ValueTransferState.Failed) {
        console.log(redText('Payment Failed:'))
        console.log(record.problemReportMessage)
      }
    } catch (e) {
      console.log(redText(`\nTimeout of 120 seconds reached.. Returning to home screen.\n`))
      return
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
