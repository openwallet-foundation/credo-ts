import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { ActionMenuStateChangedEvent } from '../ActionMenuEvents'
import type { ActionMenuProblemReportMessage } from '../messages'
import type {
  ClearMenuOptions,
  CreateMenuOptions,
  CreatePerformOptions,
  CreateRequestOptions,
  FindMenuOptions,
} from './ActionMenuServiceOptions'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { injectable } from '../../../plugins'
import { JsonTransformer } from '../../../utils'
import { ActionMenuEventTypes } from '../ActionMenuEvents'
import { ActionMenuRole } from '../ActionMenuRole'
import { ActionMenuState } from '../ActionMenuState'
import { ActionMenuProblemReportError } from '../errors/ActionMenuProblemReportError'
import { ActionMenuProblemReportReason } from '../errors/ActionMenuProblemReportReason'
import { PerformMessage, MenuMessage, MenuRequestMessage } from '../messages'
import { ActionMenuSelection, ActionMenu } from '../models'
import { ActionMenuRepository, ActionMenuRecord } from '../repository'

@injectable()
export class ActionMenuService {
  private actionMenuRepository: ActionMenuRepository
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(actionMenuRepository: ActionMenuRepository, agentConfig: AgentConfig, eventEmitter: EventEmitter) {
    this.actionMenuRepository = actionMenuRepository
    this.eventEmitter = eventEmitter
    this.logger = agentConfig.logger
  }

  public async createRequest(options: CreateRequestOptions) {
    // Assert
    options.connection.assertReady()

    // Create message
    const menuRequestMessage = new MenuRequestMessage({})

    // Create record if not existant for connection/role
    let actionMenuRecord = await this.find({
      connectionId: options.connection.id,
      role: ActionMenuRole.Requester,
    })

    if (actionMenuRecord) {
      // Protocol will be restarted and menu cleared
      const previousState = actionMenuRecord.state
      actionMenuRecord.state = ActionMenuState.AwaitingRootMenu
      actionMenuRecord.threadId = menuRequestMessage.id
      actionMenuRecord.menu = undefined
      actionMenuRecord.performedAction = undefined

      await this.actionMenuRepository.update(actionMenuRecord)
      this.emitStateChangedEvent(actionMenuRecord, previousState)
    } else {
      actionMenuRecord = new ActionMenuRecord({
        connectionId: options.connection.id,
        role: ActionMenuRole.Requester,
        state: ActionMenuState.AwaitingRootMenu,
        threadId: menuRequestMessage.id,
      })

      await this.actionMenuRepository.save(actionMenuRecord)
      this.emitStateChangedEvent(actionMenuRecord, null)
    }

    return { message: menuRequestMessage, record: actionMenuRecord }
  }

  public async processRequest(messageContext: InboundMessageContext<MenuRequestMessage>) {
    const { message: menuRequestMessage } = messageContext

    this.logger.debug(`Processing menu request with id ${menuRequestMessage.id}`)

    // Assert
    const connection = messageContext.assertReadyConnection()

    let actionMenuRecord = await this.find({
      connectionId: connection.id,
      role: ActionMenuRole.Responder,
    })

    if (actionMenuRecord) {
      // Protocol will be restarted and menu cleared
      const previousState = actionMenuRecord.state
      actionMenuRecord.state = ActionMenuState.PreparingRootMenu
      actionMenuRecord.threadId = menuRequestMessage.id
      actionMenuRecord.menu = undefined
      actionMenuRecord.performedAction = undefined

      await this.actionMenuRepository.update(actionMenuRecord)
      this.emitStateChangedEvent(actionMenuRecord, previousState)
    } else {
      // Create record
      actionMenuRecord = new ActionMenuRecord({
        connectionId: connection.id,
        role: ActionMenuRole.Responder,
        state: ActionMenuState.PreparingRootMenu,
        threadId: menuRequestMessage.id,
      })

      await this.actionMenuRepository.save(actionMenuRecord)
      this.emitStateChangedEvent(actionMenuRecord, null)
    }

    return actionMenuRecord
  }

  public async createMenu(options: CreateMenuOptions) {
    // Assert connection ready
    options.connection.assertReady()

    const uniqueNames = new Set(options.menu.options.map((v) => v.name))
    if (uniqueNames.size < options.menu.options.length) {
      throw new AriesFrameworkError('Action Menu contains duplicated options')
    }

    // Create message
    const menuMessage = new MenuMessage({
      title: options.menu.title,
      description: options.menu.description,
      options: options.menu.options,
    })

    // Check if there is an existing menu for this connection and role
    let actionMenuRecord = await this.find({
      connectionId: options.connection.id,
      role: ActionMenuRole.Responder,
    })

    // If so, continue existing flow
    if (actionMenuRecord) {
      actionMenuRecord.assertState([ActionMenuState.Null, ActionMenuState.PreparingRootMenu, ActionMenuState.Done])
      // The new menu will be bound to the existing thread
      // unless it is in null state (protocol reset)
      if (actionMenuRecord.state !== ActionMenuState.Null) {
        menuMessage.setThread({ threadId: actionMenuRecord.threadId })
      }

      const previousState = actionMenuRecord.state
      actionMenuRecord.menu = options.menu
      actionMenuRecord.state = ActionMenuState.AwaitingSelection
      actionMenuRecord.threadId = menuMessage.threadId

      await this.actionMenuRepository.update(actionMenuRecord)
      this.emitStateChangedEvent(actionMenuRecord, previousState)
    } else {
      // Create record
      actionMenuRecord = new ActionMenuRecord({
        connectionId: options.connection.id,
        role: ActionMenuRole.Responder,
        state: ActionMenuState.AwaitingSelection,
        menu: options.menu,
        threadId: menuMessage.id,
      })

      await this.actionMenuRepository.save(actionMenuRecord)
      this.emitStateChangedEvent(actionMenuRecord, null)
    }

    return { message: menuMessage, record: actionMenuRecord }
  }

  public async processMenu(messageContext: InboundMessageContext<MenuMessage>) {
    const { message: menuMessage } = messageContext

    this.logger.debug(`Processing action menu with id ${menuMessage.id}`)

    // Assert
    const connection = messageContext.assertReadyConnection()

    // Check if there is an existing menu for this connection and role
    const record = await this.find({
      connectionId: connection.id,
      role: ActionMenuRole.Requester,
    })

    if (record) {
      // Record found: update with menu details
      const previousState = record.state

      record.state = ActionMenuState.PreparingSelection
      record.menu = new ActionMenu({
        title: menuMessage.title,
        description: menuMessage.description,
        options: menuMessage.options,
      })
      record.threadId = menuMessage.threadId
      record.performedAction = undefined

      await this.actionMenuRepository.update(record)

      this.emitStateChangedEvent(record, previousState)
    } else {
      // Record not found: create it
      const actionMenuRecord = new ActionMenuRecord({
        connectionId: connection.id,
        role: ActionMenuRole.Requester,
        state: ActionMenuState.PreparingSelection,
        threadId: menuMessage.id,
        menu: new ActionMenu({
          title: menuMessage.title,
          description: menuMessage.description,
          options: menuMessage.options,
        }),
      })

      await this.actionMenuRepository.save(actionMenuRecord)

      this.emitStateChangedEvent(actionMenuRecord, null)
    }
  }

  public async createPerform(options: CreatePerformOptions) {
    const { actionMenuRecord: record, performedAction: performedSelection } = options

    // Assert
    record.assertRole(ActionMenuRole.Requester)
    record.assertState([ActionMenuState.PreparingSelection])

    const validSelection = record.menu?.options.some((item) => item.name === performedSelection.name)
    if (!validSelection) {
      throw new AriesFrameworkError('Selection does not match valid actions')
    }

    const previousState = record.state

    // Create message
    const menuMessage = new PerformMessage({
      name: performedSelection.name,
      params: performedSelection.params,
      threadId: record.threadId,
    })

    // Update record
    record.performedAction = options.performedAction
    record.state = ActionMenuState.Done

    await this.actionMenuRepository.update(record)

    this.emitStateChangedEvent(record, previousState)

    return { message: menuMessage, record }
  }

  public async processPerform(messageContext: InboundMessageContext<PerformMessage>) {
    const { message: performMessage } = messageContext

    this.logger.debug(`Processing action menu perform with id ${performMessage.id}`)

    const connection = messageContext.assertReadyConnection()

    // Check if there is an existing menu for this connection and role
    const record = await this.find({
      connectionId: connection.id,
      role: ActionMenuRole.Responder,
      threadId: performMessage.threadId,
    })

    if (record) {
      // Record found: check state and update with menu details

      // A Null state means that menu has been cleared by the responder.
      // Requester should be informed in order to request another menu
      if (record.state === ActionMenuState.Null) {
        throw new ActionMenuProblemReportError('Action Menu has been cleared by the responder', {
          problemCode: ActionMenuProblemReportReason.Timeout,
        })
      }
      record.assertState([ActionMenuState.AwaitingSelection])

      const validSelection = record.menu?.options.some((item) => item.name === performMessage.name)
      if (!validSelection) {
        throw new AriesFrameworkError('Selection does not match valid actions')
      }

      const previousState = record.state

      record.state = ActionMenuState.Done
      record.performedAction = new ActionMenuSelection({ name: performMessage.name, params: performMessage.params })

      await this.actionMenuRepository.update(record)

      this.emitStateChangedEvent(record, previousState)
    } else {
      throw new AriesFrameworkError(`No Action Menu found with thread id ${messageContext.message.threadId}`)
    }
  }

  public async clearMenu(options: ClearMenuOptions) {
    const { actionMenuRecord: record } = options

    const previousState = record.state

    // Update record
    record.state = ActionMenuState.Null
    record.threadId = ''
    record.menu = undefined
    record.performedAction = undefined

    await this.actionMenuRepository.update(record)

    this.emitStateChangedEvent(record, previousState)

    return record
  }

  public async processProblemReport(
    messageContext: InboundMessageContext<ActionMenuProblemReportMessage>
  ): Promise<ActionMenuRecord> {
    const { message: actionMenuProblemReportMessage } = messageContext

    const connection = messageContext.assertReadyConnection()

    this.logger.debug(`Processing problem report with id ${actionMenuProblemReportMessage.id}`)

    const actionMenuRecord = await this.find({
      role: ActionMenuRole.Requester,
      connectionId: connection.id,
    })

    if (!actionMenuRecord) {
      throw new AriesFrameworkError(
        `Unable to process action menu problem: record not found for connection id ${connection.id}`
      )
    }
    // Clear menu to restart flow
    return await this.clearMenu({ actionMenuRecord })
  }

  public async findById(actionMenuRecordId: string) {
    return await this.actionMenuRepository.findById(actionMenuRecordId)
  }

  public async find(options: FindMenuOptions) {
    return await this.actionMenuRepository.findSingleByQuery({
      connectionId: options.connectionId,
      role: options.role,
      threadId: options.threadId,
    })
  }

  private emitStateChangedEvent(actionMenuRecord: ActionMenuRecord, previousState: ActionMenuState | null) {
    const clonedRecord = JsonTransformer.clone(actionMenuRecord)

    this.eventEmitter.emit<ActionMenuStateChangedEvent>({
      type: ActionMenuEventTypes.ActionMenuStateChanged,
      payload: {
        actionMenuRecord: clonedRecord,
        previousState: previousState,
      },
    })
  }
}
