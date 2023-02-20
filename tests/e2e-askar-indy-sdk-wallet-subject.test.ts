import type { SubjectMessage } from './transport/SubjectInboundTransport'

import indySdk from 'indy-sdk'
import { Subject } from 'rxjs'

import { getAgentOptions, makeConnection, waitForBasicMessage } from '../packages/core/tests/helpers'

import { AskarModule } from '@aries-framework/askar'
import { Agent, DependencyManager, InjectionSymbols } from '@aries-framework/core'
import { IndySdkModule, IndySdkStorageService, IndySdkWallet } from '@aries-framework/indy-sdk'

import { SubjectInboundTransport } from './transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from './transport/SubjectOutboundTransport'

// FIXME: Re-include in tests when Askar NodeJS wrapper performance is improved
describe.skip('E2E Askar-Indy SDK Wallet Subject tests', () => {
  let recipientAgent: Agent
  let senderAgent: Agent

  afterEach(async () => {
    if (recipientAgent) {
      await recipientAgent.shutdown()
      await recipientAgent.wallet.delete()
    }

    if (senderAgent) {
      await senderAgent.shutdown()
      await senderAgent.wallet.delete()
    }
  })

  test('Wallet Subject flow - Indy Sender / Askar Receiver ', async () => {
    // Sender is an Agent using Indy SDK Wallet
    const senderDependencyManager = new DependencyManager()
    senderDependencyManager.registerContextScoped(InjectionSymbols.Wallet, IndySdkWallet)
    senderDependencyManager.registerSingleton(InjectionSymbols.StorageService, IndySdkStorageService)
    senderAgent = new Agent(
      getAgentOptions(
        'E2E Wallet Subject Sender Indy',
        { endpoints: ['rxjs:sender'] },
        { indySdk: new IndySdkModule({ indySdk }) }
      ),
      senderDependencyManager
    )

    // Recipient is an Agent using Askar Wallet
    recipientAgent = new Agent(
      getAgentOptions(
        'E2E Wallet Subject Recipient Askar',
        { endpoints: ['rxjs:recipient'] },
        { askar: new AskarModule() }
      )
    )

    await e2eWalletTest(senderAgent, recipientAgent)
  })

  test('Wallet Subject flow - Askar Sender / Askar Recipient ', async () => {
    // Sender is an Agent using Askar Wallet
    senderAgent = new Agent(
      getAgentOptions('E2E Wallet Subject Sender Askar', { endpoints: ['rxjs:sender'] }, { askar: new AskarModule() })
    )

    // Recipient is an Agent using Askar Wallet
    recipientAgent = new Agent(
      getAgentOptions(
        'E2E Wallet Subject Recipient Askar',
        { endpoints: ['rxjs:recipient'] },
        { askar: new AskarModule() }
      )
    )

    await e2eWalletTest(senderAgent, recipientAgent)
  })

  test('Wallet Subject flow - Indy Sender / Indy Recipient ', async () => {
    // Sender is an Agent using Indy SDK Wallet
    const senderDependencyManager = new DependencyManager()
    senderDependencyManager.registerContextScoped(InjectionSymbols.Wallet, IndySdkWallet)
    senderDependencyManager.registerSingleton(InjectionSymbols.StorageService, IndySdkStorageService)
    senderAgent = new Agent(
      getAgentOptions(
        'E2E Wallet Subject Sender Indy',
        { endpoints: ['rxjs:sender'] },
        { indySdk: new IndySdkModule({ indySdk }) }
      ),
      senderDependencyManager
    )

    // Recipient is an Agent using Indy Wallet
    const recipientDependencyManager = new DependencyManager()
    recipientDependencyManager.registerContextScoped(InjectionSymbols.Wallet, IndySdkWallet)
    recipientDependencyManager.registerSingleton(InjectionSymbols.StorageService, IndySdkStorageService)
    recipientAgent = new Agent(
      getAgentOptions(
        'E2E Wallet Subject Recipient Indy',
        { endpoints: ['rxjs:recipient'] },
        { indySdk: new IndySdkModule({ indySdk }) }
      ),
      recipientDependencyManager
    )

    await e2eWalletTest(senderAgent, recipientAgent)
  })
})

export async function e2eWalletTest(senderAgent: Agent, recipientAgent: Agent) {
  const recipientMessages = new Subject<SubjectMessage>()
  const senderMessages = new Subject<SubjectMessage>()

  const subjectMap = {
    'rxjs:recipient': recipientMessages,
    'rxjs:sender': senderMessages,
  }

  // Recipient Setup
  recipientAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
  recipientAgent.registerInboundTransport(new SubjectInboundTransport(recipientMessages))
  await recipientAgent.initialize()

  // Sender Setup
  senderAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
  senderAgent.registerInboundTransport(new SubjectInboundTransport(senderMessages))
  await senderAgent.initialize()

  // Make connection between sender and recipient
  const [recipientSenderConnection, senderRecipientConnection] = await makeConnection(recipientAgent, senderAgent)
  expect(recipientSenderConnection).toBeConnectedWith(senderRecipientConnection)

  // Sender sends a basic message and Recipient waits for it
  await senderAgent.basicMessages.sendMessage(senderRecipientConnection.id, 'Hello')
  await waitForBasicMessage(recipientAgent, {
    content: 'Hello',
  })

  // Recipient sends a basic message and Sender waits for it
  await recipientAgent.basicMessages.sendMessage(recipientSenderConnection.id, 'How are you?')
  await waitForBasicMessage(senderAgent, {
    content: 'How are you?',
  })
}
