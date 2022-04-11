import { Library } from 'ffi-napi'
import * as os from 'os'
import * as ref from 'ref-napi'

type Extensions = {
  [key in NodeJS.Platform]: string
}

const extension: Partial<Extensions> = { darwin: '.dylib', linux: '.so', win32: '.dll' }

const getFileExt = () => {
  const platform = os.platform()
  if (platform in extension) {
    return extension[platform]
  } else {
    return '.so'
  }
}

const int = ref.types.int

const storagePlugin = Library('libindystrgpostgres' + getFileExt(), {
  postgresstorage_init: [int, []],
  init_storagetype: [int, ['string', 'string']],
})

export default storagePlugin
