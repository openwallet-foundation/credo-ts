from acapy_backchannel import Client

client = Client(base_url="https://api.example.com")




import { Agent } from 'aries-framework'

// Import rn-indy-sdk and File System for React Native
import indy from 'rn-indy-sdk'
import { ReactNativeFileSystem } from 'aries-framework/build/src/storage/fs/ReactNativeFileSystem'

// This creates an agent with all the specified configuration data
const agent = new Agent({
  label: 'my-agent',
  walletConfig: { id: 'walletId' },
  walletCredentials: { key: 'testkey0000000000000000000000000' },
  indy,
  fileSystem: new ReactNativeFileSystem(),
})

// Make sure to initialize the agent before using it.
try {
  await agent.init()
  console.log('Initialized agent!')
} catch (error) {
  console.log(error)
}