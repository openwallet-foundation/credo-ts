import express from 'express'

// In React Native the express.native.ts file will be used which will throw when actuall called.
export function importExpress() {
  return express
}
