<h1 align="center"><b>Sample tails file server</b></h1>

This is a very simple server that can be used to host AnonCreds tails files. It is intended to be used only for development purposes.

It offers a single endpoint at the root that takes an URI-encoded `tailsFileId` as URL path and allows to upload (using PUT method and a through a multi-part encoded form) or retrieve a tails file (using GET method).
