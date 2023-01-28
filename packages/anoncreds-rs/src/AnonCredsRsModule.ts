import type { Module } from '@aries-framework/core'

export class AnonCredsRsModule implements Module {
  public register() {
    try {
      // eslint-disable-next-line import/no-extraneous-dependencies
      require('@hyperledger/anoncreds-nodejs')
    } catch (error) {
      try {
        require('@hyperledger/anoncreds-react-native')
      } catch (error) {
        throw new Error('Could not load anoncreds bindings')
      }
    }
  }
}
