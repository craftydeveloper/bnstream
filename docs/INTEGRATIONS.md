# Integration boundaries

## Stream provider

Provider credentials are used for stream-related operations. Handle timeouts, validate returned identifiers, and avoid logging authorization headers.

## BNB Chain and token metadata

The integration module uses ethers and an RPC endpoint to read contract data. Keep read-only metadata lookup separate from transaction signing. Verify chain ID and contract addresses before displaying results.

## MongoDB and Socket.IO

Persist only necessary data and authorize rooms before emitting user-specific events. Do not broadcast administrative or private records to public channels.