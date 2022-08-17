/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ValueTransferRecord } from '@aries-framework/core'

import { DidMarker, Transports, ValueTransferState } from '@aries-framework/core'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class CentralBankIssuer extends BaseAgent {
  public valueTransferRecordId?: string
  private static readonly witnessDid =
    'did:peer:2.Ez6LSfsT5gHMCVEya8VDwW9QbAdVUhJCKbVscrrb82SwCPKKT.Vz6MkgNdE8ad1k8cPCHnXZ6vSxrTuFauRKDzzUHLPvdsLycz5.SeyJzIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS92MSIsInQiOiJkbSIsInIiOlsiZGlkOnBlZXI6Mi5FejZMU25IUzlmM2hyTXVMck45ejZaaG83VGNCUnZTeUs3SFBqUXR3S211M29zV3dGLlZ6Nk1rcmFoQW9WTFFTOVM1R0Y1c1VLdHVkWE1lZFVTWmRkZUpoakh0QUZhVjRob1YuU1czc2ljeUk2SW1oMGRIQTZMeTlzYjJOaGJHaHZjM1E2TXpBd01DOWhjR2t2ZGpFaUxDSjBJam9pWkcwaUxDSnlJanBiWFN3aVlTSTZXeUprYVdSamIyMXRMM1l5SWwxOUxIc2ljeUk2SW5kek9pOHZiRzlqWVd4b2IzTjBPak13TURBdllYQnBMM1l4SWl3aWRDSTZJbVJ0SWl3aWNpSTZXMTBzSW1FaU9sc2laR2xrWTI5dGJTOTJNaUpkZlYwIl0sImEiOlsiZGlkY29tbS92MiJdfQ'

  public constructor(name: string, port?: number) {
    super({
      name,
      port,
      transports: [Transports.HTTP, Transports.WS],
      mediatorConnectionsInvite: BaseAgent.defaultMediatorConnectionInvite,
      staticDids: [
        {
          seed: 'ade127f2fb0b4ee3bf846f63b6006183',
          transports: [Transports.HTTP, Transports.WS],
          marker: DidMarker.Online,
        },
      ],
      valueTransferConfig: {},
    })
  }

  public static async build(): Promise<CentralBankIssuer> {
    const centralBankIssuer = new CentralBankIssuer('centralBankIssuer', undefined)
    await centralBankIssuer.initializeAgent()
    const publicDid = await centralBankIssuer.agent.getStaticDid(DidMarker.Online)
    console.log(`CentralBankIssuer Public DID: ${publicDid?.did}`)

    await centralBankIssuer.agent.valueTransfer.mintCash(10, CentralBankIssuer.witnessDid)

    const balance = await centralBankIssuer.agent.valueTransfer.getBalance()
    console.log(`CentralBankIssuer Balance: ${balance}`)

    return centralBankIssuer
  }

  public async acceptPaymentRequest(valueTransferRecord: ValueTransferRecord) {
    const { record } = await this.agent.valueTransfer.acceptPaymentRequest({ recordId: valueTransferRecord.id })
    this.valueTransferRecordId = record.id
    console.log(greenText('\nPayment request accepted!\n'))
    await this.waitForPayment()
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

  public async exit() {
    console.log(Output.Exit)
    await this.agent.shutdown()
    process.exit(0)
  }

  public async restart() {
    await this.agent.shutdown()
  }
}
