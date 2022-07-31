import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'
import type { ConnectionRecord } from '../src'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { Agent } from '../src'
import { ActionMenuRole } from '../src/modules/action-menu/ActionMenuRole'
import { ActionMenuState } from '../src/modules/action-menu/ActionMenuState'
import { ActionMenu } from '../src/modules/action-menu/models'
import { ActionMenuRecord } from '../src/modules/action-menu/repository'

import { getBaseConfig, makeConnection, waitForActionMenuRecord } from './helpers'
import testLogger from './logger'

const faberConfig = getBaseConfig('Faber Action Menu', {
  endpoints: ['rxjs:faber'],
})

const aliceConfig = getBaseConfig('Alice Action Menu', {
  endpoints: ['rxjs:alice'],
  logger: testLogger,
})

describe('Action Menu', () => {
  let faberAgent: Agent
  let aliceAgent: Agent
  let faberConnection: ConnectionRecord
  let aliceConnection: ConnectionRecord

  beforeAll(async () => {
    const faberMessages = new Subject<SubjectMessage>()
    const aliceMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:faber': faberMessages,
      'rxjs:alice': aliceMessages,
    }

    faberAgent = new Agent(faberConfig.config, faberConfig.agentDependencies)
    faberAgent.registerInboundTransport(new SubjectInboundTransport(faberMessages))
    faberAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await faberAgent.initialize()

    aliceAgent = new Agent(aliceConfig.config, aliceConfig.agentDependencies)
    aliceAgent.registerInboundTransport(new SubjectInboundTransport(aliceMessages))
    aliceAgent.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await aliceAgent.initialize()
    ;[aliceConnection, faberConnection] = await makeConnection(aliceAgent, faberAgent)
  })

  afterAll(async () => {
    await faberAgent.shutdown()
    await faberAgent.wallet.delete()
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
  })

  test('Alice requests menu to Faber and selects an option once received', async () => {
    testLogger.test('Alice sends menu request to Faber')
    let aliceActionMenuRecord = await aliceAgent.actionMenu.requestMenu({ connectionId: aliceConnection.id })

    testLogger.test('Faber waits for menu request from Alice')
    await waitForActionMenuRecord(faberAgent, {
      state: ActionMenuState.PreparingRootMenu,
    })

    const menu = new ActionMenu({
      title: 'Welcome',
      description: 'This is the root menu',
      options: [
        {
          name: 'option-1',
          description: 'Option 1 description',
          title: 'Option 1',
        },
        {
          name: 'option-2',
          description: 'Option 2 description',
          title: 'Option 2',
        },
      ],
    })
    testLogger.test('Faber sends root menu to Alice')
    await faberAgent.actionMenu.sendMenu({ connectionId: faberConnection.id, menu })

    testLogger.test('Alice waits until she receives menu')
    aliceActionMenuRecord = await waitForActionMenuRecord(aliceAgent, {
      state: ActionMenuState.PreparingSelection,
    })

    expect(aliceActionMenuRecord.menu).toEqual(menu)
    const faberActiveMenu = await faberAgent.actionMenu.findActiveMenu({
      connectionId: faberConnection.id,
      role: ActionMenuRole.Responder,
    })
    expect(faberActiveMenu).toBeInstanceOf(ActionMenuRecord)
    expect(faberActiveMenu?.state).toBe(ActionMenuState.AwaitingSelection)

    testLogger.test('Alice selects menu item')
    await aliceAgent.actionMenu.performAction({
      connectionId: aliceConnection.id,
      performedAction: { name: 'option-1' },
    })

    testLogger.test('Faber waits for menu selection from Alice')
    await waitForActionMenuRecord(faberAgent, {
      state: ActionMenuState.Done,
    })

    // Related Alice's Action Menu Record state should be changed
    aliceAgent.actionMenu.findActiveMenu({ connectionId: aliceConnection.id, role: ActionMenuRole.Responder })

    // As Alice has responded, menu should be closed (done state)
    const aliceActiveMenu = await faberAgent.actionMenu.findActiveMenu({
      connectionId: faberConnection.id,
      role: ActionMenuRole.Responder,
    })
    expect(aliceActiveMenu).toBeInstanceOf(ActionMenuRecord)
    expect(aliceActiveMenu?.state).toBe(ActionMenuState.Done)
  })
})
