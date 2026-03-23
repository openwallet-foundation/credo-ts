export const rnfs = () => {
  try {
    return require('@dr.pogodin/react-native-fs')
  } catch {
    try {
      return require('react-native-fs')
    } catch {
      throw new Error(
        `Could not find '@dr.pogodin/react-native-fs' or 'react-native-fs' as a peerDependency. Make sure to add either one of them`
      )
    }
  }
}
