---
"@credo-ts/core": minor
---

refactor!: remove support for BBS+ signatures.

The underlying implementation of BBS+ of which Credo is based is outdated, has not been maintained, and not recommended to use.

A new version is being worked on by standard development organizations, for which support may be added at a later time. If you still require support for the old/legacy BBS+ Signatures, you can look at the latest version of Credo and extract the required code and create a custom BBS+ module.
