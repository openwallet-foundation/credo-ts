import { isNodeJS } from '../../utils/environment'
import { Constructor } from '../../utils/mixins'
import { FileSystem } from './FileSystem'

let FileSystemClass: Constructor<FileSystem>

if (isNodeJS()) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  FileSystemClass = require('./NodeFileSystem').NodeFileSystem
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  FileSystemClass = require('./ReactNativeFileSystem').ReactNativeFileSystem
}

export { FileSystemClass }
