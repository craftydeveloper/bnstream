// ============================================
// four.meme Integration for BNStream Backend
// Based on Official API Documentation (09-10-2025)
// ============================================

const { ethers } = require('ethers');
const axios = require('axios');

// ============================================
// CONFIGURATION
// ============================================

// four.meme API Configuration
const FOURMEME_API_BASE = 'https://four.meme/meme-api';
const FOURMEME_PUBLIC_API = `${FOURMEME_API_BASE}/v1/public`;
const FOURMEME_PRIVATE_API = `${FOURMEME_API_BASE}/v1/private`;

// Smart Contract Addresses (BSC Mainnet)
const CONTRACTS = {
    tokenManagerV1: '0xEC4549caDcE5DA21Df6E6422d448034B5233bFbC',
    tokenManagerV2: '0x5c952063c7fc8610FFDB798152D69F0B9550762b',
    tokenHelperV3: '0xF251F83e40a78868FcfA3FA4599Dad6494E46034'
};

// BSC Provider
const provider = new ethers.JsonRpcProvider(
    process.env.BSC_MAINNET_RPC || 'https://bsc-dataseed.binance.org/'
);

// ============================================
// PUBLIC API METHODS (No Auth Required)
// ============================================

/**
 * Get token information by address
 */
async function getTokenByAddress(tokenAddress) {
    try {
        const response = await axios.get(
            `${FOURMEME_PUBLIC_API}/token/get`,
            {
                params: { address: tokenAddress }
            }
        );
        
        if (response.data.code === '0') {
            return response.data.data;
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching token by address:', error.message);
        return null;
    }
}

/**
 * Get token information by request ID
 */
async function getTokenById(requestId) {
    try {
        const response = await axios.get(
            `${FOURMEME_PUBLIC_API}/token/getById`,
            {
                params: { id: requestId }
            }
        );
        
        if (response.data.code === '0') {
            return response.data.data;
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching token by ID:', error.message);
        return null;
    }
}

/**
 * Get platform configuration
 */
async function getPlatformConfig() {
    try {
        const response = await axios.get(
            `${FOURMEME_PUBLIC_API}/config`
        );
        
        if (response.data.code === '0') {
            return response.data.data;
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching platform config:', error.message);
        return null;
    }
}

// ============================================
// SMART CONTRACT INTEGRATION
// ============================================

/**
 * Get token info from TokenManagerHelper3 contract
 * This works for both V1 and V2 tokens
 */
async function getTokenInfoFromContract(tokenAddress) {
    try {
        // ABI for getTokenInfo method
        const helperABI = [
            "function getTokenInfo(address token) view returns (uint256 version, address tokenManager, address quote, uint256 lastPrice, uint256 tradingFeeRate, uint256 minTradingFee, uint256 launchTime, uint256 offers, uint256 maxOffers, uint256 funds, uint256 maxFunds, bool liquidityAdded)"
        ];
        
        const helperContract = new ethers.Contract(
            CONTRACTS.tokenHelperV3,
            helperABI,
            provider
        );
        
        const info = await helperContract.getTokenInfo(tokenAddress);
        
        return {
            version: info.version.toString(),
            tokenManager: info.tokenManager,
            quote: info.quote,
            lastPrice: ethers.formatEther(info.lastPrice),
            tradingFeeRate: Number(info.tradingFeeRate) / 10000,
            minTradingFee: ethers.formatEther(info.minTradingFee),
            launchTime: new Date(Number(info.launchTime) * 1000),
            offers: ethers.formatEther(info.offers),
            maxOffers: ethers.formatEther(info.maxOffers),
            funds: ethers.formatEther(info.funds),
            maxFunds: ethers.formatEther(info.maxFunds),
            liquidityAdded: info.liquidityAdded,
            isV1: info.version.toString() === '1',
            isV2: info.version.toString() === '2'
        };
    } catch (error) {
        console.error('Error getting token info from contract:', error.message);
        return null;
    }
}

/**
 * Check if token is Binance MPC Wallet exclusive
 * Returns true if token can ONLY be traded with Binance MPC Wallet
 * We recommend filtering these tokens out
 */
async function isExclusiveToken(tokenAddress) {
    try {
        // Method 1: Check via API (recommended)
        const tokenData = await getTokenByAddress(tokenAddress);
        if (tokenData && tokenData.version === 'V8') {
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error('Error checking exclusive token:', error.message);
        return false;
    }
}

/**
 * Verify if an address created a specific token
 */
async function verifyTokenCreator(tokenAddress, creatorAddress) {
    try {
        // Get token details from API
        const tokenData = await getTokenByAddress(tokenAddress);
        if (!tokenData) return false;
        
        // Check if creator matches
        return tokenData.creator?.toLowerCase() === creatorAddress.toLowerCase();
        
    } catch (error) {
        console.error('Error verifying token creator:', error.message);
        return false;
    }
}

/**
 * Listen for new token creation events
 */
function listenForNewTokens(callback) {
    // TokenManager V2 ABI
    const tokenManagerABI = [
        "event TokenCreate(address indexed creator, address indexed token, uint256 requestId, string name, string symbol, uint256 totalSupply, uint256 launchTime, uint256 launchFee)"
    ];
    
    const tokenManagerContract = new ethers.Contract(
        CONTRACTS.tokenManagerV2,
        tokenManagerABI,
        provider
    );
    
    // Listen for TokenCreate events
    tokenManagerContract.on(
        'TokenCreate',
        async (creator, token, requestId, name, symbol, totalSupply, launchTime, launchFee, event) => {
            console.log('🎉 New four.meme token created!', {
                creator,
                token,
                name,
                symbol
            });
            
            if (callback) {
                callback({
                    creator,
                    tokenAddress: token,
                    requestId: requestId.toString(),
                    name,
                    symbol,
                    totalSupply: ethers.formatEther(totalSupply),
                    launchTime: new Date(Number(launchTime) * 1000)
                });
            }
        }
    );
    
    console.log('👂 Listening for new four.meme token creations on BSC...');
}

// ============================================
// DATABASE SYNC FUNCTIONS
// ============================================

/**
 * Sync all four.meme tokens to database
 */
async function syncAllTokens(Token) {
    try {
        console.log('🔄 Syncing four.meme tokens...');
        
        const tokenManagerABI = [
            "event TokenCreate(address indexed creator, address indexed token, uint256 requestId, string name, string symbol, uint256 totalSupply, uint256 launchTime, uint256 launchFee)"
        ];
        
        const tokenManagerContract = new ethers.Contract(
            CONTRACTS.tokenManagerV2,
            tokenManagerABI,
            provider
        );
        
        // Get recent events
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = currentBlock - 10000; // Last ~8 hours on BSC
        
        const events = await tokenManagerContract.queryFilter(
            tokenManagerContract.filters.TokenCreate(),
            fromBlock,
            currentBlock
        );
        
        console.log(`Found ${events.length} token creation events`);
        
        for (const event of events) {
            const tokenAddress = event.args.token;
            
            // Skip exclusive tokens (as recommended by four.meme)
            const isExclusive = await isExclusiveToken(tokenAddress);
            if (isExclusive) {
                console.log(`⚠️  Skipping exclusive token: ${tokenAddress}`);
                continue;
            }
            
            // Get price data from DexScreener
            let price = 0, marketCap = 0, volume24h = 0, priceChange24h = 0;
            
            try {
                const dexData = await axios.get(
                    `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
                );
                
                if (dexData.data.pairs && dexData.data.pairs.length > 0) {
                    const pair = dexData.data.pairs[0];
                    price = parseFloat(pair.priceUsd) || 0;
                    marketCap = pair.liquidity?.usd || 0;
                    volume24h = pair.volume?.h24 || 0;
                    priceChange24h = pair.priceChange?.h24 || 0;
                }
            } catch (error) {
                // Price not critical
            }
            
            // Save to database
            await Token.findOneAndUpdate(
                { address: tokenAddress.toLowerCase() },
                {
                    address: tokenAddress.toLowerCase(),
                    symbol: event.args.symbol,
                    name: event.args.name,
                    creator: event.args.creator.toLowerCase(),
                    totalSupply: ethers.formatEther(event.args.totalSupply),
                    price,
                    marketCap,
                    volume24h,
                    priceChange24h,
                    launchTime: new Date(Number(event.args.launchTime) * 1000),
                    createdAt: new Date(Number(event.args.launchTime) * 1000),
                    lastUpdated: new Date(),
                    platform: 'four.meme'
                },
                { upsert: true, new: true }
            );
        }
        
        console.log('✅ four.meme tokens synced successfully');
        
    } catch (error) {
        console.error('❌ Error syncing four.meme tokens:', error.message);
    }
}

/**
 * Update token prices
 */
async function updateTokenPrices(Token) {
    try {
        const tokens = await Token.find({ platform: 'four.meme' }).limit(50);
        
        for (const token of tokens) {
            try {
                const dexData = await axios.get(
                    `https://api.dexscreener.com/latest/dex/tokens/${token.address}`
                );
                
                if (dexData.data.pairs && dexData.data.pairs.length > 0) {
                    const pair = dexData.data.pairs[0];
                    
                    token.price = parseFloat(pair.priceUsd) || 0;
                    token.marketCap = pair.liquidity?.usd || 0;
                    token.volume24h = pair.volume?.h24 || 0;
                    token.priceChange24h = pair.priceChange?.h24 || 0;
                    token.lastUpdated = new Date();
                    
                    await token.save();
                }
            } catch (error) {
                // Continue with next token
            }
        }
        
        console.log('✅ Token prices updated');
        
    } catch (error) {
        console.error('❌ Error updating token prices:', error.message);
    }
}

// ============================================
// EXPORT
// ============================================

module.exports = {
    // Public API
    getTokenByAddress,
    getTokenById,
    getPlatformConfig,
    
    // Contract Methods
    getTokenInfoFromContract,
    isExclusiveToken,
    verifyTokenCreator,
    listenForNewTokens,
    
    // Database Sync
    syncAllTokens,
    updateTokenPrices,
    
    // Constants
    CONTRACTS,
    FOURMEME_API_BASE
};
