import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { Logger } from '../../../logger'
import type { ActionMenuStateChangedEvent } from '../ActionMenuEvents'
import type { FindActiveMenuOptions } from '../ActionMenuModuleOptions'
import type { CreateMenuOptions, CreatePerformOptions, CreateRequestOptions } from './ActionMenuServiceOptions'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { injectable } from '../../../plugins'
import { JsonTransformer } from '../../../utils'
import { ActionMenuEventTypes } from '../ActionMenuEvents'
import { ActionMenuRole } from '../ActionMenuRole'
import { ActionMenuState } from '../ActionMenuState'
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
    let actionMenuRecord = await this.findActive({
      connectionId: options.connection.id,
      role: ActionMenuRole.Requester,
    })

    if (actionMenuRecord) {
      const previousState = actionMenuRecord.state
      actionMenuRecord.state = ActionMenuState.AwaitingRootMenu
      actionMenuRecord.threadId = menuRequestMessage.id

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

    let actionMenuRecord = await this.findActive({
      connectionId: connection.id,
      role: ActionMenuRole.Responder,
    })

    if (actionMenuRecord) {
      const previousState = actionMenuRecord.state
      actionMenuRecord.state = ActionMenuState.PreparingRootMenu
      actionMenuRecord.threadId = menuRequestMessage.id

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

    // Create message
    const menuMessage = new MenuMessage({
      title: options.menu.title,
      description: options.menu.description,
      options: options.menu.options,
    })

    // Check if there is an existing menu for this connection and role
    let actionMenuRecord = await this.findActive({
      connectionId: options.connection.id,
      role: ActionMenuRole.Responder,
    })

    // If so, continue existing flow
    if (actionMenuRecord) {
      actionMenuRecord.assertState([ActionMenuState.PreparingRootMenu, ActionMenuState.Done])

      const previousState = actionMenuRecord.state
      actionMenuRecord.state = ActionMenuState.AwaitingSelection

      // The new menu will be bound to the existing thread
      menuMessage.setThread({ threadId: actionMenuRecord.threadId })

      await this.actionMenuRepository.update(actionMenuRecord)
      this.emitStateChangedEvent(actionMenuRecord, previousState)
    } else {
      // Create record
      actionMenuRecord = new ActionMenuRecord({
        connectionId: options.connection.id,
        role: ActionMenuRole.Responder,
        state: ActionMenuState.AwaitingSelection,
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
    const record = await this.findActive({
      connectionId: connection.id,
      role: ActionMenuRole.Requester,
    })

    if (record) {
      // Record found: check state and update with menu details
      record.assertState([ActionMenuState.Null, ActionMenuState.AwaitingRootMenu])

      const previousState = record.state

      record.state = ActionMenuState.PreparingSelection
      record.menu = new ActionMenu({
        title: menuMessage.title,
        description: menuMessage.description,
        options: menuMessage.options,
      })
      record.threadId = menuMessage.threadId

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
    const record = await this.findActive({
      connectionId: connection.id,
      role: ActionMenuRole.Responder,
    })

    if (record) {
      // Record found: check role and update with menu details
      record.assertRole(ActionMenuRole.Responder)
      record.assertState([ActionMenuState.AwaitingSelection])

      const previousState = record.state

      record.state = ActionMenuState.Done
      record.performedAction = new ActionMenuSelection({ name: performMessage.name, params: performMessage.params })

      await this.actionMenuRepository.update(record)

      this.emitStateChangedEvent(record, previousState)
    } else {
      throw new AriesFrameworkError(`No Action Menu found with thread id ${messageContext.message.threadId}`)
    }
  }

  public async findByThreadId(threadId: string) {
    return await this.actionMenuRepository.findSingleByQuery({ threadId })
  }

  public async findById(actionMenuRecordId: string) {
    return await this.actionMenuRepository.findById(actionMenuRecordId)
  }

  public async findActive(options: FindActiveMenuOptions) {
    return await this.actionMenuRepository.findSingleByQuery({
      connectionId: options.connectionId,
      role: options.role,
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
