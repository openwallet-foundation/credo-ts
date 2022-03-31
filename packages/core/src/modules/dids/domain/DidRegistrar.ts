import type {
  DidCreateOptions,
  DidDeactivateOptions,
  DidUpdateOptions,
  DidCreateResult,
  DidUpdateResult,
  DidDeactivateResult,
} from '../types'

export interface DidRegistrar {
  readonly supportedMethods: string[]

  create(options: DidCreateOptions): Promise<DidCreateResult>
  update(options: DidUpdateOptions): Promise<DidUpdateResult>
  deactivate(options: DidDeactivateOptions): Promise<DidDeactivateResult>
}
