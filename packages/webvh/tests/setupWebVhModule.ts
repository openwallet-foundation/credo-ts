import { DidsModule } from '@credo-ts/core'

import { WebVhModule, WebVhDidResolver } from '../src'

export const getWebVhModules = () => ({
  webvhSdk: new WebVhModule(),
  dids: new DidsModule({
    resolvers: [new WebVhDidResolver()],
  }),
})
