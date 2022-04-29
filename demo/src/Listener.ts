import type { Alice } from './Alice'
import type { AliceInquirer } from './AliceInquirer'
import type { Faber } from './Faber'
import type { FaberInquirer } from './FaberInquirer'
import type { Giver } from './Giver'
import type { GiverInquirer } from './GiverInquirer'
import type {
  Agent,
  BasicMessageStateChangedEvent,
  CredentialRecord,
  CredentialStateChangedEvent,
  ProofRecord,
  ProofStateChangedEvent,
} from '@aries-framework/core'
import type {
  ValueTransferStateChangedEvent,
  ValueTransferRecord,
} from '@aries-framework/core/src/modules/value-transfer'
import type BottomBar from 'inquirer/lib/ui/bottom-bar'

import {
  BasicMessageEventTypes,
  BasicMessageRole,
  CredentialEventTypes,
  CredentialState,
  ProofEventTypes,
  ProofState,
} from '@aries-framework/core'
import { ValueTransferEventTypes } from '@aries-framework/core/src/modules/value-transfer'
import { ValueTransferState } from '@aries-framework/core/src/modules/value-transfer/ValueTransferState'
import { JsonEncoder } from '@aries-framework/core/src/utils'
import { ui } from 'inquirer'

import { Color, purpleText } from './OutputClass'

export class Listener {
  public on: boolean
  private ui: BottomBar

  public constructor() {
    this.on = false
    this.ui = new ui.BottomBar()
  }

  private turnListenerOn() {
    this.on = true
  }

  private turnListenerOff() {
    this.on = false
  }

  private printCredentialAttributes(credentialRecord: CredentialRecord) {
    if (credentialRecord.credentialAttributes) {
      const attribute = credentialRecord.credentialAttributes
      console.log('\n\nCredential preview:')
      attribute.forEach((element) => {
        console.log(purpleText(`${element.name} ${Color.Reset}${element.value}`))
      })
    }
  }

  private async newCredentialPrompt(credentialRecord: CredentialRecord, aliceInquirer: AliceInquirer) {
    this.printCredentialAttributes(credentialRecord)
    this.turnListenerOn()
    await aliceInquirer.acceptCredentialOffer(credentialRecord)
    this.turnListenerOff()
    await aliceInquirer.processAnswer()
  }

  public credentialOfferListener(alice: Alice, aliceInquirer: AliceInquirer) {
    alice.agent.events.on(
      CredentialEventTypes.CredentialStateChanged,
      async ({ payload }: CredentialStateChangedEvent) => {
        if (payload.credentialRecord.state === CredentialState.OfferReceived) {
          await this.newCredentialPrompt(payload.credentialRecord, aliceInquirer)
        }
      }
    )
  }

  private printRequest(valueTransferRecord: ValueTransferRecord) {
    if (valueTransferRecord.requestMessage) {
      console.log('\n\nPayment Request:')
      console.log(purpleText(JsonEncoder.toString(valueTransferRecord.requestMessage)))
    }
  }

  private async newPaymentRequestPrompt(valueTransferRecord: ValueTransferRecord, giverInquirer: GiverInquirer) {
    this.printRequest(valueTransferRecord)
    this.turnListenerOn()
    await giverInquirer.acceptPaymentRequest(valueTransferRecord)
    this.turnListenerOff()
    await giverInquirer.processAnswer()
  }

  public paymentRequesyListener(giver: Giver, giverInquirer: GiverInquirer) {
    giver.agent.events.on(
      ValueTransferEventTypes.ValueTransferStateChanged,
      async ({ payload }: ValueTransferStateChangedEvent) => {
        if (payload.record.state === ValueTransferState.RequestReceived) {
          await this.newPaymentRequestPrompt(payload.record, giverInquirer)
        }
      }
    )
  }

  public messageListener(agent: Agent, name: string) {
    agent.events.on(BasicMessageEventTypes.BasicMessageStateChanged, async (event: BasicMessageStateChangedEvent) => {
      if (event.payload.basicMessageRecord.role === BasicMessageRole.Receiver) {
        this.ui.updateBottomBar(purpleText(`\n${name} received a message: ${event.payload.message.content}\n`))
      }
    })
  }

  private async newProofRequestPrompt(proofRecord: ProofRecord, aliceInquirer: AliceInquirer) {
    this.turnListenerOn()
    await aliceInquirer.acceptProofRequest(proofRecord)
    this.turnListenerOff()
    await aliceInquirer.processAnswer()
  }

  public proofRequestListener(alice: Alice, aliceInquirer: AliceInquirer) {
    alice.agent.events.on(ProofEventTypes.ProofStateChanged, async ({ payload }: ProofStateChangedEvent) => {
      if (payload.proofRecord.state === ProofState.RequestReceived) {
        await this.newProofRequestPrompt(payload.proofRecord, aliceInquirer)
      }
    })
  }

  public proofAcceptedListener(faber: Faber, faberInquirer: FaberInquirer) {
    faber.agent.events.on(ProofEventTypes.ProofStateChanged, async ({ payload }: ProofStateChangedEvent) => {
      if (payload.proofRecord.state === ProofState.Done) {
        await faberInquirer.processAnswer()
      }
    })
  }

  public async newAcceptedPrompt(title: string, faberInquirer: FaberInquirer) {
    this.turnListenerOn()
    await faberInquirer.exitUseCase(title)
    this.turnListenerOff()
    await faberInquirer.processAnswer()
  }
}
