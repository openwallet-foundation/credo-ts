import { Library } from 'ffi-napi'
import * as ref from 'ref-napi'

const int = ref.types.int

const storagePlugin = Library('libindystrgpostgres.so', {
  postgresstorage_init: [int, []],
  init_storagetype: [int, ['string', 'string']],
})

export default storagePlugin
