import type { default as Express } from 'express'

export function importExpress() {
  try {
    // NOTE: 'express' is added as a peer-dependency, and is required when using this module
    const express = require('express') as typeof Express
    return express
  } catch (_error) {
    throw new Error('Express must be installed as a peer dependency')
  }
}
