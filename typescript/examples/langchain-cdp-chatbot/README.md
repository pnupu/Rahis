# CDP AgentKit Trading Bot Example

This example demonstrates a simple trading bot that implements a moving average strategy with profit targets and stop losses on Base Sepolia testnet.

## Features

- Monitors ETH/USD price using Pyth Network price feeds
- Implements a 5-period moving average strategy
- 2% profit target and 1% stop loss
- Trades between ETH and USDC
- Keeps gas buffer for transactions

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

Start the trading bot:
```bash
npm run start
```

The bot will:
1. Display current ETH and USDC balances
2. Monitor ETH/USD price
3. Execute trades based on the moving average strategy
4. Show profit/loss for each trade

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
