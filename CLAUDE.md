# confsec-js

This is the open-source JavaScript/Typescript SDK for CONFSEC. It allows users
to make secure and anonymous AI inference requests via CONFSEC, without having
to worry about the client implementation specifics. It should function as
a drop-in replacement for the OpenAI JavaScript SDK.

## Architecture Decisions

- The SDK should consist mainly of two components:
  - A JavaScript wrapper for the `libconfsec` C static library, which implements
    the core CONFSEC client functionality. The wrapper should be exposed as a
    regular HTTP client.
  - A wrapper for the OpenAI JavaScript SDK, which uses the above HTTP client to
    make requests to Confident Security.

## Useful Commands

TODO
