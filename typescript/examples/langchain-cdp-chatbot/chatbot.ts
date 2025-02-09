import {
  AgentKit,
  CdpWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  pythActionProvider,
} from "@coinbase/agentkit";
import * as dotenv from "dotenv";
import { TradingBot } from "./tradingBot";

dotenv.config();

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  // Check required variables
  const requiredVars = ["OPENAI_API_KEY", "CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  // Exit if any required variables are missing
  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach(varName => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  // Warn about optional NETWORK_ID
  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

validateEnvironment();

/**
 * Initialize AgentKit with required providers
 *
 * @returns Initialized AgentKit instance
 */
async function initializeAgentKit(): Promise<AgentKit> {
  // Configure CDP Wallet Provider
  const config = {
    apiKeyName: process.env.CDP_API_KEY_NAME,
    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    networkId: process.env.NETWORK_ID || "base-sepolia",
  };

  const walletProvider = await CdpWalletProvider.configureWithWallet(config);

  // Initialize AgentKit
  return await AgentKit.from({
    walletProvider,
    actionProviders: [
      wethActionProvider(),
      pythActionProvider(),
      walletActionProvider(),
      erc20ActionProvider(),
      cdpApiActionProvider({
        apiKeyName: process.env.CDP_API_KEY_NAME,
        apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      cdpWalletActionProvider({
        apiKeyName: process.env.CDP_API_KEY_NAME,
        apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    ],
  });
}

/**
 * Run the trading bot with specified intervals
 *
 * @param interval - Time interval between actions in seconds
 * @param simulationMode - Whether to run in simulation mode
 */
async function runTradingBot(interval = 10, simulationMode = false): Promise<void> {
  console.log("Starting trading bot...");

  try {
    // Initialize AgentKit and trading bot
    const agentKit = await initializeAgentKit();
    const tradingBot = new TradingBot(agentKit, simulationMode);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        // Execute trading strategy
        const tradingResult = await tradingBot.executeTradingStrategy();
        console.log(tradingResult);
        console.log("-------------------");

        // Wait for next interval
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
      } catch (error) {
        if (error instanceof Error) {
          console.error("Error in trading iteration:", error.message);
          // Continue running despite errors in individual iterations
          await new Promise(resolve => setTimeout(resolve, interval * 1000));
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Fatal error in trading bot:", error.message);
    }
    process.exit(1);
  }
}

// Start the trading bot
if (require.main === module) {
  console.log("Starting trading bot...");

  // Check if simulation mode is enabled
  const simulationMode = process.argv.includes("--simulation");
  if (simulationMode) {
    console.log("Running in simulation mode - no real transactions will be executed");
  }

  runTradingBot(10, simulationMode).catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
