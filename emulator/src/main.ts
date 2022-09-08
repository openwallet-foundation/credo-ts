import { UserEmulator } from './UserEmulator'
import { WitnessEmulator } from './WitnessEmulator'
import { createUsersList, createWitnessTable } from './utils'
import { randomString } from '@sicpa-dlab/aries-framework-core/src/utils/string'
import { config } from './config'
import { flushAndClose } from './metrics'

const run = async () => {
  console.log('Emulator: Starting...')
  let startPort = config.port

  let users = config.users.map((user) => ({
    ...user,
    host: config.host,
    port: startPort++,
    publicDidSeed: user.publicDidSeed ?? randomString(32),
  }))

  let witnesses = config.witnesses.map((witness) => ({
    ...witness,
    host: config.host,
    port: startPort++,
    publicDidSeed: witness.publicDidSeed ?? randomString(32),
    gossipDidSeed: witness.gossipDidSeed ?? randomString(32),
  }))
  console.log('witnesses')
  console.log(witnesses)

  console.log('Emulator: Preparing list of User DIDs...')
  const userList = createUsersList(users)
  console.log(`Emulator: User DIDs: ${userList}`)

  console.log('Emulator: Preparing list of Witness DIDs...')
  const witnessTable = createWitnessTable(witnesses)
  console.log(`Emulator: Witness DIDs: ${JSON.stringify(witnessTable)}`)

  users = users.map((user) => ({
    ...user,
    witness: user.witness ?? witnessTable[user.witnessIndex || 0].publicDid,
  }))

  witnesses = witnesses.map((witnessConfig) => ({
    ...witnessConfig,
    issuerDids: userList,
    knownWitnesses: witnessTable,
  }))

  console.log('User Emulator: Build')
  const userEmulator = new UserEmulator(users)

  console.log('Witness Emulator: Build')
  const witnessEmulator = new WitnessEmulator(witnesses)

  console.log('Witness Emulator: Start')
  await witnessEmulator.run()

  console.log('User Emulator: Start')
  await userEmulator.run()
}

run().catch((e) => {
  console.error(e)
  return flushAndClose()
})
