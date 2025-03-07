import type { default as Express, Router } from 'express'
import { RouterFactory } from './RouterFactory'

export function importExpress() {
  try {
    // NOTE: 'express' is added as a peer-dependency, and is required when using this module
    const express = require('express') as typeof Express
    return express
  } catch (_error) {
    throw new Error('Express must be installed as a peer dependency')
  }
}

export class ExpressRouterFactory implements RouterFactory<Router> {
  public create(): Router {
    return importExpress().Router()
  }
}
