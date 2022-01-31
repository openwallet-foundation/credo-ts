import type { ConnectionRecord } from './repository'

import { AriesFrameworkError } from '../../error'

import { DidExchangeRequestMessage, DidExchangeResponseMessage, DidExchangeCompleteMessage } from './messages'
import { DidExchangeState, DidExchangeRole } from './models'

export class DidExchangeStateMachine {
  private static createMessageStateRules = [
    {
      message: DidExchangeRequestMessage.type,
      state: DidExchangeState.InvitationReceived,
      role: DidExchangeRole.Requester,
      nextState: DidExchangeState.RequestSent,
    },
    {
      message: DidExchangeResponseMessage.type,
      state: DidExchangeState.RequestReceived,
      role: DidExchangeRole.Responder,
      nextState: DidExchangeState.ResponseSent,
    },
    {
      message: DidExchangeCompleteMessage.type,
      state: DidExchangeState.ResponseReceived,
      role: DidExchangeRole.Requester,
      nextState: DidExchangeState.Completed,
    },
  ]

  private static processMessageStateRules = [
    {
      message: DidExchangeRequestMessage.type,
      state: DidExchangeState.InvitationSent,
      role: DidExchangeRole.Responder,
      nextState: DidExchangeState.RequestReceived,
    },
    {
      message: DidExchangeResponseMessage.type,
      state: DidExchangeState.RequestSent,
      role: DidExchangeRole.Requester,
      nextState: DidExchangeState.ResponseReceived,
    },
    {
      message: DidExchangeCompleteMessage.type,
      state: DidExchangeState.ResponseSent,
      role: DidExchangeRole.Responder,
      nextState: DidExchangeState.Completed,
    },
  ]

  public static assertCreateMessageState(messageType: string, record: ConnectionRecord) {
    const rule = this.createMessageStateRules.find((r) => r.message === messageType)
    if (!rule) {
      throw new AriesFrameworkError(`Could not find create message rule for ${messageType}`)
    }
    if (rule.state !== record.state || rule.role !== record.role) {
      throw new AriesFrameworkError(
        `Record with role ${record.role} is in invalid state ${record.state} to create ${messageType}. Expected state for role ${rule.role} is ${rule.state}.`
      )
    }
  }

  public static assertProcessMessageState(messageType: string, record: ConnectionRecord) {
    const rule = this.processMessageStateRules.find((r) => r.message === messageType)
    if (!rule) {
      throw new AriesFrameworkError(`Could not find create message rule for ${messageType}`)
    }
    if (rule.state !== record.state || rule.role !== record.role) {
      throw new AriesFrameworkError(
        `Record with role ${record.role} is in invalid state ${record.state} to process ${messageType}. Expected state for role ${rule.role} is ${rule.state}.`
      )
    }
  }

  public static nextState(messageType: string, record: ConnectionRecord) {
    const rule = this.createMessageStateRules
      .concat(this.processMessageStateRules)
      .find((r) => r.message === messageType && r.role === record.role)
    if (!rule) {
      throw new AriesFrameworkError(`Could not find create message rule for ${messageType}`)
    }
    return rule.nextState
  }
}
