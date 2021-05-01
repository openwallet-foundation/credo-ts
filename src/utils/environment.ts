export enum Environment {
  NodeJS = 'NodeJS',
  ReactNative = 'ReactNative',
  Browser = 'Browser',
}

export function getEnvironment() {
  if (typeof document != 'undefined') {
    return Environment.Browser
  } else if (typeof navigator != 'undefined' && navigator.product == 'ReactNative') {
    return Environment.ReactNative
  } else {
    return Environment.NodeJS
  }
}

export function isNodeJS() {
  return getEnvironment() == Environment.NodeJS
}

export function isReactNative() {
  return getEnvironment() == Environment.ReactNative
}

export function isBrowser() {
  return getEnvironment() == Environment.Browser
}
