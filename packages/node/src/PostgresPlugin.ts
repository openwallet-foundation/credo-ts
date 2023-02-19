import { Library } from 'ffi-napi'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { types } from 'ref-napi'

const LIBNAME = 'indystrgpostgres'
const ENV_VAR = 'LIB_INDY_STRG_POSTGRES'

type Platform = 'darwin' | 'linux' | 'win32'

type ExtensionMap = Record<Platform, { prefix?: string; extension: string }>

const extensions: ExtensionMap = {
  darwin: { prefix: 'lib', extension: '.dylib' },
  linux: { prefix: 'lib', extension: '.so' },
  win32: { extension: '.dll' },
}

const libPaths: Record<Platform, Array<string>> = {
  darwin: ['/usr/local/lib/', '/usr/lib/', '/opt/homebrew/opt/'],
  linux: ['/usr/lib/', '/usr/local/lib/'],
  win32: ['c:\\windows\\system32\\'],
}

// Alias for a simple function to check if the path exists
const doesPathExist = fs.existsSync

const getLibrary = () => {
  // Detect OS; darwin, linux and windows are only supported
  const platform = os.platform()

  if (platform !== 'linux' && platform !== 'win32' && platform !== 'darwin')
    throw new Error(`Unsupported platform: ${platform}. linux, win32 and darwin are supported.`)

  // Get a potential path from the environment variable
  const pathFromEnvironment = process.env[ENV_VAR]

  // Get the paths specific to the users operating system
  const platformPaths = libPaths[platform]

  // Check if the path from the environment variable is supplied and add it
  // We use unshift here so that when we want to get a valid library path this will be the first to resolve
  if (pathFromEnvironment) platformPaths.unshift(pathFromEnvironment)

  // Create the path + file
  const libraries = platformPaths.map((p) =>
    path.join(p, `${extensions[platform].prefix ?? ''}${LIBNAME}${extensions[platform].extension}`)
  )

  // Gaurd so we quit if there is no valid path for the library
  if (!libraries.some(doesPathExist))
    throw new Error(`Could not find ${LIBNAME} with these paths: ${libraries.join(' ')}`)

  // Get the first valid library
  // Casting here as a string because there is a guard of none of the paths
  // would be valid
  const validLibraryPath = libraries.find((l) => doesPathExist(l)) as string

  return Library(validLibraryPath, {
    postgresstorage_init: [types.int, []],
    init_storagetype: [types.int, ['string', 'string']],
  })
}

type NativeIndyPostgres = {
  postgresstorage_init: () => number
  init_storagetype: (arg0: string, arg1: string) => number
}

let indyPostgresStorage: NativeIndyPostgres | undefined

export interface IndySdkPostgresWalletStorageConfig {
  url: string
  wallet_scheme: IndySdkPostgresWalletScheme
  path?: string
}

export interface IndySdkPostgresWalletStorageCredentials {
  account: string
  password: string
  admin_account: string
  admin_password: string
}

export enum IndySdkPostgresWalletScheme {
  DatabasePerWallet = 'DatabasePerWallet',
  MultiWalletSingleTable = 'MultiWalletSingleTable',
  MultiWalletSingleTableSharedPool = 'MultiWalletSingleTableSharedPool',
}

export interface IndySdkPostgresStorageConfig {
  type: 'postgres_storage'
  config: IndySdkPostgresWalletStorageConfig
  credentials: IndySdkPostgresWalletStorageCredentials
}

export function loadIndySdkPostgresPlugin(
  config: IndySdkPostgresWalletStorageConfig,
  credentials: IndySdkPostgresWalletStorageCredentials
) {
  if (!indyPostgresStorage) {
    indyPostgresStorage = getLibrary()
  }

  indyPostgresStorage.postgresstorage_init()
  indyPostgresStorage.init_storagetype(JSON.stringify(config), JSON.stringify(credentials))
}
