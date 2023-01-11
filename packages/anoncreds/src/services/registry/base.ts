export type Extensible = Record<string, unknown>

export interface AnonCredsOperationState {
  state: 'action' | 'wait'
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
