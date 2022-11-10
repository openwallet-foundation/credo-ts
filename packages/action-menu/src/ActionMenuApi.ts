import type {
  ClearActiveMenuOptions,
  FindActiveMenuOptions,
  PerformActionOptions,
  RequestMenuOptions,
  SendMenuOptions,
} from './ActionMenuApiOptions'

import {
  AgentContext,
  AriesFrameworkError,
  ConnectionService,
  Dispatcher,
  MessageSender,
  createOutboundDIDCommV1Message,
  injectable,
} from '@aries-framework/core'

import { ActionMenuRole } from './ActionMenuRole'
import {
  ActionMenuProblemReportHandler,
  MenuMessageHandler,
  MenuRequestMessageHandler,
  PerformMessageHandler,
} from './handlers'
import { ActionMenuService } from './services'

@injectable()
export class ActionMenuApi {
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private actionMenuService: ActionMenuService
  private agentContext: AgentContext

  public constructor(
    dispatcher: Dispatcher,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    actionMenuService: ActionMenuService,
    agentContext: AgentContext
  ) {
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.actionMenuService = actionMenuService
    this.agentContext = agentContext
    this.registerHandlers(dispatcher)
  }

  /**
   * Start Action Menu protocol as requester, asking for root menu. Any active menu will be cleared.
   *
   * @param options options for requesting menu
   * @returns Action Menu record associated to this new request
   */
  public async requestMenu(options: RequestMenuOptions) {
    const connection = await this.connectionService.getById(this.agentContext, options.connectionId)

    const { message, record } = await this.actionMenuService.createRequest(this.agentContext, {
      connection,
    })

    const outboundMessage = createOutboundDIDCommV1Message(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

    return record
  }

  /**
   * Send a new Action Menu as responder. This menu will be sent as response if there is an
   * existing menu thread.
   *
   * @param options options for sending menu
   * @returns Action Menu record associated to this action
   */
  public async sendMenu(options: SendMenuOptions) {
    const connection = await this.connectionService.getById(this.agentContext, options.connectionId)

    const { message, record } = await this.actionMenuService.createMenu(this.agentContext, {
      connection,
      menu: options.menu,
    })

    const outboundMessage = createOutboundDIDCommV1Message(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

    return record
  }

  /**
   * Perform action in active Action Menu, as a requester. The related
   * menu will be closed.
   *
   * @param options options for requesting menu
   * @returns Action Menu record associated to this selection
   */
  public async performAction(options: PerformActionOptions) {
    const connection = await this.connectionService.getById(this.agentContext, options.connectionId)

    const actionMenuRecord = await this.actionMenuService.find(this.agentContext, {
      connectionId: connection.id,
      role: ActionMenuRole.Requester,
    })
    if (!actionMenuRecord) {
      throw new AriesFrameworkError(`No active menu found for connection id ${options.connectionId}`)
    }

    const { message, record } = await this.actionMenuService.createPerform(this.agentContext, {
      actionMenuRecord,
      performedAction: options.performedAction,
    })

    const outboundMessage = createOutboundDIDCommV1Message(connection, message)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)

    return record
  }

  /**
   * Find the current active menu for a given connection and the specified role.
   *
   * @param options options for requesting active menu
   * @returns Active Action Menu record, or null if no active menu found
   */
  public async findActiveMenu(options: FindActiveMenuOptions) {
    return this.actionMenuService.find(this.agentContext, {
      connectionId: options.connectionId,
      role: options.role,
    })
  }

  /**
   * Clears the current active menu for a given connection and the specified role.
   *
   * @param options options for clearing active menu
   * @returns Active Action Menu record, or null if no active menu record found
   */
  public async clearActiveMenu(options: ClearActiveMenuOptions) {
    const actionMenuRecord = await this.actionMenuService.find(this.agentContext, {
      connectionId: options.connectionId,
      role: options.role,
    })

    return actionMenuRecord ? await this.actionMenuService.clearMenu(this.agentContext, { actionMenuRecord }) : null
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new ActionMenuProblemReportHandler(this.actionMenuService))
    dispatcher.registerHandler(new MenuMessageHandler(this.actionMenuService))
    dispatcher.registerHandler(new MenuRequestMessageHandler(this.actionMenuService))
    dispatcher.registerHandler(new PerformMessageHandler(this.actionMenuService))
  }
}
