/*eslint import/no-cycle: [2, { maxDepth: 1 }]*/
import type { ValueTransferRecord } from '@aries-framework/core'

import { DidMarker, Transports } from '@aries-framework/core'
import { TransactionState } from '@sicpa-dlab/value-transfer-protocol-ts'

import { BaseAgent } from './BaseAgent'
import { greenText, Output, redText } from './OutputClass'

export class CentralBankIssuer extends BaseAgent {
  public valueTransferRecordId?: string
  private static readonly witnessDid =
    'did:peer:2.Ez6LSfsT5gHMCVEya8VDwW9QbAdVUhJCKbVscrrb82SwCPKKT.Vz6MkgNdE8ad1k8cPCHnXZ6vSxrTuFauRKDzzUHLPvdsLycz5.SeyJzIjoiaHR0cDovLzE5Mi4xNjguMS4xNDU6MzAwMC9hcGkvdjEiLCJ0IjoiZG0iLCJyIjpbImRpZDpwZWVyOjIuRXo2TFNuSFM5ZjNock11THJOOXo2WmhvN1RjQlJ2U3lLN0hQalF0d0ttdTNvc1d3Ri5WejZNa3JhaEFvVkxRUzlTNUdGNXNVS3R1ZFhNZWRVU1pkZGVKaGpIdEFGYVY0aG9WLlNXM3NpY3lJNkltaDBkSEE2THk4eE9USXVNVFk0TGpFdU1UUTFPak13TURBdllYQnBMM1l4SWl3aWRDSTZJbVJ0SWl3aWNpSTZXMTE5TEhzaWN5STZJbmR6T2k4dk1Ua3lMakUyT0M0eExqRTBOVG96TURBd0wyRndhUzkyTVNJc0luUWlPaUprYlNJc0luSWlPbHRkZlYwIl19'

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

    const trustPing = await centralBankIssuer.agent.connections.sendTrustPing(CentralBankIssuer.witnessDid)
    await centralBankIssuer.agent.connections.awaitTrustPingResponse(trustPing.id)
    console.log(`Trust Ping response received from the Witness`)

    const active = await centralBankIssuer.agent.valueTransfer.getActiveTransaction()
    if (active.record?.id) {
      await centralBankIssuer.agent.valueTransfer.abortTransaction(active.record?.id)
    }

    await centralBankIssuer.agent.valueTransfer.mintCash(10, CentralBankIssuer.witnessDid)

    const balance = await centralBankIssuer.agent.valueTransfer.getBalance()
    console.log(`CentralBankIssuer Balance: ${balance}`)

    return centralBankIssuer
  }

  public async acceptPaymentRequest(valueTransferRecord: ValueTransferRecord) {
    console.log('acceptPaymentRequestacceptPaymentRequestacceptPaymentRequestacceptPaymentRequest')
    const { record } = await this.agent.valueTransfer.acceptPaymentRequest({ recordId: valueTransferRecord.id })
    this.valueTransferRecordId = record?.id
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
      if (record.state === TransactionState.Completed) {
        console.log(greenText(Output.PaymentDone))
        console.log(greenText('Receipt:'))
        console.log(record.receipt)
        const balance = await this.agent.valueTransfer.getBalance()
        console.log(greenText('Balance: ' + balance))
      }
      if (record.state === TransactionState.Failed) {
        console.log(redText('Payment Failed:'))
        console.log(record.error)
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
