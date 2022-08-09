/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ValueTransferRecord } from '@aries-framework/core'

import { DidMarker, Transports, ValueTransferState } from '@aries-framework/core'
import { createVerifiableNotes } from '@sicpa-dlab/value-transfer-protocol-ts'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class Giver extends BaseAgent {
  public valueTransferRecordId?: string

  public constructor(name: string, port?: number) {
    super({
      name,
      port,
      transports: [Transports.Nearby, Transports.NFC, Transports.HTTP, Transports.WS],
      mediatorConnectionsInvite: BaseAgent.defaultMediatorConnectionInvite,
      staticDids: [
        {
          seed: '9ad6a1e205a549dc86ced47630ed7b78',
          marker: DidMarker.Online,
        },
      ],
      valueTransferConfig: {
        verifiableNotes: createVerifiableNotes(10),
      },
    })
  }

  public static async build(): Promise<Giver> {
    const giver = new Giver('giver', undefined)
    await giver.initializeAgent()

    const publicDid = await giver.agent.getStaticDid(DidMarker.Online)
    console.log(`Giver Public DID: ${publicDid?.did}`)

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
    const { record } = await this.agent.valueTransfer.offerPayment({
      amount: 1,
      getter,
      transport: Transports.NFC,
    })
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
