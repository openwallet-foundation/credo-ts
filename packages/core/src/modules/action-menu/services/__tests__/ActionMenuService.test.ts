import type { AgentConfig } from '../../../../agent/AgentConfig'
import type { Repository } from '../../../../storage/Repository'
import type { ActionMenuStateChangedEvent } from '../../ActionMenuEvents'
import type { ActionMenuSelection } from '../../models'

import { getAgentConfig, getMockConnection, mockFunction } from '../../../../../tests/helpers'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { DidExchangeState } from '../../../connections'
import { ActionMenuEventTypes } from '../../ActionMenuEvents'
import { ActionMenuRole } from '../../ActionMenuRole'
import { ActionMenuState } from '../../ActionMenuState'
import { ActionMenu } from '../../models'
import { ActionMenuRecord, ActionMenuRepository } from '../../repository'
import { ActionMenuService } from '../ActionMenuService'

jest.mock('../../repository/ActionMenuRepository')
const ActionMenuRepositoryMock = ActionMenuRepository as jest.Mock<ActionMenuRepository>

describe('ActionMenuService', () => {
  const mockConnectionRecord = getMockConnection({
    id: 'd3849ac3-c981-455b-a1aa-a10bea6cead8',
    did: 'did:sov:C2SsBf5QUQpqSAQfhu3sd2',
    state: DidExchangeState.Completed,
  })

  let actionMenuRepository: Repository<ActionMenuRecord>
  let actionMenuService: ActionMenuService
  let eventEmitter: EventEmitter
  let agentConfig: AgentConfig

  const mockActionMenuRecord = (options: {
    connectionId: string
    role: ActionMenuRole
    state: ActionMenuState
    threadId: string
    menu?: ActionMenu
    performedAction?: ActionMenuSelection
  }) => {
    return new ActionMenuRecord({
      connectionId: options.connectionId,
      role: options.role,
      state: options.state,
      threadId: options.threadId,
      menu: options.menu,
      performedAction: options.performedAction,
    })
  }

  beforeAll(async () => {
    agentConfig = getAgentConfig('ActionMenuServiceTest')
  })

  beforeEach(async () => {
    actionMenuRepository = new ActionMenuRepositoryMock()
    eventEmitter = new EventEmitter(agentConfig)
    actionMenuService = new ActionMenuService(actionMenuRepository, agentConfig, eventEmitter)
  })

  describe('createMenu', () => {
    let mockRecord: ActionMenuRecord
    let testMenu: ActionMenu

    beforeAll(() => {
      testMenu = new ActionMenu({
        description: 'menu-description',
        title: 'menu-title',
        options: [{ name: 'opt1', title: 'opt1-title', description: 'opt1-desc' }],
      })

      mockRecord = mockActionMenuRecord({
        connectionId: mockConnectionRecord.id,
        role: ActionMenuRole.Requester,
        state: ActionMenuState.PreparingSelection,
        threadId: '123',
        menu: testMenu,
      })
    })

    it(`throws an error when invalid selection is provided`, async () => {
      expect(
        actionMenuService.createPerform({ actionMenuRecord: mockRecord, performedAction: { name: 'fake' } })
      ).rejects.toThrowError('Selection does not match valid actions')
    })

    it(`throws an error when duplicated options are specified`, async () => {
      expect(
        actionMenuService.createMenu({
          connection: mockConnectionRecord,
          menu: {
            title: 'menu-title',
            description: 'menu-description',
            options: [
              { name: 'opt1', description: 'desc1', title: 'title1' },
              { name: 'opt2', description: 'desc2', title: 'title2' },
              { name: 'opt1', description: 'desc3', title: 'title3' },
              { name: 'opt4', description: 'desc4', title: 'title4' },
            ],
          },
        })
      ).rejects.toThrowError('Action Menu contains duplicated options')
    })

    it(`no previous menu: emits a menu with title, description and options`, async () => {
      // No previous menu
      mockFunction(actionMenuRepository.findSingleByQuery).mockReturnValue(Promise.resolve(null))

      const eventListenerMock = jest.fn()
      eventEmitter.on<ActionMenuStateChangedEvent>(ActionMenuEventTypes.ActionMenuStateChanged, eventListenerMock)

      await actionMenuService.createMenu({
        connection: mockConnectionRecord,
        menu: testMenu,
      })

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: ActionMenuEventTypes.ActionMenuStateChanged,
        payload: {
          previousState: null,
          actionMenuRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            role: ActionMenuRole.Responder,
            state: ActionMenuState.AwaitingSelection,
            menu: expect.objectContaining({
              description: 'menu-description',
              title: 'menu-title',
              options: [{ name: 'opt1', title: 'opt1-title', description: 'opt1-desc' }],
            }),
          }),
        },
      })
    })

    it(`existing menu: emits a menu with title, description, options and thread`, async () => {
      // Previous menu is in Done state
      const previousMenuDone = mockActionMenuRecord({
        connectionId: mockConnectionRecord.id,
        role: ActionMenuRole.Responder,
        state: ActionMenuState.Done,
        threadId: 'threadId-1',
      })

      mockFunction(actionMenuRepository.findSingleByQuery).mockReturnValue(Promise.resolve(previousMenuDone))

      const eventListenerMock = jest.fn()
      eventEmitter.on<ActionMenuStateChangedEvent>(ActionMenuEventTypes.ActionMenuStateChanged, eventListenerMock)

      await actionMenuService.createMenu({
        connection: mockConnectionRecord,
        menu: testMenu,
      })

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: ActionMenuEventTypes.ActionMenuStateChanged,
        payload: {
          previousState: ActionMenuState.Done,
          actionMenuRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            threadId: 'threadId-1',
            role: ActionMenuRole.Responder,
            state: ActionMenuState.AwaitingSelection,
            menu: expect.objectContaining({
              description: 'menu-description',
              title: 'menu-title',
              options: [{ name: 'opt1', title: 'opt1-title', description: 'opt1-desc' }],
            }),
          }),
        },
      })
    })

    it(`existing menu, cleared: emits a menu with title, description, options and new thread`, async () => {
      // Previous menu is in Done state
      const previousMenuClear = mockActionMenuRecord({
        connectionId: mockConnectionRecord.id,
        role: ActionMenuRole.Responder,
        state: ActionMenuState.Null,
        threadId: 'threadId-1',
      })

      mockFunction(actionMenuRepository.findSingleByQuery).mockReturnValue(Promise.resolve(previousMenuClear))

      const eventListenerMock = jest.fn()
      eventEmitter.on<ActionMenuStateChangedEvent>(ActionMenuEventTypes.ActionMenuStateChanged, eventListenerMock)

      await actionMenuService.createMenu({
        connection: mockConnectionRecord,
        menu: testMenu,
      })

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: ActionMenuEventTypes.ActionMenuStateChanged,
        payload: {
          previousState: ActionMenuState.Null,
          actionMenuRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            threadId: expect.not.stringMatching('threadId-1'),
            role: ActionMenuRole.Responder,
            state: ActionMenuState.AwaitingSelection,
            menu: expect.objectContaining({
              description: 'menu-description',
              title: 'menu-title',
              options: [{ name: 'opt1', title: 'opt1-title', description: 'opt1-desc' }],
            }),
          }),
        },
      })
    })
  })

  describe('createPerform', () => {
    let mockRecord: ActionMenuRecord

    beforeEach(() => {
      const testMenu = new ActionMenu({
        description: 'menu-description',
        title: 'menu-title',
        options: [
          { name: 'opt1', title: 'opt1-title', description: 'opt1-desc' },
          { name: 'opt2', title: 'opt2-title', description: 'opt2-desc' },
        ],
      })

      mockRecord = mockActionMenuRecord({
        connectionId: mockConnectionRecord.id,
        role: ActionMenuRole.Requester,
        state: ActionMenuState.PreparingSelection,
        threadId: '123',
        menu: testMenu,
      })
    })

    it(`throws an error when invalid selection is provided`, async () => {
      expect(
        actionMenuService.createPerform({ actionMenuRecord: mockRecord, performedAction: { name: 'fake' } })
      ).rejects.toThrowError('Selection does not match valid actions')
    })

    it(`throws an error when state is not preparing-selection`, async () => {
      for (const state of Object.values(ActionMenuState).filter(
        (state) => state !== ActionMenuState.PreparingSelection
      )) {
        mockRecord.state = state
        expect(
          actionMenuService.createPerform({ actionMenuRecord: mockRecord, performedAction: { name: 'opt1' } })
        ).rejects.toThrowError(
          `Action Menu record is in invalid state ${state}. Valid states are: preparing-selection.`
        )
      }
    })

    it(`emits a menu with a valid selection and action menu record`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<ActionMenuStateChangedEvent>(ActionMenuEventTypes.ActionMenuStateChanged, eventListenerMock)

      mockFunction(actionMenuRepository.getSingleByQuery).mockReturnValue(Promise.resolve(mockRecord))

      await actionMenuService.createPerform({
        actionMenuRecord: mockRecord,
        performedAction: { name: 'opt2' },
      })

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: ActionMenuEventTypes.ActionMenuStateChanged,
        payload: {
          previousState: ActionMenuState.PreparingSelection,
          actionMenuRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            role: ActionMenuRole.Requester,
            state: ActionMenuState.Done,
            performedAction: { name: 'opt2' },
          }),
        },
      })
    })
  })

  describe('clearMenu', () => {
    let mockRecord: ActionMenuRecord

    beforeEach(() => {
      const testMenu = new ActionMenu({
        description: 'menu-description',
        title: 'menu-title',
        options: [
          { name: 'opt1', title: 'opt1-title', description: 'opt1-desc' },
          { name: 'opt2', title: 'opt2-title', description: 'opt2-desc' },
        ],
      })

      mockRecord = mockActionMenuRecord({
        connectionId: mockConnectionRecord.id,
        role: ActionMenuRole.Requester,
        state: ActionMenuState.PreparingSelection,
        threadId: '123',
        menu: testMenu,
        performedAction: { name: 'opt1' },
      })
    })

    it(`requester role: emits a cleared menu`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<ActionMenuStateChangedEvent>(ActionMenuEventTypes.ActionMenuStateChanged, eventListenerMock)

      mockRecord.role = ActionMenuRole.Requester
      mockFunction(actionMenuRepository.getSingleByQuery).mockReturnValue(Promise.resolve(mockRecord))

      await actionMenuService.clearMenu({
        actionMenuRecord: mockRecord,
      })

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: ActionMenuEventTypes.ActionMenuStateChanged,
        payload: {
          previousState: ActionMenuState.PreparingSelection,
          actionMenuRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            role: ActionMenuRole.Requester,
            state: ActionMenuState.Null,
            threadId: '',
            menu: undefined,
            performedAction: undefined,
          }),
        },
      })
    })

    it(`responder role: emits a cleared menu`, async () => {
      const eventListenerMock = jest.fn()
      eventEmitter.on<ActionMenuStateChangedEvent>(ActionMenuEventTypes.ActionMenuStateChanged, eventListenerMock)

      mockRecord.state = ActionMenuState.AwaitingSelection
      mockRecord.role = ActionMenuRole.Responder
      mockFunction(actionMenuRepository.getSingleByQuery).mockReturnValue(Promise.resolve(mockRecord))

      await actionMenuService.clearMenu({
        actionMenuRecord: mockRecord,
      })

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: ActionMenuEventTypes.ActionMenuStateChanged,
        payload: {
          previousState: ActionMenuState.AwaitingSelection,
          actionMenuRecord: expect.objectContaining({
            connectionId: mockConnectionRecord.id,
            role: ActionMenuRole.Responder,
            state: ActionMenuState.Null,
            threadId: '',
            menu: undefined,
            performedAction: undefined,
          }),
        },
      })
    })
  })
})
