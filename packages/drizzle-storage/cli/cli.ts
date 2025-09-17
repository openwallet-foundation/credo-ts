import { errorLog } from './utils'
import { cli } from './cli-definition'

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
