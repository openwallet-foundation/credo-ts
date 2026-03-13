# Standalone demos

The Credo interactive demos now live in their own repositories so the framework itself can stay lean.

## AnonCreds / DIDComm demo

- Repository: https://github.com/openwallet-foundation/credo-demo
- Follow the repository README to install dependencies (usually `pnpm install`).
- Run the agent scripts from that repo (`pnpm alice` and `pnpm faber`) in separate terminals to walk through creating a connection, issuing a credential, requesting a proof, and sending messages.

## OpenID4VC + SD-JWT VC demo

- Repository: https://github.com/openwallet-foundation/credo-demo-openid
- Install dependencies with `pnpm install` and then start the desired processes (`pnpm issuer`, `pnpm provider`, `pnpm holder`, `pnpm verifier`, etc.) as described in that README.
- The repo also includes `ngrok` proxy scripts to expose the demo endpoints when needed.

Each demo repo contains its own README with screenshots, configuration notes, and troubleshooting tips. Clone whichever repo fits the flow you want to explore, keep it on its own branch, and run the demos from that directory as the instructions describe.
