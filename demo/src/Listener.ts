import type { Alice } from './Alice'
import type { AliceInquirer } from './AliceInquirer'
import type { Faber } from './Faber'
import type { FaberInquirer } from './FaberInquirer'
import type {
  Agent,
  CredentialExchangeRecord,
  CredentialStateChangedEvent,
  TrustPingReceivedEvent,
  TrustPingResponseReceivedEvent,
  V2TrustPingReceivedEvent,
  V2TrustPingResponseReceivedEvent,
  ProofExchangeRecord,
  ProofStateChangedEvent,
  AgentMessageProcessedEvent,
  AgentBaseMessage,
} from '@aries-framework/core'
import type BottomBar from 'inquirer/lib/ui/bottom-bar'

import {
  V1BasicMessage,
  V2BasicMessage,
  AgentEventTypes,
  CredentialEventTypes,
  CredentialState,
  ProofEventTypes,
  ProofState,
  TrustPingEventTypes,
} from '@aries-framework/core'
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

  private printCredentialAttributes(credentialRecord: CredentialExchangeRecord) {
    if (credentialRecord.credentialAttributes) {
      const attribute = credentialRecord.credentialAttributes
      console.log('\n\nCredential preview:')
      attribute.forEach((element) => {
        console.log(purpleText(`${element.name} ${Color.Reset}${element.value}`))
      })
    }
  }

  private async newCredentialPrompt(credentialRecord: CredentialExchangeRecord, aliceInquirer: AliceInquirer) {
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

  public messageListener(agent: Agent, name: string) {
    const isBasicMessage = (message: AgentBaseMessage): message is V1BasicMessage | V2BasicMessage =>
      [V1BasicMessage.type.messageTypeUri, V2BasicMessage.type.messageTypeUri].includes(message.type)

    agent.events.on(AgentEventTypes.AgentMessageProcessed, async (event: AgentMessageProcessedEvent) => {
      const message = event.payload.message

      if (isBasicMessage(message)) {
        this.ui.updateBottomBar(purpleText(`\n${name} received a message: ${message.content}\n`))
      }
    })
  }

  public pingListener(agent: Agent, name: string) {
    agent.events.on(TrustPingEventTypes.TrustPingReceivedEvent, async (event: TrustPingReceivedEvent) => {
      this.ui.updateBottomBar(
        purpleText(`\n${name} received ping message from ${event.payload.connectionRecord?.theirDid}\n`)
      )
    })
    agent.events.on(
      TrustPingEventTypes.TrustPingResponseReceivedEvent,
      async (event: TrustPingResponseReceivedEvent) => {
        this.ui.updateBottomBar(
          purpleText(`\n${name} received ping response message from ${event.payload.connectionRecord?.theirDid}\n`)
        )
      }
    )
    agent.events.on(TrustPingEventTypes.V2TrustPingReceivedEvent, async (event: V2TrustPingReceivedEvent) => {
      this.ui.updateBottomBar(purpleText(`\n${name} received ping message from ${event.payload.message.from}\n`))
    })
    agent.events.on(
      TrustPingEventTypes.V2TrustPingResponseReceivedEvent,
      async (event: V2TrustPingResponseReceivedEvent) => {
        this.ui.updateBottomBar(
          purpleText(`\n${name} received ping response message from ${event.payload.message.from}\n`)
        )
      }
    )
  }

  private async newProofRequestPrompt(proofRecord: ProofExchangeRecord, aliceInquirer: AliceInquirer) {
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
