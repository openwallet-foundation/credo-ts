import type { Alice } from './alice'
import type { AliceInquirer } from './alice_inquirer'
import type { Faber } from './faber'
import type { FaberInquirer } from './faber_inquirer'
import type {
  Agent,
  CredentialStateChangedEvent,
  ProofStateChangedEvent,
  BasicMessageStateChangedEvent,
  ProofRecord,
  CredentialRecord,
} from '@aries-framework/core'
import type BottomBar from 'inquirer/lib/ui/bottom-bar'

import {
  CredentialState,
  ProofState,
  BasicMessageEventTypes,
  ProofEventTypes,
  CredentialEventTypes,
} from '@aries-framework/core'
import { ui } from 'inquirer'

import { Color } from './output_class'

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
    if (credentialRecord.credentialAttributes !== undefined) {
      const attribute = credentialRecord.credentialAttributes
      console.log('\n\nCredential preview:')
      attribute.forEach((element) => {
        console.log(`${Color.purlpe}${element.name} ${Color.reset}${element.value}`)
      })
    }
  }

  private async newCredentialPrompt(credentialRecord: CredentialRecord, aliceInquirer: AliceInquirer) {
    this.printCredentialAttributes(credentialRecord)
    this.turnListenerOn()
    await aliceInquirer.acceptCredentialOffer(credentialRecord)
    this.turnListenerOff()
    aliceInquirer.processAnswer()
  }

  public credentialOfferListener(alice: Alice, aliceInquirer: AliceInquirer) {
    alice.agent.events.on(
      CredentialEventTypes.CredentialStateChanged,
      async ({ payload }: CredentialStateChangedEvent) => {
        if (payload.credentialRecord.state === CredentialState.OfferReceived) {
          await this.newCredentialPrompt(payload.credentialRecord, aliceInquirer)
        }
        return
      }
    )
  }

  public messageListener(agent: Agent, name: string) {
    agent.events.on(BasicMessageEventTypes.BasicMessageStateChanged, async (event: BasicMessageStateChangedEvent) => {
      if (event.payload.basicMessageRecord.role === 'receiver') {
        this.ui.updateBottomBar(
          `${Color.purlpe}\n${name} received a message: ${event.payload.message.content}\n${Color.reset}`
        )
      }
      return
    })
  }

  private async newProofRequestPrompt(proofRecord: ProofRecord, aliceInquirer: AliceInquirer) {
    this.turnListenerOn()
    await aliceInquirer.acceptProofRequest(proofRecord)
    this.turnListenerOff()
    aliceInquirer.processAnswer()
  }

  public proofRequestListener(alice: Alice, aliceInquirer: AliceInquirer) {
    alice.agent.events.on(ProofEventTypes.ProofStateChanged, async ({ payload }: ProofStateChangedEvent) => {
      if (payload.proofRecord.state === ProofState.RequestReceived) {
        await this.newProofRequestPrompt(payload.proofRecord, aliceInquirer)
      }
      return
    })
  }

  public proofAcceptedListener(faber: Faber, faberInquirer: FaberInquirer) {
    faber.agent.events.on(ProofEventTypes.ProofStateChanged, async ({ payload }: ProofStateChangedEvent) => {
      if (payload.proofRecord.state === ProofState.Done) {
        faberInquirer.processAnswer()
      }
      return
    })
  }

  public async newCredentialAcceptedPrompt(faber: Faber, faberInquirer: FaberInquirer) {
    this.turnListenerOn()
    const check = await faberInquirer.exitUseCase()
    if (check === true) {
      faber.ui.updateBottomBar(`${Color.green}\nCredential offer accepted!\n${Color.reset}`)
    } else if (check === false) {
      faber.ui.updateBottomBar(`${Color.red}\nCredential offer declined\n${Color.reset}`)
    }
    this.turnListenerOff()
    faberInquirer.processAnswer()
  }

  public credentialAcceptedListener(faber: Faber, faberInquirer: FaberInquirer) {
    faber.agent.events.on(
      CredentialEventTypes.CredentialStateChanged,
      async ({ payload }: CredentialStateChangedEvent) => {
        if (payload.credentialRecord.state === CredentialState.Done) {
          this.newCredentialAcceptedPrompt(faber, faberInquirer)
        }
        return
      }
    )
  }
}
