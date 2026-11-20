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
import type { Alice } from './Alice'
import type { AliceInquirer } from './AliceInquirer'
import type { Faber } from './Faber'
import type { FaberInquirer } from './FaberInquirer'

import { Color, purpleText, writeOutput } from './OutputClass'

export class Listener {
  public on: boolean

  public constructor() {
    this.on = false
  }

  private turnListenerOn() {
    this.on = true
  }

  private turnListenerOff() {
    this.on = false
  }

  private async printCredentialOffer(alice: Alice, credentialExchangeRecord: DidCommCredentialExchangeRecord) {
    const { offer } = await alice.agent.didcomm.credentials.getFormatData(credentialExchangeRecord.id)
    const credential = offer?.jsonld?.credential
    if (!credential) return

    console.log('\n\nCredential offer:')
    const issuer = typeof credential.issuer === 'string' ? credential.issuer : credential.issuer.id
    console.log(purpleText(`Issuer: ${Color.Reset}${issuer}`))
    console.log(purpleText(`Claims: ${Color.Reset}${JSON.stringify(credential.credentialSubject, null, 2)}`))
  }

  private async newCredentialPrompt(
    alice: Alice,
    credentialRecord: DidCommCredentialExchangeRecord,
    aliceInquirer: AliceInquirer
  ) {
    await this.printCredentialOffer(alice, credentialRecord)
    this.turnListenerOn()
    await aliceInquirer.acceptCredentialOffer(credentialRecord)
    this.turnListenerOff()
    await aliceInquirer.processAnswer()
  }

  public credentialOfferListener(alice: Alice, aliceInquirer: AliceInquirer) {
    alice.agent.events.on(
      DidCommCredentialEventTypes.DidCommCredentialStateChanged,
      async ({ payload }: DidCommCredentialStateChangedEvent) => {
        if (payload.credentialExchangeRecord.state !== DidCommCredentialState.OfferReceived) return

        // An offer that answers Alice's own proposal is accepted automatically.
        const { proposal } = await alice.agent.didcomm.credentials.getFormatData(payload.credentialExchangeRecord.id)
        if (proposal) return

        await this.newCredentialPrompt(alice, payload.credentialExchangeRecord, aliceInquirer)
      }
    )
  }

  public credentialProposalListener(faber: Faber) {
    faber.agent.events.on(
      DidCommCredentialEventTypes.DidCommCredentialStateChanged,
      async ({ payload }: DidCommCredentialStateChangedEvent) => {
        if (payload.credentialExchangeRecord.state === DidCommCredentialState.ProposalReceived) {
          await faber.acceptSubjectProposal(payload.credentialExchangeRecord)
        }
      }
    )
  }

  public messageListener(agent: Agent, name: string) {
    const showReceivedMessage = (content: string) => {
      writeOutput(purpleText(`\n${name} received a message: ${content}\n`))
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

  public proofDoneListener(faber: Faber) {
    faber.agent.events.on(
      DidCommProofEventTypes.ProofStateChanged,
      async ({ payload }: DidCommProofStateChangedEvent) => {
        if (payload.proofRecord.state === DidCommProofState.Done) {
          await faber.printVerifiedPresentation(payload.proofRecord.id)
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
