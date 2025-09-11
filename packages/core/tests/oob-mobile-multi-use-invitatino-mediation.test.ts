import type { SubjectMessage } from '../../../tests/transport/SubjectInboundTransport'

import { Subject } from 'rxjs'

import { SubjectInboundTransport } from '../../../tests/transport/SubjectInboundTransport'
import { SubjectOutboundTransport } from '../../../tests/transport/SubjectOutboundTransport'
import { DidExchangeState } from '../../didcomm/src/modules/connections'
import {
  MediationRecipientModule,
  MediationState,
  MediatorModule,
  MediatorPickupStrategy,
} from '../../didcomm/src/modules/routing'
import { Agent } from '../src/agent/Agent'

import { DefaultDidCommModules } from '../../didcomm/src/util/modules'
import { ConsoleLogger, LogLevel } from '../src'
import { getAgentOptions, waitForBasicMessage } from './helpers'

const mobileAgent1Options = getAgentOptions(
  'OOB mediation - Mobile Agent 1',
  {
    processDidCommMessagesConcurrently: true,
  },
  { logger: new ConsoleLogger(LogLevel.debug, 'mobile1') },
  {
    mediationRecipient: new MediationRecipientModule({
      mediatorPickupStrategy: MediatorPickupStrategy.PickUpV2LiveMode,
    }),
  },
  { requireDidcomm: true }
)
const mobileAgent2Options = getAgentOptions(
  'OOB mediation - Mobile Agent 2',
  {
    processDidCommMessagesConcurrently: true,
  },
  { logger: new ConsoleLogger(LogLevel.debug, 'mobile2') },
  {
    mediationRecipient: new MediationRecipientModule({
      mediatorPickupStrategy: MediatorPickupStrategy.PickUpV2LiveMode,
    }),
  },
  { requireDidcomm: true }
)
const mediatorAgentOptions = getAgentOptions(
  'OOB mediation - Mediator Agent',
  {
    endpoints: ['rxjs:mediator'],
  },
  { logger: new ConsoleLogger(LogLevel.debug, 'mediator') },
  { mediator: new MediatorModule({ autoAcceptMediationRequests: true }) },
  { requireDidcomm: true }
)

describe('out of band with mediation', () => {
  let mobileAgent1: Agent<DefaultDidCommModules>
  let mobileAgent2: Agent<DefaultDidCommModules>
  let mediatorAgent: Agent<DefaultDidCommModules>

  beforeAll(async () => {
    const mediatorMessages = new Subject<SubjectMessage>()
    const subjectMap = {
      'rxjs:mediator': mediatorMessages,
    }

    mobileAgent1 = new Agent(mobileAgent1Options)
    mobileAgent1.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await mobileAgent1.initialize()

    mobileAgent2 = new Agent(mobileAgent2Options)
    mobileAgent2.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await mobileAgent2.initialize()

    mediatorAgent = new Agent(mediatorAgentOptions)
    mediatorAgent.modules.didcomm.registerInboundTransport(new SubjectInboundTransport(mediatorMessages))
    mediatorAgent.modules.didcomm.registerOutboundTransport(new SubjectOutboundTransport(subjectMap))
    await mediatorAgent.initialize()

    // ========== Make a connection between Mobile Agents and Mediator agents ==========
    const mediationOutOfBandRecord = await mediatorAgent.modules.oob.createInvitation({
      autoAcceptConnection: true,
      multiUseInvitation: true,
    })
    const { outOfBandInvitation: mediatorOutOfBandInvitation } = mediationOutOfBandRecord
    const mediatorUrlMessage = mediatorOutOfBandInvitation.toUrl({ domain: 'http://example.com' })

    // Mobile Agent 1 connection
    let { connectionRecord: mobileAgent1MediatorConnection } =
      await mobileAgent1.modules.oob.receiveInvitationFromUrl(mediatorUrlMessage)
    mobileAgent1MediatorConnection = await mobileAgent1.modules.connections.returnWhenIsConnected(
      mobileAgent1MediatorConnection?.id as string
    )
    expect(mobileAgent1MediatorConnection.state).toBe(DidExchangeState.Completed)

    // Mobile Agent 2 connection
    let { connectionRecord: mobileAgent2MediatorConnection } =
      await mobileAgent2.modules.oob.receiveInvitationFromUrl(mediatorUrlMessage)
    mobileAgent2MediatorConnection = await mobileAgent2.modules.connections.returnWhenIsConnected(
      mobileAgent2MediatorConnection?.id as string
    )
    expect(mobileAgent2MediatorConnection.state).toBe(DidExchangeState.Completed)

    let [mediatorMobileAgent1Connection, mediatorMobileAgent2Connection] =
      await mediatorAgent.modules.connections.findAllByOutOfBandId(mediationOutOfBandRecord.id)
    mediatorMobileAgent1Connection = await mediatorAgent.modules.connections.returnWhenIsConnected(
      mediatorMobileAgent1Connection?.id
    )
    mediatorMobileAgent2Connection = await mediatorAgent.modules.connections.returnWhenIsConnected(
      mediatorMobileAgent2Connection?.id
    )
    expect(mediatorMobileAgent1Connection.state).toBe(DidExchangeState.Completed)
    expect(mediatorMobileAgent2Connection.state).toBe(DidExchangeState.Completed)

    const mobileAgent1MediationRecord =
      await mobileAgent1.modules.mediationRecipient.provision(mobileAgent1MediatorConnection)
    expect(mobileAgent1MediationRecord.state).toBe(MediationState.Granted)

    const mobileAgent2MediationRecord =
      await mobileAgent2.modules.mediationRecipient.provision(mobileAgent2MediatorConnection)
    expect(mobileAgent2MediationRecord.state).toBe(MediationState.Granted)

    await mobileAgent1.modules.mediationRecipient.initiateMessagePickup()
    await mobileAgent2.modules.mediationRecipient.initiateMessagePickup()
  })

  afterAll(async () => {
    await mobileAgent1.shutdown()
    await mobileAgent2.shutdown()
    await mediatorAgent.shutdown()
  })

  test('the test', async () => {
    // ========== Make a connection between Alice and Faber ==========
    const outOfBandRecord = await mobileAgent1.modules.oob.createInvitation({ multiUseInvitation: true })
    let { connectionRecord: mobileAgent2MobileAgent1ConnectionRecord } =
      await mobileAgent2.modules.oob.receiveInvitation(outOfBandRecord.outOfBandInvitation)
    mobileAgent2MobileAgent1ConnectionRecord = await mobileAgent2.modules.connections.returnWhenIsConnected(
      mobileAgent2MobileAgent1ConnectionRecord?.id as string
    )
    expect(mobileAgent2MobileAgent1ConnectionRecord.state).toBe(DidExchangeState.Completed)
    let [mobileAgent1MobileAgent2ConnectionRecord] = await mobileAgent1.modules.connections.findAllByOutOfBandId(
      outOfBandRecord.id
    )
    mobileAgent1MobileAgent2ConnectionRecord = await mobileAgent1.modules.connections.returnWhenIsConnected(
      mobileAgent1MobileAgent2ConnectionRecord?.id
    )
    expect(mobileAgent1MobileAgent2ConnectionRecord.state).toBe(DidExchangeState.Completed)
    await mobileAgent2.modules.basicMessages.sendMessage(mobileAgent2MobileAgent1ConnectionRecord.id, 'hello')
    const basicMessage = await waitForBasicMessage(mobileAgent1, {})
    expect(basicMessage.content).toBe('hello')
    await new Promise((res) => setTimeout(res, 100000))
  })
})
