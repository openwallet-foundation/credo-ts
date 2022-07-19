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
      'http://localhost:3000/api/v1?oob=eyJ0eXAiOiJhcHBsaWNhdGlvbi9kaWRjb21tLXBsYWluK2pzb24iLCJpZCI6IjMyNGJiODQzLWFlOTYtNDBlOC04OTIzLWZiZDkwOGE3YTIwNCIsImZyb20iOiJkaWQ6cGVlcjoyLkV6NkxTcHAxUHhvRTZNdW9zOGVlZGF5bVU0eEhhYWdqRkxqeVg1WFFBV3pVdjF5alguVno2TWtyTDRpY1pzQVJURE5WM0ZrUzcyVnBBc3hZMmhqbW94cmt0VzdScllwNGs5QS5TVzNzaWN5STZJbWgwZEhBNkx5OXNiMk5oYkdodmMzUTZNekF3TUM5aGNHa3ZkakVpTENKMElqb2laRzBpTENKeUlqcGJJbVJwWkRwd1pXVnlPakl1UlhvMlRGTm9Sak5FYVVoak5tSTJiMUZDY0hKT05UVnRlR05WYjA1UlRWTlVVekZtVlVkMVZIWkNRV016U0UwM2RTNVdlalpOYTJkU1NFSlpXWE5aY1VKVFRISm5OVlpPUlZaNFMyZ3pWRFJsTm1sRWVVMVZVRWhpYlVoT1dIRm5TRzV0TGxOWE0zTnBZM2xKTmtsdE5XMVplVWx6U1c1UmFVOXBTbXRpVTBselNXMUZhVTlzYzJsYVIyeHJXVEk1ZEdKVE9USk5hVXBrWmxONE4wbHVUV2xQYVVwMVdsZEdlVmx1YTJsTVEwb3dTV3B2YVZwSE1HbE1RMHBvU1dwd1lrbHRVbkJhUjA1MllsY3dkbVJxU1dsWVdERmtJbDBzSW1FaU9sc2laR2xrWTI5dGJTOTJNaUpkZlN4N0luTWlPaUp1Wm1NaUxDSjBJam9pWkcwaUxDSmhJanBiSW1ScFpHTnZiVzB2ZGpJaVhYMHNleUp6SWpvaWJtVmhjbUo1SWl3aWRDSTZJbVJ0SWl3aVlTSTZXeUprYVdSamIyMXRMM1l5SWwxOVhRIiwiYm9keSI6eyJnb2FsX2NvZGUiOiJtZWRpYXRvci1wcm92aXNpb24ifSwidHlwZSI6Imh0dHBzOi8vZGlkY29tbS5vcmcvb3V0LW9mLWJhbmQvMi4wL2ludml0YXRpb24iLCJhbGciOiJIUzI1NiJ9'
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
