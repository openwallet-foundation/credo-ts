import { DidsModule } from '@credo-ts/core'

import { WebVhDidResolver, WebVhModule } from '../src'

export const getWebVhModules = () => ({
  webvhSdk: new WebVhModule(),
  dids: new DidsModule({
    resolvers: [new WebVhDidResolver()],
  }),
})
