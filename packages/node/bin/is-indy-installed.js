#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/no-var-requires, no-undef */

const indy = require('indy-sdk')
const { randomUUID } = require('node:crypto')

const uuid = randomUUID()
const id = `test-wallet-id-${uuid}`

indy
  .createWallet({ id }, { key: id })
  .then(() => indy.deleteWallet({ id }, { key: id }))
  .then(() => {
    console.log('Libindy was installed correctly')
  })
  .catch((e) => {
    console.log('Libindy was installed correctly, but an error did occur')
    console.error(e)
  })
