import type { SubjectMessage } from '../../tests/transport/SubjectInboundTransport'

import 'reflect-metadata'
import { writeFile } from 'fs/promises'
import path from 'path'
import { cwd } from 'process'
import { Subject } from 'rxjs'
import { container } from 'tsyringe'

import { InMemoryStorageService } from '../../tests/InMemoryStorageService'
import { SubjectInboundTransport } from '../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../tests/transport/SubjectOutboundTransport'

import { getBaseConfig, makeConnection, prepareForIssuance, issueCredential } from './tests/helpers'
import { TestLogger } from './tests/logger'

import { Agent, AutoAcceptCredential, CredentialPreview, InjectionSymbols, LogLevel } from '@aries-framework/core'

const logger = new TestLogger(LogLevel.info)
const mediatorConnectionsToCreate = 10
const credentialsToIssue = 10

const aliceConfig = getBaseConfig('PopulateWallet', {
  logger,
  autoAcceptMediationRequests: true,
  endpoints: ['rxjs:alice'],
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
})

const faberConfig = getBaseConfig('PopulateWallet2', {
  logger,
  autoAcceptMediationRequests: true,
  endpoints: ['rxjs:faber'],
  publicDidSeed: undefined,
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
})

async function run() {
  const aliceContainer = container.createChildContainer()
  const aliceStorageService = new InMemoryStorageService()
  aliceContainer.registerInstance(InjectionSymbols.StorageService, aliceStorageService)

  const faberContainer = container.createChildContainer()
  const faberStorageService = new InMemoryStorageService()
  faberContainer.registerInstance(InjectionSymbols.StorageService, faberStorageService)

  const aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies, aliceContainer)
  const faberAgent = new Agent(faberConfig.config, faberConfig.agentDependencies, faberContainer)

  const aliceMessages = new Subject<SubjectMessage>()
  const faberMessages = new Subject<SubjectMessage>()
  const subjectMap = {
    'rxjs:faber': faberMessages,
    'rxjs:alice': aliceMessages,
  }

  aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(aliceMessages, subjectMap))
  aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))

  faberAgent.registerOutboundTransport(new SubjectOutboundTransport(faberMessages, subjectMap))
  faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))

  await aliceAgent.initialize()
  await faberAgent.initialize()

  try {
    for (let i = 0; i < mediatorConnectionsToCreate / 2; i++) {
      await populateMediation(aliceAgent, faberAgent)
    }

    for (let i = 0; i < mediatorConnectionsToCreate / 2; i++) {
      await populateMediation(faberAgent, aliceAgent)
    }

    const { definition } = await prepareForIssuance(aliceAgent, ['name', 'age', 'dateOfBirth'])

    for (let i = 0; i < credentialsToIssue; i++) {
      await populateCredential(aliceAgent, faberAgent, definition.id)
    }
  } catch (error) {
    await faberAgent.shutdown()
    // await faberAgent.shutdown({ deleteWallet: true })
    // await aliceAgent.shutdown({ deleteWallet: true })

    throw error
  }

  await writeFile(path.join(cwd(), 'alice.json'), JSON.stringify(aliceStorageService.records, null, 2))
  await writeFile(path.join(cwd(), 'faber.json'), JSON.stringify(faberStorageService.records, null, 2))

  await faberAgent.shutdown()
  await aliceAgent.shutdown()
}

async function populateMediation(mediatorAgent: Agent, recipientAgent: Agent) {
  const [, recipientMediatorConnection] = await makeConnection(mediatorAgent, recipientAgent)

  await recipientAgent.mediationRecipient.requestAndAwaitGrant(recipientMediatorConnection)
}

async function populateCredential(issuerAgent: Agent, holderAgent: Agent, credentialDefinitionId: string) {
  const [issuerHolderConnection] = await makeConnection(issuerAgent, holderAgent)

  await issueCredential({
    issuerAgent,
    holderAgent,
    issuerConnectionId: issuerHolderConnection.id,
    credentialTemplate: {
      credentialDefinitionId,
      preview: CredentialPreview.fromRecord({
        name: 'Alice',
        age: '25',
        dateOfBirth: '2020-01-01',
      }),
    },
  })
}

run()
