import { DidsModule } from '@credo-ts/core'

import { WebvhModule, WebvhDidResolver } from '../src'

export const getWebvhModules = () => ({
  webvhSdk: new WebvhModule(),
  dids: new DidsModule({
    resolvers: [new WebvhDidResolver()],
  }),
})
