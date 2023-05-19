export type Extensible = Record<string, unknown>

export interface AnonCredsOperationStateWait {
  state: 'wait'
}

export interface AnonCredsOperationStateAction {
  state: 'action'
  action: string
}

export interface AnonCredsOperationStateFinished {
  state: 'finished'
}

export interface AnonCredsOperationStateFailed {
  state: 'failed'
  reason: string
}

export interface AnonCredsResolutionMetadata extends Extensible {
  error?: 'invalid' | 'notFound' | 'unsupportedAnonCredsMethod' | string
  message?: string
}
