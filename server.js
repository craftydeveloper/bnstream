const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bnstream', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ MongoDB Connected');
}).catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
});

// ============= SCHEMAS =============

const UserSchema = new mongoose.Schema({
    walletAddress: { type: String, required: true, unique: true, lowercase: true },
    username: { type: String, required: true },
    createdTokens: [{ type: String }],
    isVerified: { type: Boolean, default: false },
    premiumFeatures: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
});

const StreamSchema = new mongoose.Schema({
    streamId: { type: String, required: true, unique: true },
    creatorAddress: { type: String, required: true, lowercase: true },
    creatorUsername: { type: String, required: true },
    title: { type: String, required: true },
    tokenSymbol: { type: String, required: true },
    tokenAddress: { type: String },
    status: { type: String, enum: ['live', 'ended'], default: 'live' },
    viewers: { type: Number, default: 0 },
    livepeerStreamId: { type: String },
    livepeerPlaybackId: { type: String },
    streamKey: { type: String },
    rtmpIngestUrl: { type: String },
    webRtcPlaybackUrl: { type: String },
    streamType: { type: String, enum: ['web', 'obs'], default: 'web' },
    totalTips: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date }
});

const TokenSchema = new mongoose.Schema({
    address: { type: String, required: true, unique: true, lowercase: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    creator: { type: String, required: true, lowercase: true },
    price: { type: Number, default: 0 },
    marketCap: { type: Number, default: 0 },
    volume24h: { type: Number, default: 0 },
    priceChange24h: { type: Number, default: 0 },
    totalSupply: { type: String },
    platform: { type: String, default: 'four.meme' },
    isFeatured: { type: Boolean, default: false },
    featuredUntil: { type: Date },
    createdAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now }
});

const ChatMessageSchema = new mongoose.Schema({
    streamId: { type: String, required: true },
    username: { type: String, required: true },
    walletAddress: { type: String, lowercase: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

// Premium Features Schema
const PremiumSubscriptionSchema = new mongoose.Schema({
    walletAddress: { type: String, required: true, lowercase: true, unique: true },
    features: [{
        name: { type: String, required: true },
        price: { type: Number, required: true },
        active: { type: Boolean, default: true },
        activatedAt: { type: Date, default: Date.now }
    }],
    totalMonthlyFee: { type: Number, default: 0 },
    nextBillingDate: { type: Date },
    createdAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now }
});

// Admin Settings Schema
const AdminSettingsSchema = new mongoose.Schema({
    settingKey: { type: String, required: true, unique: true },
    settingValue: { type: mongoose.Schema.Types.Mixed },
    updatedAt: { type: Date, default: Date.now }
});

// Revenue Tracking Schema
const RevenueSchema = new mongoose.Schema({
    type: { type: String, enum: ['platform_fee', 'premium_subscription', 'advertising', 'featured_placement'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'BNB' },
    fromAddress: { type: String, lowercase: true },
    streamId: { type: String },
    subscriptionId: { type: String },
    description: { type: String },
    txHash: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Stream = mongoose.model('Stream', StreamSchema);
const Token = mongoose.model('Token', TokenSchema);
const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
const PremiumSubscription = mongoose.model('PremiumSubscription', PremiumSubscriptionSchema);
const AdminSettings = mongoose.model('AdminSettings', AdminSettingsSchema);
const Revenue = mongoose.model('Revenue', RevenueSchema);

// ============= CONFIGURATION =============

// LivePeer API Configuration
const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY;
const LIVEPEER_API_URL = 'https://livepeer.studio/api';

// Admin Configuration
const ADMIN_WALLET = (process.env.ADMIN_WALLET || '0xbC21B80c448604f4545A534D158cEAB25524a41C').toLowerCase();

// Platform Fee
const PLATFORM_FEE_PERCENTAGE = 5; // 5% of tips

// Premium Feature Pricing
const PREMIUM_FEATURES = {
    verified_badge: { 
        name: 'Verified Badge', 
        price: 10,
        description: 'Get a verified checkmark next to your name'
    },
    multi_streaming: { 
        name: 'Multi-Streaming', 
        price: 25,
        description: 'Stream to multiple platforms simultaneously (Twitch, YouTube, etc.)'
    }
};

// ============= MIDDLEWARE =============

// Admin Authentication Middleware
const requireAdmin = (req, res, next) => {
    const walletAddress = req.headers['x-wallet-address'];
    if (!walletAddress || walletAddress.toLowerCase() !== ADMIN_WALLET) {
        return res.status(403).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
    next();
};

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// ============= four.meme Integration =============
const fourMeme = require('./fourmeme-integration');

// ============= API ROUTES =============

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'BNStream API is running' });
});

// Get all live streams
app.get('/api/streams/live', async (req, res) => {
    try {
        const streams = await Stream.find({ status: 'live' }).sort({ startedAt: -1 });
        res.json({ success: true, streams });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get stream by ID
app.get('/api/streams/:streamId', async (req, res) => {
    try {
        const stream = await Stream.findOne({ streamId: req.params.streamId });
        if (!stream) {
            return res.status(404).json({ success: false, message: 'Stream not found' });
        }
        res.json({ success: true, stream });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create new stream (supports both web and OBS streaming)
app.post('/api/streams/create', async (req, res) => {
    try {
        const { walletAddress, username, title, tokenSymbol, tokenAddress, streamType } = req.body;

        // Verify user
        const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
        if (!user) {
            return res.status(400).json({ success: false, message: 'User not registered' });
        }

        // Create LivePeer stream
        const livepeerResponse = await axios.post(
            `${LIVEPEER_API_URL}/stream`,
            {
                name: `${username} - ${title}`,
                profiles: [
                    { name: '720p', bitrate: 2000000, fps: 30, width: 1280, height: 720 },
                    { name: '480p', bitrate: 1000000, fps: 30, width: 854, height: 480 },
                    { name: '360p', bitrate: 500000, fps: 30, width: 640, height: 360 }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${LIVEPEER_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const livepeerData = livepeerResponse.data;
        const streamId = `stream_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        // Create stream in database
        const stream = await Stream.create({
            streamId,
            creatorAddress: walletAddress.toLowerCase(),
            creatorUsername: username,
            title,
            tokenSymbol,
            tokenAddress,
            status: 'live',
            livepeerStreamId: livepeerData.id,
            livepeerPlaybackId: livepeerData.playbackId,
            streamKey: livepeerData.streamKey,
            rtmpIngestUrl: `rtmp://rtmp.livepeer.com/live`,
            webRtcPlaybackUrl: `https://livepeer.studio/api/playback/${livepeerData.playbackId}`,
            streamType: streamType || 'web'
        });

        res.json({ 
            success: true, 
            stream,
            streamingInfo: {
                streamKey: livepeerData.streamKey,
                rtmpUrl: `rtmp://rtmp.livepeer.com/live`,
                playbackId: livepeerData.playbackId,
                webRtcUrl: `https://livepeer.studio/api/playback/${livepeerData.playbackId}`,
                hlsUrl: `https://livepeer.studio/hls/${livepeerData.playbackId}/index.m3u8`,
                obsInstructions: streamType === 'obs' ? {
                    server: 'rtmp://rtmp.livepeer.com/live',
                    streamKey: livepeerData.streamKey,
                    setup: 'In OBS Studio: Settings > Stream > Service: Custom > Server: rtmp://rtmp.livepeer.com/live > Stream Key: ' + livepeerData.streamKey
                } : null
            }
        });

    } catch (error) {
        console.error('Error creating stream:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create stream',
            error: error.message 
        });
    }
});

// End stream
app.post('/api/streams/:streamId/end', async (req, res) => {
    try {
        const stream = await Stream.findOne({ streamId: req.params.streamId });
        if (!stream) {
            return res.status(404).json({ success: false, message: 'Stream not found' });
        }

        stream.status = 'ended';
        stream.endedAt = new Date();
        await stream.save();

        res.json({ success: true, message: 'Stream ended', stream });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Record tip (platform takes 5% fee)
app.post('/api/streams/:streamId/tip', async (req, res) => {
    try {
        const { amount, txHash, fromAddress } = req.body;
        const stream = await Stream.findOne({ streamId: req.params.streamId });
        
        if (!stream) {
            return res.status(404).json({ success: false, message: 'Stream not found' });
        }

        // Calculate platform fee (5%)
        const platformFee = (amount * PLATFORM_FEE_PERCENTAGE) / 100;
        const creatorAmount = amount - platformFee;

        // Update stream
        stream.totalTips += creatorAmount;
        await stream.save();

        // Record revenue
        await Revenue.create({
            type: 'platform_fee',
            amount: platformFee,
            currency: 'BNB',
            fromAddress: fromAddress?.toLowerCase(),
            streamId: stream.streamId,
            description: `Platform fee from tip on ${stream.title}`,
            txHash
        });

        res.json({ 
            success: true, 
            platformFee,
            creatorAmount,
            message: 'Tip recorded successfully' 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all tokens
app.get('/api/tokens', async (req, res) => {
    try {
        const tokens = await Token.find().sort({ marketCap: -1 });
        res.json({ success: true, tokens });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get token by address
app.get('/api/tokens/:address', async (req, res) => {
    try {
        const token = await Token.findOne({ address: req.params.address.toLowerCase() });
        if (!token) {
            return res.status(404).json({ success: false, message: 'Token not found' });
        }
        res.json({ success: true, token });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Register user
app.post('/api/users/register', async (req, res) => {
    try {
        const { walletAddress, username, tokenAddress } = req.body;

        // Verify token ownership via four.meme
        if (tokenAddress) {
            const isCreator = await fourMeme.verifyTokenCreator(tokenAddress, walletAddress);
            if (!isCreator) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Token verification failed. You must be the creator of this token.' 
                });
            }
        }

        const user = await User.findOneAndUpdate(
            { walletAddress: walletAddress.toLowerCase() },
            {
                username,
                $addToSet: { createdTokens: tokenAddress?.toLowerCase() }
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get user profile
app.get('/api/users/:walletAddress', async (req, res) => {
    try {
        const user = await User.findOne({ walletAddress: req.params.walletAddress.toLowerCase() });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Get user's streams
        const streams = await Stream.find({ creatorAddress: user.walletAddress });

        // Get premium subscription
        const subscription = await PremiumSubscription.findOne({ walletAddress: user.walletAddress });

        res.json({ 
            success: true, 
            user,
            streams,
            subscription 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============= PREMIUM FEATURES API =============

// Get available premium features
app.get('/api/premium/features', (req, res) => {
    res.json({ 
        success: true, 
        features: PREMIUM_FEATURES 
    });
});

// Subscribe to premium feature (backend only - not shown on frontend)
app.post('/api/premium/subscribe', async (req, res) => {
    try {
        const { walletAddress, featureName, txHash } = req.body;

        const feature = PREMIUM_FEATURES[featureName];
        if (!feature) {
            return res.status(400).json({ success: false, message: 'Invalid feature' });
        }

        // Find or create subscription
        let subscription = await PremiumSubscription.findOne({ walletAddress: walletAddress.toLowerCase() });
        
        if (!subscription) {
            subscription = new PremiumSubscription({
                walletAddress: walletAddress.toLowerCase(),
                features: [],
                totalMonthlyFee: 0
            });
        }

        // Check if already subscribed
        const existingFeature = subscription.features.find(f => f.name === featureName);
        if (existingFeature && existingFeature.active) {
            return res.status(400).json({ success: false, message: 'Already subscribed to this feature' });
        }

        // Add feature
        if (existingFeature) {
            existingFeature.active = true;
            existingFeature.activatedAt = new Date();
        } else {
            subscription.features.push({
                name: featureName,
                price: feature.price,
                active: true
            });
        }

        // Update total fee
        subscription.totalMonthlyFee = subscription.features
            .filter(f => f.active)
            .reduce((sum, f) => sum + f.price, 0);

        // Set next billing date (30 days from now)
        subscription.nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        subscription.lastUpdated = new Date();

        await subscription.save();

        // Update user
        await User.findOneAndUpdate(
            { walletAddress: walletAddress.toLowerCase() },
            { 
                $addToSet: { premiumFeatures: featureName },
                isVerified: featureName === 'verified_badge' ? true : undefined
            }
        );

        // Record revenue
        await Revenue.create({
            type: 'premium_subscription',
            amount: feature.price,
            currency: 'USD',
            fromAddress: walletAddress.toLowerCase(),
            subscriptionId: subscription._id.toString(),
            description: `Premium subscription: ${feature.name}`,
            txHash
        });

        res.json({ 
            success: true, 
            subscription,
            message: `Successfully subscribed to ${feature.name}` 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get user's subscription
app.get('/api/premium/subscription/:walletAddress', async (req, res) => {
    try {
        const subscription = await PremiumSubscription.findOne({ 
            walletAddress: req.params.walletAddress.toLowerCase() 
        });

        if (!subscription) {
            return res.json({ success: true, subscription: null });
        }

        res.json({ success: true, subscription });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============= ADMIN API =============

// Admin: Get dashboard analytics
app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
    try {
        const totalStreams = await Stream.countDocuments();
        const liveStreams = await Stream.countDocuments({ status: 'live' });
        const totalUsers = await User.countDocuments();
        const totalTokens = await Token.countDocuments();

        // Revenue stats
        const totalRevenue = await Revenue.aggregate([
            { $group: { _id: '$type', total: { $sum: '$amount' } } }
        ]);

        const revenueByType = {};
        let grandTotal = 0;
        totalRevenue.forEach(item => {
            revenueByType[item._id] = item.total;
            grandTotal += item.total;
        });

        // Recent streams
        const recentStreams = await Stream.find().sort({ startedAt: -1 }).limit(10);

        // Top creators by tips
        const topCreators = await Stream.aggregate([
            { $group: { 
                _id: '$creatorAddress', 
                totalTips: { $sum: '$totalTips' },
                streamCount: { $sum: 1 }
            }},
            { $sort: { totalTips: -1 } },
            { $limit: 10 }
        ]);

        // Premium subscriptions
        const activeSubscriptions = await PremiumSubscription.countDocuments({
            'features.active': true
        });

        res.json({
            success: true,
            analytics: {
                totals: {
                    streams: totalStreams,
                    liveStreams,
                    users: totalUsers,
                    tokens: totalTokens,
                    revenue: grandTotal,
                    activeSubscriptions
                },
                revenue: {
                    byType: revenueByType,
                    total: grandTotal
                },
                recentStreams,
                topCreators
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin: Get all revenue records
app.get('/api/admin/revenue', requireAdmin, async (req, res) => {
    try {
        const { startDate, endDate, type } = req.query;
        
        let query = {};
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }
        if (type) query.type = type;

        const revenues = await Revenue.find(query).sort({ createdAt: -1 });
        const total = revenues.reduce((sum, r) => sum + r.amount, 0);

        res.json({ 
            success: true, 
            revenues,
            total,
            count: revenues.length
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin: Update settings
app.post('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
        const { settingKey, settingValue } = req.body;

        const setting = await AdminSettings.findOneAndUpdate(
            { settingKey },
            { settingValue, updatedAt: new Date() },
            { upsert: true, new: true }
        );

        res.json({ success: true, setting });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin: Get settings
app.get('/api/admin/settings/:key', requireAdmin, async (req, res) => {
    try {
        const setting = await AdminSettings.findOne({ settingKey: req.params.key });
        
        if (!setting) {
            return res.status(404).json({ success: false, message: 'Setting not found' });
        }

        res.json({ success: true, setting });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin: Get all settings
app.get('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
        const settings = await AdminSettings.find();
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin: Feature token (paid placement)
app.post('/api/admin/tokens/feature', requireAdmin, async (req, res) => {
    try {
        const { tokenAddress, durationDays, amount, txHash } = req.body;

        const token = await Token.findOne({ address: tokenAddress.toLowerCase() });
        if (!token) {
            return res.status(404).json({ success: false, message: 'Token not found' });
        }

        // Set featured status
        token.isFeatured = true;
        token.featuredUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        await token.save();

        // Record revenue if amount provided
        if (amount) {
            await Revenue.create({
                type: 'featured_placement',
                amount,
                currency: 'BNB',
                description: `Featured token placement: ${token.symbol} for ${durationDays} days`,
                txHash
            });
        }

        res.json({ 
            success: true, 
            token,
            message: `Token featured until ${token.featuredUntil}` 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin: Update admin wallet
app.post('/api/admin/wallet/update', requireAdmin, async (req, res) => {
    try {
        const { newWalletAddress } = req.body;

        await AdminSettings.findOneAndUpdate(
            { settingKey: 'admin_wallet' },
            { settingValue: newWalletAddress.toLowerCase(), updatedAt: new Date() },
            { upsert: true }
        );

        res.json({ 
            success: true, 
            message: 'Admin wallet updated. Please update ADMIN_WALLET in .env and restart server.' 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get site config (includes Twitter link, etc.)
app.get('/api/config', async (req, res) => {
    try {
        const twitterSetting = await AdminSettings.findOne({ settingKey: 'twitter_url' });
        const disclaimerSetting = await AdminSettings.findOne({ settingKey: 'disclaimer_text' });

        res.json({
            success: true,
            config: {
                twitterUrl: twitterSetting?.settingValue || 'https://twitter.com/bnstream',
                disclaimer: disclaimerSetting?.settingValue || 'BNStream is integrated with four.meme for token discovery. Trade responsibly.',
                platformFee: PLATFORM_FEE_PERCENTAGE,
                adminWallet: ADMIN_WALLET
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============= WEBSOCKET (Chat) =============

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join stream room
    socket.on('joinStream', async ({ streamId, username }) => {
        socket.join(streamId);
        
        // Increment viewer count
        await Stream.findOneAndUpdate(
            { streamId },
            { $inc: { viewers: 1 } }
        );

        // Notify others
        io.to(streamId).emit('userJoined', { username });
        
        // Send viewer count
        const stream = await Stream.findOne({ streamId });
        io.to(streamId).emit('viewerCount', { count: stream?.viewers || 0 });
    });

    // Leave stream room
    socket.on('leaveStream', async ({ streamId }) => {
        socket.leave(streamId);
        
        // Decrement viewer count
        await Stream.findOneAndUpdate(
            { streamId },
            { $inc: { viewers: -1 } }
        );

        const stream = await Stream.findOne({ streamId });
        io.to(streamId).emit('viewerCount', { count: Math.max(0, stream?.viewers || 0) });
    });

    // Send chat message
    socket.on('chatMessage', async ({ streamId, username, walletAddress, message }) => {
        const chatMessage = await ChatMessage.create({
            streamId,
            username,
            walletAddress: walletAddress?.toLowerCase(),
            message
        });

        io.to(streamId).emit('newMessage', chatMessage);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// ============= BACKGROUND TASKS =============

// Sync four.meme tokens every minute
setInterval(async () => {
    try {
        await fourMeme.syncAllTokens(Token);
    } catch (error) {
        console.error('Error syncing tokens:', error.message);
    }
}, 60000);

// Update token prices every 30 seconds
setInterval(async () => {
    try {
        await fourMeme.updateTokenPrices(Token);
    } catch (error) {
        console.error('Error updating prices:', error.message);
    }
}, 30000);

// Listen for new four.meme tokens
fourMeme.listenForNewTokens(async (tokenData) => {
    console.log('New four.meme token detected:', tokenData);
    // Token automatically added by integration
});

// Clean up expired featured tokens
setInterval(async () => {
    await Token.updateMany(
        { isFeatured: true, featuredUntil: { $lt: new Date() } },
        { isFeatured: false }
    );
}, 3600000); // Every hour

// ============= START SERVER =============

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 BNStream API running on port ${PORT}`);
    console.log(`👤 Admin wallet: ${ADMIN_WALLET}`);
});

// Export for testing
module.exports = { app, io };
