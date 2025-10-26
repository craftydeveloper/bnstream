// ============= CONFIGURATION =============

const API_URL = 'http://localhost:3001/api';
let userAddress = null;
let userName = null;
let isAdmin = false;
let socket = null;

// ============= INITIALIZATION =============

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    setupEventListeners();
    checkWalletConnection();
    loadTrendingTokens();
    loadLiveStreams();
    loadAllTokens();
}

function setupEventListeners() {
    // Wallet connection
    document.getElementById('connectWalletBtn').addEventListener('click', connectWallet);
    document.getElementById('goLiveBtn').addEventListener('click', showGoLiveModal);
    
    // Search
    document.getElementById('searchBtn').addEventListener('click', searchTokens);
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchTokens();
    });
    
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

// ============= WALLET CONNECTION =============

async function checkWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await handleWalletConnected(accounts[0]);
            }
        } catch (error) {
            console.error('Error checking wallet:', error);
        }
    }
}

async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask to use this feature!');
        return;
    }

    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        await handleWalletConnected(accounts[0]);
    } catch (error) {
        console.error('Error connecting wallet:', error);
        alert('Failed to connect wallet');
    }
}

async function handleWalletConnected(address) {
    userAddress = address;
    userName = address.slice(0, 6) + '...' + address.slice(-4);
    
    // Update UI
    const btn = document.getElementById('connectWalletBtn');
    btn.textContent = userName;
    btn.classList.add('connected');
    
    // Enable Go Live button
    document.getElementById('goLiveBtn').disabled = false;
    
    // Check if admin
    await checkAdminStatus();
    
    // Load user's tokens
    await loadUserTokens();
}

async function checkAdminStatus() {
    try {
        const response = await fetch(`${API_URL}/admin/check/${userAddress}`);
        const data = await response.json();
        
        if (data.success && data.isAdmin) {
            isAdmin = true;
            document.getElementById('adminTab').style.display = 'block';
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
}

// ============= TAB NAVIGATION =============

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const sectionMap = {
        'trending': 'trendingSection',
        'streams': 'streamsSection',
        'tokens': 'tokensSection',
        'admin': 'adminSection'
    };
    
    document.getElementById(sectionMap[tabName]).classList.add('active');
    
    // Load section data if needed
    if (tabName === 'admin' && isAdmin) {
        loadAdminDashboard();
    }
}

// ============= TRENDING TOKENS =============

async function loadTrendingTokens() {
    try {
        const response = await fetch(`${API_URL}/tokens/trending`);
        const data = await response.json();
        
        const container = document.getElementById('trendingTokens');
        
        if (data.success && data.tokens.length > 0) {
            container.innerHTML = data.tokens.map(token => createTokenCard(token, true)).join('');
        } else {
            container.innerHTML = '<div class="empty-state">No trending tokens yet</div>';
        }
    } catch (error) {
        console.error('Error loading trending tokens:', error);
        document.getElementById('trendingTokens').innerHTML = 
            '<div class="error">Failed to load trending tokens</div>';
    }
}

function createTokenCard(token, showLiveIndicator = false) {
    const priceChange = token.priceChange24h || 0;
    const changeClass = priceChange >= 0 ? 'positive' : 'negative';
    const changeIcon = priceChange >= 0 ? '📈' : '📉';
    
    return `
        <div class="token-card" onclick="viewToken('${token.address}')">
            <div class="token-card-header">
                <div class="token-symbol">${token.symbol}</div>
                ${showLiveIndicator ? '<div class="live-badge">🔴 LIVE</div>' : ''}
            </div>
            <div class="token-name">${token.name}</div>
            <div class="token-stats">
                <div class="stat">
                    <span class="stat-label">Price</span>
                    <span class="stat-value">$${token.price.toFixed(6)}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">24h</span>
                    <span class="stat-value ${changeClass}">
                        ${changeIcon} ${Math.abs(priceChange).toFixed(2)}%
                    </span>
                </div>
                <div class="stat">
                    <span class="stat-label">Volume</span>
                    <span class="stat-value">$${(token.volume24h || 0).toLocaleString()}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">MCap</span>
                    <span class="stat-value">$${(token.marketCap || 0).toLocaleString()}</span>
                </div>
            </div>
            <div class="token-creator">
                Creator: ${token.creator.slice(0, 6)}...${token.creator.slice(-4)}
            </div>
        </div>
    `;
}

// ============= ALL TOKENS =============

async function loadAllTokens() {
    try {
        const response = await fetch(`${API_URL}/tokens`);
        const data = await response.json();
        
        const container = document.getElementById('allTokens');
        
        if (data.success && data.tokens.length > 0) {
            container.innerHTML = data.tokens.map(token => createTokenCard(token)).join('');
        } else {
            container.innerHTML = '<div class="empty-state">No tokens found</div>';
        }
    } catch (error) {
        console.error('Error loading tokens:', error);
        document.getElementById('allTokens').innerHTML = 
            '<div class="error">Failed to load tokens</div>';
    }
}

// ============= SEARCH =============

async function searchTokens() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query) {
        document.getElementById('searchResults').innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/tokens/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        const container = document.getElementById('searchResults');
        
        if (data.success && data.tokens.length > 0) {
            container.innerHTML = `
                <div class="search-results-list">
                    ${data.tokens.map(token => `
                        <div class="search-result-item" onclick="viewToken('${token.address}')">
                            <div class="token-info">
                                <strong>${token.symbol}</strong> - ${token.name}
                            </div>
                            <div class="token-price">$${token.price.toFixed(6)}</div>
                        </div>
                    `).join('')}
                </div>
            `;
            container.style.display = 'block';
        } else {
            container.innerHTML = '<div class="search-no-results">No tokens found</div>';
            container.style.display = 'block';
        }
    } catch (error) {
        console.error('Error searching tokens:', error);
    }
}

// ============= VIEW TOKEN =============

async function viewToken(address) {
    try {
        const response = await fetch(`${API_URL}/tokens/${address}`);
        const data = await response.json();
        
        if (data.success) {
            showTokenModal(data.token, data.isCreatorLive, data.liveStream);
        }
    } catch (error) {
        console.error('Error loading token:', error);
        alert('Failed to load token details');
    }
}

function showTokenModal(token, isLive, stream) {
    const modal = document.getElementById('tokenModal');
    const detailsContainer = document.getElementById('tokenDetails');
    
    const priceChange = token.priceChange24h || 0;
    const changeClass = priceChange >= 0 ? 'positive' : 'negative';
    
    detailsContainer.innerHTML = `
        <div class="token-details-header">
            <h2>${token.symbol}</h2>
            <h3>${token.name}</h3>
        </div>
        
        ${isLive ? `
            <div class="live-stream-banner">
                <span class="live-indicator">🔴 LIVE</span>
                <span>Creator is streaming now!</span>
                <button onclick="joinStream('${stream.streamId}')" class="btn btn-primary">
                    Join Stream
                </button>
            </div>
        ` : `
            <div class="offline-banner">
                Creator is not streaming right now
            </div>
        `}
        
        <div class="token-stats-grid">
            <div class="stat-card">
                <div class="stat-label">Price</div>
                <div class="stat-value">$${token.price.toFixed(6)}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">24h Change</div>
                <div class="stat-value ${changeClass}">${priceChange.toFixed(2)}%</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Volume 24h</div>
                <div class="stat-value">$${(token.volume24h || 0).toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Market Cap</div>
                <div class="stat-value">$${(token.marketCap || 0).toLocaleString()}</div>
            </div>
        </div>
        
        <div class="token-info-section">
            <h4>Token Information</h4>
            <div class="info-row">
                <span>Contract Address:</span>
                <code>${token.address}</code>
            </div>
            <div class="info-row">
                <span>Creator:</span>
                <code>${token.creator}</code>
            </div>
            <div class="info-row">
                <span>Created:</span>
                <span>${new Date(token.createdAt).toLocaleDateString()}</span>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

function closeTokenModal() {
    document.getElementById('tokenModal').style.display = 'none';
}

// ============= LIVE STREAMS =============

async function loadLiveStreams() {
    try {
        const response = await fetch(`${API_URL}/streams/live`);
        const data = await response.json();
        
        const container = document.getElementById('liveStreams');
        
        if (data.success && data.streams.length > 0) {
            container.innerHTML = data.streams.map(stream => createStreamCard(stream)).join('');
        } else {
            container.innerHTML = '<div class="empty-state">No live streams right now</div>';
        }
    } catch (error) {
        console.error('Error loading streams:', error);
        document.getElementById('liveStreams').innerHTML = 
            '<div class="error">Failed to load streams</div>';
    }
}

function createStreamCard(stream) {
    return `
        <div class="stream-card" onclick="joinStream('${stream.streamId}')">
            <div class="stream-thumbnail">
                <div class="live-badge">🔴 LIVE</div>
                <div class="viewer-badge">${stream.viewers || 0} viewers</div>
            </div>
            <div class="stream-info">
                <h4>${stream.title}</h4>
                <div class="stream-meta">
                    <span class="streamer">${stream.streamerName}</span>
                    <span class="token-badge">${stream.tokenSymbol}</span>
                </div>
            </div>
        </div>
    `;
}

function joinStream(streamId) {
    // Close token modal if open
    closeTokenModal();
    
    // Open stream modal
    showStreamModal(streamId);
}

async function showStreamModal(streamId) {
    try {
        const response = await fetch(`${API_URL}/streams/${streamId}`);
        const data = await response.json();
        
        if (data.success) {
            const modal = document.getElementById('streamModal');
            document.getElementById('streamModalTitle').textContent = data.stream.title;
            document.getElementById('streamInfoTitle').textContent = data.stream.title;
            document.getElementById('streamInfoToken').textContent = `Token: ${data.stream.tokenSymbol}`;
            
            // Setup socket connection
            if (!socket) {
                socket = io('http://localhost:3001');
            }
            
            socket.emit('join-stream', streamId);
            
            socket.on('viewer-count', (count) => {
                document.getElementById('viewerCount').textContent = count;
            });
            
            socket.on('chat-message', (msg) => {
                addChatMessage(msg);
            });
            
            modal.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading stream:', error);
        alert('Failed to load stream');
    }
}

function closeStreamModal() {
    document.getElementById('streamModal').style.display = 'none';
    
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

// ============= GO LIVE =============

async function loadUserTokens() {
    if (!userAddress) return;
    
    try {
        const response = await fetch(`${API_URL}/users/${userAddress}/tokens`);
        const data = await response.json();
        
        const select = document.getElementById('streamTokenSymbol');
        select.innerHTML = '<option value="">-- Select your token --</option>';
        
        if (data.success && data.tokens.length > 0) {
            data.tokens.forEach(token => {
                const option = document.createElement('option');
                option.value = token.symbol;
                option.textContent = `${token.symbol} - ${token.name}`;
                option.dataset.address = token.address;
                select.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'You have not created any tokens yet';
            option.disabled = true;
            select.appendChild(option);
        }
    } catch (error) {
        console.error('Error loading user tokens:', error);
    }
}

function showGoLiveModal() {
    if (!userAddress) {
        alert('Please connect your wallet first!');
        return;
    }
    
    loadUserTokens();
    document.getElementById('goLiveModal').style.display = 'block';
}

function closeGoLiveModal() {
    document.getElementById('goLiveModal').style.display = 'none';
}

function toggleStreamType() {
    const streamType = document.querySelector('input[name="streamType"]:checked').value;
    const obsInstructions = document.getElementById('obsInstructions');
    obsInstructions.style.display = streamType === 'obs' ? 'block' : 'none';
}

async function createStream() {
    const title = document.getElementById('streamTitle').value;
    const tokenSymbol = document.getElementById('streamTokenSymbol').value;
    const streamType = document.querySelector('input[name="streamType"]:checked').value;
    
    if (!title || !tokenSymbol) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/streams/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress: userAddress,
                username: userName,
                title,
                tokenSymbol,
                streamType
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeGoLiveModal();
            
            if (streamType === 'obs' && data.streamingInfo) {
                showObsCredentials(data.streamingInfo);
            } else {
                joinStream(data.stream.streamId);
            }
            
            alert('✅ Stream created successfully!');
            loadLiveStreams();
        } else {
            alert('❌ ' + data.message);
        }
    } catch (error) {
        console.error('Error creating stream:', error);
        alert('❌ Failed to create stream');
    }
}

function showObsCredentials(streamingInfo) {
    const modal = document.getElementById('streamModal');
    document.getElementById('obsCredentials').style.display = 'block';
    document.getElementById('videoPlayer').style.display = 'none';
    
    document.getElementById('rtmpUrl').textContent = streamingInfo.rtmpUrl;
    document.getElementById('streamKey').textContent = streamingInfo.streamKey;
    
    modal.style.display = 'block';
}

function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ Copied to clipboard!');
    });
}

// ============= CHAT =============

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message || !socket) return;
    
    socket.emit('chat-message', {
        from: userName,
        message: message,
        streamId: currentStreamId
    });
    
    input.value = '';
}

function addChatMessage(msg) {
    const container = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.innerHTML = `
        <strong>${msg.from}:</strong> ${msg.message}
    `;
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// ============= ADMIN DASHBOARD =============

async function loadAdminDashboard() {
    if (!isAdmin) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/analytics?address=${userAddress}`);
        const data = await response.json();
        
        if (data.success) {
            displayAdminAnalytics(data.analytics);
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

function displayAdminAnalytics(analytics) {
    const container = document.getElementById('adminDashboard');
    
    container.innerHTML = `
        <div class="admin-stats-grid">
            <div class="admin-stat-card">
                <div class="stat-label">Total Streams</div>
                <div class="stat-value">${analytics.totalStreams}</div>
            </div>
            <div class="admin-stat-card">
                <div class="stat-label">Active Streams</div>
                <div class="stat-value">${analytics.activeStreams}</div>
            </div>
            <div class="admin-stat-card">
                <div class="stat-label">Total Users</div>
                <div class="stat-value">${analytics.totalUsers}</div>
            </div>
            <div class="admin-stat-card">
                <div class="stat-label">Total Tokens</div>
                <div class="stat-value">${analytics.totalTokens}</div>
            </div>
            <div class="admin-stat-card">
                <div class="stat-label">Platform Revenue</div>
                <div class="stat-value">$${analytics.platformRevenue.toFixed(2)}</div>
            </div>
        </div>
        
        <div class="admin-section">
            <h3>Recent Streams</h3>
            <div class="admin-streams-list">
                ${analytics.recentStreams.map(stream => `
                    <div class="admin-stream-item">
                        <strong>${stream.title}</strong>
                        <span>${stream.isLive ? '🔴 Live' : 'Ended'}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ============= CLICK OUTSIDE MODALS =============

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}
