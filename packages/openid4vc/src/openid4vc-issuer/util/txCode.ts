import { type AgentContext, Kms } from '@credo-ts/core'
import type { OpenId4VciTxCode } from '../../shared'

export function generateTxCode(agentContext: AgentContext, txCode: OpenId4VciTxCode) {
  const kms = agentContext.resolve(Kms.KeyManagementApi)

  const length = txCode.length ?? 4
  const inputMode = txCode.input_mode ?? 'numeric'

  const numbers = '0123456789'
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const characters = inputMode === 'numeric' ? numbers : numbers + letters
  const random = kms.randomBytes({ length })

  let result = ''
  for (let i = 0; i < length; i++) {
    result += characters[random[i] % characters.length]
  }

  return result
}
