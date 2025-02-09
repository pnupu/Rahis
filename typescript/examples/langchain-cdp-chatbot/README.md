# CDP AgentKit Trading Bot Example

This example demonstrates a simple trading bot that implements a moving average strategy with profit targets and stop losses on Base Sepolia testnet.

## Features

- Monitors ETH/USD price using Pyth Network price feeds
- Implements a 5-period moving average strategy
- 2% profit target and 1% stop loss
- Trades between ETH and USDC
- Keeps gas buffer for transactions
- Includes simulation mode for testing strategies without real transactions

## How it's Made

### Core Technologies
- **TypeScript & Node.js**: The bot is built using TypeScript for type safety and better developer experience
- **AgentKit SDK**: Leverages Coinbase's AgentKit for wallet management and blockchain interactions
- **Pyth Network**: Used for real-time ETH/USD price feeds with high accuracy
- **Base Sepolia**: Running on Base's testnet for cost-effective testing and development

### Architecture Components

1. **Wallet Management**
   - Uses CDP (Coinbase Developer Platform) for secure wallet operations
   - Implements ERC20 token interactions for USDC handling
   - Maintains gas management with buffer system for reliable transactions

2. **Price Feed System**
   - Integrates with Pyth Network's price oracle
   - Implements price feed ID caching for efficient updates
   - Uses multiple regex patterns for robust balance parsing

3. **Trading Strategy Implementation**
   - Moving average calculation using a rolling window
   - Price history management with timestamp tracking
   - Position state management (long/neutral)
   - Profit/loss calculation with percentage-based targets

4. **Error Handling & Monitoring**
   - Comprehensive error catching at multiple levels
   - Balance monitoring before trade execution
   - Detailed logging system for debugging
   - Graceful fallbacks for network issues

### Notable Technical Details

1. **Smart Contract Interaction**
   ```typescript
   const result = await balanceAction.invoke({
     contractAddress: "0x876852425331a113d8E432eFFB3aC5BEf38f033a",
   });
   ```
   Direct interaction with USDC contract using checksummed address

2. **Price Calculation**
   ```typescript
   private calculateMovingAverage(prices: number[]): number {
     if (prices.length === 0) return 0;
     const sum = prices.reduce((acc, price) => acc + price, 0);
     return sum / prices.length;
   }
   ```
   Efficient moving average calculation with array reduction

3. **Trade Execution**
   ```typescript
   const result = await tradeAction.invoke({
     amount: BigInt(Math.floor(amount * 1e18)), // Convert ETH to Wei
     fromAssetId: "eth",
     toAssetId: "usdc",
   });
   ```
   Precise handling of token decimals and conversions

### Partner Technologies

1. **Coinbase Developer Platform (CDP)**
   - Provides secure wallet infrastructure
   - Handles transaction signing and broadcasting
   - Manages network connections and state

2. **Pyth Network Integration**
   - Real-time price feeds with minimal latency
   - Multi-validator consensus for accurate pricing
   - Built-in failover mechanisms

3. **Base Network Benefits**
   - Low-cost testnet transactions
   - EVM compatibility for standard token operations
   - Reliable block confirmation times

### Interesting Solutions

1. **Balance Parsing**
   ```typescript
   let match = result.match(/Balance of .* is (\d+)/);
   if (!match) {
     match = result.match(/Balance.*: (\d+)/i);
   }
   if (!match) {
     match = result.match(/(\d+)/);
   }
   ```
   Multiple regex patterns ensure robust balance parsing across different response formats

2. **Gas Management**
   ```typescript
   const tradeAmount = 0.00005; // Amount we want to trade
   const gasBuffer = 0.00002; // Keep some ETH for gas
   ```
   Dynamic gas buffer system prevents failed transactions

3. **Price Feed Optimization**
   - Caches price feed IDs to reduce API calls
   - Implements price update throttling
   - Uses efficient data structures for price history

## Prerequisites

- Node.js 18+
- CDP Secret API Key
- OpenAI API Key

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your API keys:
```bash
OPENAI_API_KEY=your_openai_api_key
CDP_API_KEY_NAME=your_cdp_api_key_name
CDP_API_KEY_PRIVATE_KEY=your_cdp_api_key_private_key
```

3. Make sure you have some testnet ETH in your wallet (at least 0.0001 ETH recommended)

## Running the Bot

Start the trading bot in one of two modes:

1. Real trading mode:
```bash
npm run start
```

2. Simulation mode (no real transactions):
```bash
npm run start -- --simulation
```

The bot will:
1. Display current ETH and USDC balances (real or simulated)
2. Monitor ETH/USD price
3. Execute trades based on the moving average strategy
4. Show profit/loss for each trade

### Simulation Mode

The simulation mode allows you to test trading strategies without using real funds:
- Starts with 0.0001 ETH and 0 USDC
- Uses real price feeds from Pyth Network
- Simulates trades and balance updates
- Shows detailed trade information including prices
- No gas fees or transaction delays
- Perfect for strategy testing and development

Example simulation output:
```
Running in simulation mode - no real transactions will be executed
-------------------
Simulated balances:
ETH: 0.000100 ETH
USDC: 0.00 USDC
-------------------
[SIMULATION] Bought 0.000050 ETH for 0.13 USDC at price $2663.49
```

## Trading Strategy

The bot uses a simple moving average strategy:
- Buy when price drops below the 5-period moving average (potential uptrend)
- Sell when either:
  - 2% profit target is hit
  - 1% stop loss is triggered

Trade sizes:
- Buy orders: 0.00005 ETH (plus 0.00002 ETH gas buffer)
- Sell orders: 0.1 USDC

## Contract Addresses

- USDC on Base Sepolia: `0x876852425331a113d8E432eFFB3aC5BEf38f033a`

## Important Notes

- This is a testnet example - do not use on mainnet
- Keep enough ETH for gas fees (minimum 0.00002 ETH recommended)
- The bot will log all balances and trades for monitoring
- Error handling is implemented for common issues

## Troubleshooting

If you encounter issues:
1. Check your wallet has sufficient testnet ETH
2. Verify the USDC contract address is correct
3. Make sure all API keys are properly set
4. Check the Base Sepolia network status
