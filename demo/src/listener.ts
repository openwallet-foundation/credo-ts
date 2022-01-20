import type { Alice } from './alice'
import type { AliceInquirer } from './alice_inquirer'
import type { Faber } from './faber'
import type { FaberInquirer } from './faber_inquirer'
import type {
  Agent,
  CredentialStateChangedEvent,
  ProofStateChangedEvent,
  BasicMessageStateChangedEvent,
} from '@aries-framework/core'

import {
  CredentialState,
  ProofState,
  BasicMessageEventTypes,
  ProofEventTypes,
  CredentialEventTypes,
} from '@aries-framework/core'
import inquirer from 'inquirer'

import { Color } from './output_class'

export class Listener {
  on: boolean
  ui: any

  constructor() {
    this.on = false
    this.ui = new inquirer.ui.BottomBar()
  }

  private turnListenerOn() {
    this.on = true
  }

  private turnListenerOff() {
    this.on = false
  }

  private printCredentialAttributes(payload: any) {
    console.log('\n\nCredential preview:')
    for (const attribute in payload.credentialAttributes) {
      console.log(`\n${attribute.toString}`)
    }
  }

  private async newCredentialPrompt(payload: any, aliceInquirer: AliceInquirer) {
    this.printCredentialAttributes(payload)
    this.turnListenerOn()
    await aliceInquirer.acceptCredentialOffer(payload)

    this.turnListenerOff()
    aliceInquirer.processAnswer()
  }

  credentialOfferListener(alice: Alice, aliceInquirer: AliceInquirer) {
    alice.agent.events.on(
      CredentialEventTypes.CredentialStateChanged,
      async ({ payload }: CredentialStateChangedEvent) => {
        if (payload.credentialRecord.state === CredentialState.OfferReceived) {
          await this.newCredentialPrompt(payload, aliceInquirer)
        }
        return
      }
    )
  }

  messageListener(agent: Agent, name: string) {
    agent.events.on(BasicMessageEventTypes.BasicMessageStateChanged, async (event: BasicMessageStateChangedEvent) => {
      if (event.payload.basicMessageRecord.role === 'receiver') {
        this.ui.updateBottomBar(
          `${Color.purlpe}\n${name} received a message: ${event.payload.message.content}\n${Color.reset}`
        )
      }
      return
    })
  }

  private async newProofRequestPrompt(payload: any, aliceInquirer: AliceInquirer) {
    this.turnListenerOn()
    await aliceInquirer.acceptProofRequest(payload)
    this.turnListenerOff()

    aliceInquirer.processAnswer()
  }

  proofRequestListener(alice: Alice, aliceInquirer: AliceInquirer) {
    alice.agent.events.on(ProofEventTypes.ProofStateChanged, async ({ payload }: ProofStateChangedEvent) => {
      if (payload.proofRecord.state === ProofState.RequestReceived) {
        await this.newProofRequestPrompt(payload, aliceInquirer)
      }
      return
    })
  }

  proofAcceptedListener(faber: Faber, faberInquirer: FaberInquirer) {
    faber.agent.events.on(ProofEventTypes.ProofStateChanged, async ({ payload }: ProofStateChangedEvent) => {
      if (payload.proofRecord.state === ProofState.Done || payload.proofRecord.state === ProofState.Declined) {
        faberInquirer.processAnswer()
      }
      return
    })
  }

  credentialAcceptedListener(faber: Faber, faberInquirer: FaberInquirer) {
    faber.agent.events.on(
      CredentialEventTypes.CredentialStateChanged,
      async ({ payload }: CredentialStateChangedEvent) => {
        if (
          payload.credentialRecord.state === CredentialState.Done ||
          payload.credentialRecord.state === CredentialState.Declined
        ) {
          faberInquirer.processAnswer()
        }
        return
      }
    )
  }
}
