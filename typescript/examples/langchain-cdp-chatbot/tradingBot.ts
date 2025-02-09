import { AgentKit } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { StructuredTool } from "@langchain/core/tools";

interface PriceHistory {
  timestamp: number;
  price: number;
}

interface TradingState {
  lastBuyPrice: number | null;
  priceHistory: PriceHistory[];
  position: "long" | "neutral";
}

/**
 * A simple trading bot that implements a moving average strategy with profit targets and stop losses.
 * Uses price feeds to make trading decisions.
 */
export class TradingBot {
  private state: TradingState = {
    lastBuyPrice: null,
    priceHistory: [],
    position: "neutral",
  };

  private readonly PRICE_HISTORY_LENGTH = 10; // Keep last 10 price points
  private readonly PROFIT_THRESHOLD = 0.02; // 2% profit target
  private readonly LOSS_THRESHOLD = 0.01; // 1% stop loss
  private readonly MOVING_AVERAGE_PERIOD = 5; // 5-period moving average

  private tools: StructuredTool[] | null = null;
  private initialized = false;

  /**
   * Creates a new instance of the trading bot
   *
   * @param agentKit - The AgentKit instance to use for blockchain interactions
   */
  constructor(private agentKit: AgentKit) {
    const actions = agentKit.getActions();
    const tradeAction = actions.find(action => action.name === "CdpWalletActionProvider_trade");
    if (!tradeAction) {
      throw new Error("Trading bot requires CDP wallet trade action");
    }

    // Log initial balances
    this.logBalances().catch(error => {
      console.error("Error logging initial balances:", error);
    });
  }

  /**
   * Executes one iteration of the trading strategy
   *
   * @param symbol - The trading pair symbol to trade (default: "ETH/USD")
   * @returns A string describing the action taken
   */
  public async executeTradingStrategy(symbol: string = "ETH/USD"): Promise<string> {
    try {
      // Ensure tools are initialized
      await this.initializeTools();

      const currentPrice = await this.getCurrentPrice(symbol);
      this.updatePriceHistory(currentPrice);

      if (this.shouldBuy(currentPrice)) {
        // Check if we have enough ETH for the trade
        const ethBalance = await this.getEthBalance();
        const tradeAmount = 0.00005; // Amount we want to trade
        const gasBuffer = 0.00002; // Keep some ETH for gas

        if (ethBalance < tradeAmount + gasBuffer) {
          return `Insufficient ETH balance for buy order. Have ${ethBalance} ETH, need ${tradeAmount + gasBuffer} ETH (including gas buffer)`;
        }

        this.state.lastBuyPrice = currentPrice;
        this.state.position = "long";
        const result = await this.executeBuyOrder(tradeAmount);
        return result;
      }

      if (this.shouldSell(currentPrice)) {
        // Check if we have enough USDC for the trade
        const usdcBalance = await this.getUsdcBalance();
        const tradeAmount = 0.1; // Amount we want to trade

        if (usdcBalance < tradeAmount) {
          return `Insufficient USDC balance for sell order. Have ${usdcBalance} USDC, need ${tradeAmount} USDC`;
        }

        const profitLoss = this.state.lastBuyPrice
          ? ((currentPrice - this.state.lastBuyPrice) / this.state.lastBuyPrice) * 100
          : 0;
        this.state.lastBuyPrice = null;
        this.state.position = "neutral";
        const result = await this.executeSellOrder(tradeAmount);
        return `${result} (P/L: ${profitLoss.toFixed(2)}%)`;
      }

      return `Monitoring price at ${currentPrice}. Position: ${this.state.position}`;
    } catch (error) {
      console.error("Error in trading strategy:", error);
      return "Error executing trading strategy";
    }
  }

  /**
   * Logs the current ETH and USDC balances
   */
  private async logBalances(): Promise<void> {
    try {
      const ethBalance = await this.getEthBalance();
      const usdcBalance = await this.getUsdcBalance();
      console.log("-------------------");
      console.log("Current balances:");
      console.log(`ETH: ${ethBalance.toFixed(6)} ETH`);
      console.log(`USDC: ${usdcBalance.toFixed(2)} USDC`);
      console.log("-------------------");
    } catch (error) {
      throw new Error(`Failed to log balances: ${error}`);
    }
  }

  /**
   * Gets the current ETH balance
   *
   * @returns The current ETH balance in whole units
   */
  private async getEthBalance(): Promise<number> {
    try {
      const actions = this.agentKit.getActions();
      const walletAction = actions.find(
        action => action.name === "WalletActionProvider_get_wallet_details",
      );
      if (!walletAction) {
        throw new Error("Wallet action not found");
      }

      const result = await walletAction.invoke({});
      const match = result.match(/ETH Balance: ([\d.]+) ETH/);
      if (!match) {
        throw new Error("Could not parse ETH balance from wallet details");
      }

      return parseFloat(match[1]);
    } catch (error) {
      console.error("Error getting ETH balance:", error);
      throw error;
    }
  }

  /**
   * Gets the current USDC balance
   *
   * @returns The current USDC balance
   */
  private async getUsdcBalance(): Promise<number> {
    try {
      const actions = this.agentKit.getActions();
      const balanceAction = actions.find(
        action => action.name === "ERC20ActionProvider_get_balance",
      );
      if (!balanceAction) {
        throw new Error("ERC20 balance action not found");
      }

      // USDC contract address on Base Sepolia (checksummed)
      const result = await balanceAction.invoke({
        contractAddress: "0x876852425331a113d8E432eFFB3aC5BEf38f033a", // USDC on Base Sepolia (Moonwell)
      });

      // Log the full response for debugging
      console.log("USDC balance response:", result);

      // Try different regex patterns to match the balance
      let match = result.match(/Balance of .* is (\d+)/);
      if (!match) {
        match = result.match(/Balance.*: (\d+)/i);
      }
      if (!match) {
        match = result.match(/(\d+)/);
      }

      if (!match) {
        console.error("Raw USDC balance response:", result);
        throw new Error("Could not parse USDC balance");
      }

      return parseInt(match[1]) / 1e6; // Convert from smallest unit to USDC
    } catch (error) {
      console.error("Error getting USDC balance:", error);
      return 0; // Assume 0 balance if we can't get it (e.g., no USDC yet)
    }
  }

  /**
   * Initialize the tools needed for price feeds and trading
   */
  private async initializeTools(): Promise<void> {
    if (!this.initialized) {
      this.tools = await getLangChainTools(this.agentKit);
      this.initialized = true;
    }
  }

  /**
   * Calculates the simple moving average of a list of prices
   *
   * @param prices - Array of price points to calculate average from
   * @returns The calculated moving average
   */
  private calculateMovingAverage(prices: number[]): number {
    if (prices.length === 0) return 0;
    const sum = prices.reduce((acc, price) => acc + price, 0);
    return sum / prices.length;
  }

  /**
   * Executes a buy order for the given amount
   *
   * @param amount - Amount of ETH to spend
   * @returns Transaction details
   */
  private async executeBuyOrder(amount: number): Promise<string> {
    try {
      const actions = this.agentKit.getActions();
      const tradeAction = actions.find(action => action.name === "CdpWalletActionProvider_trade");
      if (!tradeAction) {
        throw new Error("Trade action not found");
      }

      const result = await tradeAction.invoke({
        amount: BigInt(Math.floor(amount * 1e18)), // Convert ETH to Wei
        fromAssetId: "eth",
        toAssetId: "usdc",
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to execute buy order: ${error}`);
    }
  }

  /**
   * Executes a sell order for the given amount
   *
   * @param amount - Amount of USDC to sell
   * @returns Transaction details
   */
  private async executeSellOrder(amount: number): Promise<string> {
    try {
      const actions = this.agentKit.getActions();
      const tradeAction = actions.find(action => action.name === "CdpWalletActionProvider_trade");
      if (!tradeAction) {
        throw new Error("Trade action not found");
      }

      const result = await tradeAction.invoke({
        amount: BigInt(Math.floor(amount * 1e6)), // Convert USDC to smallest unit (6 decimals)
        fromAssetId: "usdc",
        toAssetId: "eth",
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to execute sell order: ${error}`);
    }
  }

  /**
   * Gets the current price for a given trading pair
   *
   * @param symbol - The trading pair symbol (e.g., "ETH/USD")
   * @returns The current price from the price feed
   */
  private async getCurrentPrice(symbol: string): Promise<number> {
    try {
      if (!this.tools) {
        await this.initializeTools();
      }

      // Get the base asset from the trading pair (e.g., "ETH" from "ETH/USD")
      const baseAsset = symbol.split("/")[0];

      // First get the price feed ID
      const priceFeedTool = this.tools?.find(
        tool => tool.name === "PythActionProvider_fetch_price_feed",
      );
      if (!priceFeedTool) {
        throw new Error("Price feed tool not found");
      }

      // Get price feed ID for the asset
      const feedResult = await priceFeedTool.call({ tokenSymbol: baseAsset });
      if (typeof feedResult !== "string") {
        throw new Error(`Could not get price feed ID for ${baseAsset}`);
      }

      // Then get the actual price using the feed ID
      const priceTool = this.tools?.find(tool => tool.name === "PythActionProvider_fetch_price");
      if (!priceTool) {
        throw new Error("Price tool not found");
      }

      // Get price using the feed ID
      const priceResult = await priceTool.call({ priceFeedID: feedResult });
      if (typeof priceResult !== "string") {
        throw new Error("Invalid price data format");
      }

      return parseFloat(priceResult);
    } catch (error) {
      console.error("Error getting price:", error);
      throw error;
    }
  }

  /**
   * Updates the price history with a new price point
   *
   * @param price - The new price to add to history
   */
  private updatePriceHistory(price: number) {
    this.state.priceHistory.push({
      timestamp: Date.now(),
      price,
    });

    // Keep only the last N prices
    if (this.state.priceHistory.length > this.PRICE_HISTORY_LENGTH) {
      this.state.priceHistory.shift();
    }
  }

  /**
   * Determines if a buy order should be executed based on current conditions
   *
   * @param currentPrice - The current market price
   * @returns True if should buy, false otherwise
   */
  private shouldBuy(currentPrice: number): boolean {
    if (this.state.position === "long") return false;

    const prices = this.state.priceHistory.map(p => p.price);
    if (prices.length < this.MOVING_AVERAGE_PERIOD) return false;

    const movingAverage = this.calculateMovingAverage(prices.slice(-this.MOVING_AVERAGE_PERIOD));

    // Buy if price is below moving average (potential uptrend)
    return currentPrice < movingAverage;
  }

  /**
   * Determines if a sell order should be executed based on current conditions
   *
   * @param currentPrice - The current market price
   * @returns True if should sell, false otherwise
   */
  private shouldSell(currentPrice: number): boolean {
    if (this.state.position !== "long" || !this.state.lastBuyPrice) return false;

    const profitPercent = (currentPrice - this.state.lastBuyPrice) / this.state.lastBuyPrice;

    // Sell if we hit profit target or stop loss
    return profitPercent >= this.PROFIT_THRESHOLD || profitPercent <= -this.LOSS_THRESHOLD;
  }
}
