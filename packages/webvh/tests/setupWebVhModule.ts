import { DidsModule } from '@credo-ts/core'

import { WebVhDidRegistrar, WebVhDidResolver, WebVhModule } from '../src'

export const getWebVhModules = () => ({
  webvhSdk: new WebVhModule(),
  dids: new DidsModule({
    resolvers: [new WebVhDidResolver()],
    registrars: [new WebVhDidRegistrar()],
  }),
})
