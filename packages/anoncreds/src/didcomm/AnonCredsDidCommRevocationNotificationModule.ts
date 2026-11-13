import type { DependencyManager, Module } from '@credo-ts/core'
import { DidCommRevocationNotificationProcessorToken } from '@credo-ts/didcomm'
import { AnonCredsRevocationNotificationProcessor } from './AnonCredsRevocationNotificationProcessor'

export class AnonCredsDidCommRevocationNotificationModule implements Module {
  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(
      DidCommRevocationNotificationProcessorToken,
      AnonCredsRevocationNotificationProcessor
    )
  }
}
