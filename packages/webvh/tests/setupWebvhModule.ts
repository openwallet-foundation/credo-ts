import { DidsModule } from '@credo-ts/core'

import { WebvhModule, WebvhDidRegistrar, WebvhDidResolver, WebvhModuleConfig } from '../src'

export const getWebvhModules = (baseUrl?: string) => ({
  webvhSdk: new WebvhModule(
    new WebvhModuleConfig({
      baseUrl: baseUrl ?? 'https://didwebvh.info',
    })
  ),
  dids: new DidsModule({
    registrars: [new WebvhDidRegistrar()],
    resolvers: [new WebvhDidResolver()],
  }),
})
