import { cli } from './cli-definition.js'
import { errorLog } from './utils.js'

async function run() {
  // Use the route method to handle parsing and routing automatically
  try {
    cli.route()
  } catch (error) {
    errorLog('CLI Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

run()
