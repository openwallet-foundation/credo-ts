#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/no-var-requires, no-undef */

const { createWallet, deleteWallet } = require('indy-sdk')

const uuid = Math.random() * 10000
const id = `test-wallet-id-${uuid}`

createWallet({ id }, { key: id })
  .then(() => deleteWallet({ id }, { key: id }))
  .then(() => {
    console.log('Libindy was installed correctly')
  })
  .catch((e) => {
    console.log('Libindy was installed correctly, but an error did occur')
    console.error(e)
  })
