import type { Agent } from '@credo-ts/core'
import type {
  DidCommBasicMessageStateChangedEvent,
  DidCommBasicMessageV2StateChangedEvent,
  DidCommCredentialExchangeRecord,
  DidCommCredentialStateChangedEvent,
  DidCommProofExchangeRecord,
  DidCommProofStateChangedEvent,
} from '@credo-ts/didcomm'
import {
  DidCommBasicMessageEventTypes,
  DidCommBasicMessageRole,
  DidCommCredentialEventTypes,
  DidCommCredentialState,
  DidCommProofEventTypes,
  DidCommProofState,
} from '@credo-ts/didcomm'
import { ui } from 'inquirer'
import type BottomBar from 'inquirer/lib/ui/bottom-bar'
import type { Alice } from './Alice'
import type { AliceInquirer } from './AliceInquirer'
import type { Faber } from './Faber'
import type { FaberInquirer } from './FaberInquirer'

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

  private printCredentialAttributes(credentialExchangeRecord: DidCommCredentialExchangeRecord) {
    if (credentialExchangeRecord.credentialAttributes) {
      const attribute = credentialExchangeRecord.credentialAttributes
      console.log('\n\nCredential preview:')
      for (const element of attribute) {
        console.log(purpleText(`${element.name} ${Color.Reset}${element.value}`))
      }
    }
  }

  private async newCredentialPrompt(credentialRecord: DidCommCredentialExchangeRecord, aliceInquirer: AliceInquirer) {
    this.printCredentialAttributes(credentialRecord)
    this.turnListenerOn()
    await aliceInquirer.acceptCredentialOffer(credentialRecord)
    this.turnListenerOff()
    await aliceInquirer.processAnswer()
  }

  public credentialOfferListener(alice: Alice, aliceInquirer: AliceInquirer) {
    alice.agent.events.on(
      DidCommCredentialEventTypes.DidCommCredentialStateChanged,
      async ({ payload }: DidCommCredentialStateChangedEvent) => {
        if (payload.credentialExchangeRecord.state === DidCommCredentialState.OfferReceived) {
          await this.newCredentialPrompt(payload.credentialExchangeRecord, aliceInquirer)
        }
      }
    )
  }

  public messageListener(agent: Agent, name: string) {
    const showReceivedMessage = (content: string) => {
      this.ui.updateBottomBar(purpleText(`\n${name} received a message: ${content}\n`))
    }

    agent.events.on(
      DidCommBasicMessageEventTypes.DidCommBasicMessageStateChanged,
      async (event: DidCommBasicMessageStateChangedEvent) => {
        if (event.payload.basicMessageRecord.role === DidCommBasicMessageRole.Receiver) {
          showReceivedMessage(event.payload.message.content)
        }
      }
    )

    agent.events.on(
      DidCommBasicMessageEventTypes.DidCommBasicMessageV2StateChanged,
      async (event: DidCommBasicMessageV2StateChangedEvent) => {
        if (event.payload.basicMessageRecord.role === DidCommBasicMessageRole.Receiver) {
          showReceivedMessage(event.payload.message.content)
        }
      }
    )
  }

  private async newProofRequestPrompt(proofExchangeRecord: DidCommProofExchangeRecord, aliceInquirer: AliceInquirer) {
    this.turnListenerOn()
    await aliceInquirer.acceptProofRequest(proofExchangeRecord)
    this.turnListenerOff()
    await aliceInquirer.processAnswer()
  }

  public proofRequestListener(alice: Alice, aliceInquirer: AliceInquirer) {
    alice.agent.events.on(
      DidCommProofEventTypes.ProofStateChanged,
      async ({ payload }: DidCommProofStateChangedEvent) => {
        if (payload.proofRecord.state === DidCommProofState.RequestReceived) {
          await this.newProofRequestPrompt(payload.proofRecord, aliceInquirer)
        }
      }
    )
  }

  public proofAcceptedListener(faber: Faber, faberInquirer: FaberInquirer) {
    faber.agent.events.on(
      DidCommProofEventTypes.ProofStateChanged,
      async ({ payload }: DidCommProofStateChangedEvent) => {
        if (payload.proofRecord.state === DidCommProofState.Done) {
          await faberInquirer.processAnswer()
        }
      }
    )
  }

  public async newAcceptedPrompt(title: string, faberInquirer: FaberInquirer) {
    this.turnListenerOn()
    await faberInquirer.exitUseCase(title)
    this.turnListenerOff()
    await faberInquirer.processAnswer()
  }
}
