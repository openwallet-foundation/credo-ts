import type { ParsedMessageType } from '../../util/messageType'
import type { DidCommConnectionRecord } from './repository'

import { CredoError } from '@credo-ts/core'

import { canHandleMessageType } from '../../util/messageType'

import { DidExchangeCompleteMessage, DidExchangeRequestMessage, DidExchangeResponseMessage } from './messages'
import { DidCommDidExchangeRole, DidCommDidExchangeState } from './models'

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class DidExchangeStateMachine {
  private static createMessageStateRules = [
    {
      message: DidExchangeRequestMessage,
      state: DidCommDidExchangeState.InvitationReceived,
      role: DidCommDidExchangeRole.Requester,
      nextState: DidCommDidExchangeState.RequestSent,
    },
    {
      message: DidExchangeResponseMessage,
      state: DidCommDidExchangeState.RequestReceived,
      role: DidCommDidExchangeRole.Responder,
      nextState: DidCommDidExchangeState.ResponseSent,
    },
    {
      message: DidExchangeCompleteMessage,
      state: DidCommDidExchangeState.ResponseReceived,
      role: DidCommDidExchangeRole.Requester,
      nextState: DidCommDidExchangeState.Completed,
    },
  ]

  private static processMessageStateRules = [
    {
      message: DidExchangeRequestMessage,
      state: DidCommDidExchangeState.InvitationSent,
      role: DidCommDidExchangeRole.Responder,
      nextState: DidCommDidExchangeState.RequestReceived,
    },
    {
      message: DidExchangeResponseMessage,
      state: DidCommDidExchangeState.RequestSent,
      role: DidCommDidExchangeRole.Requester,
      nextState: DidCommDidExchangeState.ResponseReceived,
    },
    {
      message: DidExchangeCompleteMessage,
      state: DidCommDidExchangeState.ResponseSent,
      role: DidCommDidExchangeRole.Responder,
      nextState: DidCommDidExchangeState.Completed,
    },
  ]

  public static assertCreateMessageState(messageType: ParsedMessageType, record: DidCommConnectionRecord) {
    const rule = DidExchangeStateMachine.createMessageStateRules.find((r) =>
      canHandleMessageType(r.message, messageType)
    )
    if (!rule) {
      throw new CredoError(`Could not find create message rule for ${messageType}`)
    }
    if (rule.state !== record.state || rule.role !== record.role) {
      throw new CredoError(
        `Record with role ${record.role} is in invalid state ${record.state} to create ${messageType}. Expected state for role ${rule.role} is ${rule.state}.`
      )
    }
  }

  public static assertProcessMessageState(messageType: ParsedMessageType, record: DidCommConnectionRecord) {
    const rule = DidExchangeStateMachine.processMessageStateRules.find((r) =>
      canHandleMessageType(r.message, messageType)
    )
    if (!rule) {
      throw new CredoError(`Could not find create message rule for ${messageType}`)
    }
    if (rule.state !== record.state || rule.role !== record.role) {
      throw new CredoError(
        `Record with role ${record.role} is in invalid state ${record.state} to process ${messageType.messageTypeUri}. Expected state for role ${rule.role} is ${rule.state}.`
      )
    }
  }

  public static nextState(messageType: ParsedMessageType, record: DidCommConnectionRecord) {
    const rule = DidExchangeStateMachine.createMessageStateRules
      .concat(DidExchangeStateMachine.processMessageStateRules)
      .find((r) => canHandleMessageType(r.message, messageType) && r.role === record.role)
    if (!rule) {
      throw new CredoError(
        `Could not find create message rule for messageType ${messageType.messageTypeUri}, state ${record.state} and role ${record.role}`
      )
    }
    return rule.nextState
  }
}
