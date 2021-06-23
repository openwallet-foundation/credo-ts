# Setup Libindy for iOS

1. Make sure you have added `rn-indy-sdk` as a dependency to your project. If not please first see the [React Native Setup](../setup-react-native.md) guide.
2. Follow the iOS installation steps from the RN Indy SDK docs [here](https://github.com/AbsaOSS/rn-indy-sdk#ios)
   - Step 2 of the RN Indy SDK tutorial requires you to copy `Indy.framework` to the `ios/Pods` directory. You can find a built version of the `Indy.framework` [here](https://github.com/hyperledger/aries-mobile-agent-react-native/tree/main/ios/Pods/Frameworks/Indy.framework)
3. You now have libindy installed for iOS. You can continue with the [React Native Setup](./../setup-react-native.md)

An example iOS project making use of Aries Framework JavaScript in React Native is [Aries Mobile Agent React Native](https://github.com/hyperledger/aries-mobile-agent-react-native).

## Resources

- [Indy SDK docs](https://github.com/hyperledger/indy-sdk#ios)
- [Sovrin Repo](https://repo.sovrin.org/ios/libindy/stable/)
- [RN Indy SDK](https://github.com/AbsaOSS/rn-indy-sdk#ios)
- [Aries Mobile Agent React Native](https://github.com/hyperledger/aries-mobile-agent-react-native)
