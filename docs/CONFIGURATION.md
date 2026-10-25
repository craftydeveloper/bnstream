# Configuration

The code references these environment variable names. Supply values through a local secret manager or deployment environment; never put values in source control.

- PORT: HTTP listener port.
- MONGODB_URI: database connection string.
- LIVEPEER_API_KEY: provider credential.
- ADMIN_WALLET: administrative wallet identity; it is not a private key.
- BSC_MAINNET_RPC: BNB Chain RPC endpoint.

Use separate development and production credentials, restrict permissions, rotate exposed credentials, and validate configuration on startup.