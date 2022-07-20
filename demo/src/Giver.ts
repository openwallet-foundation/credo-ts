/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ValueTransferConfig, ValueTransferRecord } from '@aries-framework/core'

import { OutOfBandGoalCode, Transports, ValueTransferState } from '@aries-framework/core'
import { createVerifiableNotes } from '@sicpa-dlab/value-transfer-protocol-ts'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class Giver extends BaseAgent {
  public valueTransferRecordId?: string
  public static seed = '6b8b882e2618fa5d45ee7229ca880083'

  public constructor(
    name: string,
    port?: number,
    transports?: Transports[],
    valueTransferConfig?: ValueTransferConfig,
    mediatorConnectionsInvite?: string
  ) {
    super(name, undefined, port, transports, valueTransferConfig, mediatorConnectionsInvite)
  }

  public static async build(): Promise<Giver> {
    const valueTransferConfig: ValueTransferConfig = {
      defaultTransport: Transports.NFC,
      verifiableNotes: createVerifiableNotes(10),
    }
    const giver = new Giver(
      'giver',
      undefined,
      [Transports.NFC, Transports.Nearby, Transports.HTTP],
      valueTransferConfig,
      'http://localhost:3000/api/v1?oob=eyJ0eXAiOiJhcHBsaWNhdGlvbi9kaWRjb21tLXBsYWluK2pzb24iLCJpZCI6IjMyNGJiODQzLWFlOTYtNDBlOC04OTIzLWZiZDkwOGE3YTIwNCIsImZyb20iOiJkaWQ6cGVlcjoyLkV6NkxTcUpmbjdmeW15TE5SM0Fxc1VXbzEzZTMxc3JRcGFMOUYxb2NVbk5hc1VwOVYuVno2TWtwQnRSUGt1M0dVbUtqeU5DV2YyQnR4U0JoTmlGTWtTeGtBSlpzNnlXY24yeS5TZXlKeklqb2lhSFIwY0RvdkwyeHZZMkZzYUc5emREb3pNREF3TDJGd2FTOTJNU0lzSW5RaU9pSmtiU0lzSW5JaU9sdGRMQ0poSWpwYkltUnBaR052YlcwdmRqSWlYWDAiLCJib2R5Ijp7ImdvYWxfY29kZSI6Im1lZGlhdG9yLXByb3Zpc2lvbiJ9LCJ0eXBlIjoiaHR0cHM6Ly9kaWRjb21tLm9yZy9vdXQtb2YtYmFuZC8yLjAvaW52aXRhdGlvbiJ9'
    )
    await giver.initializeAgent()

    const test = await giver.agent.outOfBand.createInvitation({ goalCode: OutOfBandGoalCode.MediatorProvision })
    console.log(test.toUrl({ domain: 'http://localhost:3000/api/v1' }))

    return giver
  }

  private async getValueTransferRecord() {
    if (!this.valueTransferRecordId) {
      throw Error(redText(Output.MissingValueTransferRecord))
    }
    return await this.agent.valueTransfer.getById(this.valueTransferRecordId)
  }

  private async waitForPayment() {
    const valueTransferRecord = await this.getValueTransferRecord()

    console.log('Waiting for finishing payment...')
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

  public async acceptPaymentRequest(valueTransferRecord: ValueTransferRecord) {
    const { record } = await this.agent.valueTransfer.acceptPaymentRequest({ recordId: valueTransferRecord.id })
    this.valueTransferRecordId = record.id
    console.log(greenText('\nPayment request accepted!\n'))
    await this.waitForPayment()
  }

  public async abortPaymentRequest(valueTransferRecord: ValueTransferRecord) {
    const { record } = await this.agent.valueTransfer.abortTransaction(valueTransferRecord.id)
    this.valueTransferRecordId = record.id
    console.log(redText('\nPayment request rejected!\n'))
    console.log(record.problemReportMessage)
  }

  public async offerPayment(getter: string) {
    const { record } = await this.agent.valueTransfer.offerPayment({ amount: 1, getter })
    this.valueTransferRecordId = record.id
    console.log(greenText('\nOffer Sent!\n'))
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
