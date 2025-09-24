// Auto-save to Firebase when data changes
function setupAutoSave() {
    const originalSetItem = localStorage.setItem;
    
    localStorage.setItem = function(key, value) {
        originalSetItem.apply(this, arguments);
        
        if ((key === 'watchlist' || key === 'watchedlist') && window.authManager && window.authManager.user) {
            console.log(`Auto-saving ${key} to Firebase`);
            setTimeout(() => {
                window.authManager.saveUserData().catch(error => {
                    console.error('Auto-save failed:', error);
                });
            }, 500);
        }
    };
}

// Initialize auto-save
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        setupAutoSave();
        console.log('Auto-save initialized');
        
        // Wait for auth to initialize, then check authentication
        checkAuthAndInitialize();
    }, 1000);
});

function checkAuthAndInitialize() {
    // Check if authManager is available and user is authenticated
    if (window.authManager && window.authManager.user) {
        console.log('User is authenticated, loading watchlist');
        initializeWatchlistPage();
    } else {
        // Wait a bit more for auth to initialize
        setTimeout(() => {
            if (window.authManager && window.authManager.user) {
                console.log('User authenticated after delay, loading watchlist');
                initializeWatchlistPage();
            } else {
                console.log('User not authenticated, showing auth message');
                showAuthRequiredMessage();
            }
        }, 500);
    }
}

function showAuthRequiredMessage() {
    const movieContainer = document.getElementById('movie-watchlist-container');
    const tvContainer = document.getElementById('tv-watchlist-container');
    
    const authMessage = `
        <div class="placeholder">
            <i class="fa-solid fa-sign-in-alt"></i>
            <h3>Authentication Required</h3>
            <p>Please sign in to view your watchlist</p>
            <button id="auth-required-signin" class="auth-btn" style="margin-top: 1rem;">Sign In</button>
        </div>`;
    
    if (movieContainer) movieContainer.innerHTML = authMessage;
    if (tvContainer) tvContainer.innerHTML = '';
    
    // Add event listener to the sign in button
    const signInBtn = document.getElementById('auth-required-signin');
    if (signInBtn) {
        signInBtn.addEventListener('click', showSignInModal);
    }
}

function showSignInModal() {
    const signinModal = document.getElementById('signin-modal');
    if (signinModal) {
        signinModal.style.display = 'block';
    }
}

async function initializeWatchlistPage() {
    const movieContainer = document.getElementById('movie-watchlist-container');
    const tvContainer = document.getElementById('tv-watchlist-container');
    
    if (!movieContainer || !tvContainer) {
        console.error('Watchlist containers not found');
        return;
    }
    
    // Show loading state for both containers simultaneously
    movieContainer.innerHTML = getLoadingHTML('Movies');
    tvContainer.innerHTML = getLoadingHTML('TV Shows');
    
    try {
        await loadWatchlistData();
    } catch (error) {
        console.error('Error initializing watchlist:', error);
        showErrorState();
    }
}

function getLoadingHTML(type) {
    return `
        <div class="loading-container">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Loading your ${type}...</p>
        </div>`;
}

async function loadWatchlistData() {
    const { watchlist } = getStoredLists();
    
    console.log('Watchlist items to load:', watchlist);
    
    if (!watchlist || watchlist.length === 0) {
        showEmptyState();
        return;
    }
    
    // Batch process items by type for parallel loading
    const movieItems = watchlist.filter(item => item.type === 'movie');
    const tvItems = watchlist.filter(item => item.type === 'tv');
    
    console.log(`Loading ${movieItems.length} movies and ${tvItems.length} TV shows`);
    
    // Load both movie and TV data in parallel
    const [movieResults, tvResults] = await Promise.all([
        loadItemsDetails(movieItems, 'movie'),
        loadItemsDetails(tvItems, 'tv')
    ]);
    
    displayAllItems(movieResults, tvResults);
}

async function loadItemsDetails(items, type) {
    if (!items || items.length === 0) return [];
    
    const apiKey = '06251a03ea2bdbb4cf38b681d8263a92';
    const apiBaseUrl = 'https://api.themoviedb.org/3';
    
    // Batch requests to avoid overwhelming the API
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        batches.push(batch);
    }
    
    const allResults = [];
    
    for (const batch of batches) {
        const batchPromises = batch.map(async (item) => {
            try {
                if (!item.id) {
                    console.warn('Invalid item found:', item);
                    return null;
                }
                
                const url = `${apiBaseUrl}/${type}/${item.id}?api_key=${apiKey}`;
                const response = await fetch(url);
                
                if (!response.ok) throw new Error(`API error: ${response.status}`);
                
                const details = await response.json();
                return {
                    ...item,
                    title: type === 'movie' ? details.title : details.name,
                    poster_path: details.poster_path,
                    release_date: type === 'movie' ? details.release_date : details.first_air_date,
                    overview: details.overview || 'No overview available.'
                };
            } catch (error) {
                console.warn(`Failed to load ${type} ${item.id}:`, error);
                return {
                    ...item,
                    title: `Unknown ${type === 'movie' ? 'Movie' : 'TV Show'}`,
                    poster_path: null,
                    release_date: null,
                    overview: 'Details unavailable.'
                };
            }
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        const successfulResults = batchResults
            .filter(result => result.status === 'fulfilled' && result.value !== null)
            .map(result => result.value);
        
        allResults.push(...successfulResults);
        
        // Small delay between batches
        if (batches.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return allResults;
}

function displayAllItems(movies, tvShows) {
    const movieContainer = document.getElementById('movie-watchlist-container');
    const tvContainer = document.getElementById('tv-watchlist-container');
    
    if (!movieContainer || !tvContainer) return;
    
    // Display movies
    if (movies && movies.length > 0) {
        movieContainer.innerHTML = movies.map(item => createItemCard(item, 'movie')).join('');
        setupItemInteractions(movieContainer);
    } else {
        movieContainer.innerHTML = getEmptySectionHTML('movies');
    }
    
    // Display TV shows
    if (tvShows && tvShows.length > 0) {
        tvContainer.innerHTML = tvShows.map(item => createItemCard(item, 'tv')).join('');
        setupItemInteractions(tvContainer);
    } else {
        tvContainer.innerHTML = getEmptySectionHTML('TV shows');
    }
}

function createItemCard(item, type) {
    if (!item) return '';
    
    const title = item.title || `Unknown ${type}`;
    const releaseDate = item.release_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
    const posterUrl = item.poster_path 
        ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
        : 'https://via.placeholder.com/200x300/333333/ffffff?text=No+Image';
    const synopsis = item.overview || "No synopsis available.";
    const formattedDate = releaseDate ? new Date(releaseDate).toLocaleDateString() : 'N/A';

    return `
        <div class="item-card" data-id="${item.id}" data-type="${item.type}">
            <img src="${posterUrl}" alt="${title} Poster" loading="lazy">
            <div class="item-details">
                <div class="item-header">
                    <h3>${title} ${year !== 'N/A' ? `(${year})` : ''}</h3>
                    <div class="action-buttons">
                        <button class="action-btn watched-btn" title="Mark as Watched">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button class="action-btn remove-btn" title="Remove from Watchlist">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="item-meta">
                    <span><i class="fa-solid fa-calendar"></i> ${formattedDate}</span>
                    <span><i class="fa-solid fa-${type === 'movie' ? 'film' : 'tv'}"></i> ${type === 'movie' ? 'Movie' : 'TV Show'}</span>
                </div>
                <p class="plot">${synopsis}</p>
            </div>
        </div>
    `;
}

function setupItemInteractions(container) {
    // Remove button functionality
    container.querySelectorAll('.remove-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = e.target.closest('.item-card');
            if (!card) return;
            
            const itemId = parseInt(card.dataset.id);
            const itemType = card.dataset.type;
            
            removeFromWatchlist(itemId, itemType);
            showMessage('Removed from watchlist', 'info');
            card.remove();
            
            checkEmptyState();
        });
    });
    
    // Watched button functionality
    container.querySelectorAll('.watched-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = e.target.closest('.item-card');
            if (!card) return;
            
            const itemId = parseInt(card.dataset.id);
            const itemType = card.dataset.type;
            
            markAsWatched(itemId, itemType);
            showMessage('Marked as watched!', 'success');
            card.remove();
            
            checkEmptyState();
        });
    });
    
    // Click to view details
    container.querySelectorAll('.item-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.action-buttons')) {
                const itemId = card.dataset.id;
                const itemType = card.dataset.type;
                window.location.href = `detail.html?type=${itemType}&id=${itemId}`;
            }
        });
    });
}

function checkEmptyState() {
    const movieContainer = document.getElementById('movie-watchlist-container');
    const tvContainer = document.getElementById('tv-watchlist-container');
    
    if (!movieContainer || !tvContainer) return;
    
    const movieItems = movieContainer.querySelectorAll('.item-card').length;
    const tvItems = tvContainer.querySelectorAll('.item-card').length;
    
    if (movieItems === 0) {
        movieContainer.innerHTML = getEmptySectionHTML('movies');
    }
    if (tvItems === 0) {
        tvContainer.innerHTML = getEmptySectionHTML('TV shows');
    }
    
    if (movieItems === 0 && tvItems === 0) {
        showEmptyState();
    }
}

function getEmptySectionHTML(type) {
    return `
        <div class="placeholder">
            <i class="fa-solid fa-${type.includes('movie') ? 'film' : 'tv'}"></i>
            <p>No ${type} in your watchlist.</p>
        </div>`;
}

function showEmptyState() {
    const movieContainer = document.getElementById('movie-watchlist-container');
    const tvContainer = document.getElementById('tv-watchlist-container');
    
    if (!movieContainer || !tvContainer) return;
    
    movieContainer.innerHTML = `
        <div class="placeholder">
            <i class="fa-solid fa-list-check"></i>
            <h3>Your watchlist is empty</h3>
            <p>Start adding movies and TV shows to build your collection!</p>
            <a href="index.html" class="auth-btn" style="margin-top: 1rem; display: inline-block;">Browse Titles</a>
        </div>`;
    tvContainer.innerHTML = '';
}

function showErrorState() {
    const movieContainer = document.getElementById('movie-watchlist-container');
    const tvContainer = document.getElementById('tv-watchlist-container');
    
    if (!movieContainer || !tvContainer) return;
    
    const errorHTML = `
        <div class="placeholder">
            <i class="fa-solid fa-exclamation-triangle"></i>
            <h3>Error Loading Watchlist</h3>
            <p>Please try refreshing the page</p>
            <button onclick="location.reload()" class="auth-btn" style="margin-top: 1rem;">Retry</button>
        </div>`;
    
    movieContainer.innerHTML = errorHTML;
    tvContainer.innerHTML = '';
}

// Utility functions
function getStoredLists() {
    try {
        const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
        const watchedlist = JSON.parse(localStorage.getItem('watchedlist') || '[]');
        return { watchlist: Array.isArray(watchlist) ? watchlist : [], watchedlist: Array.isArray(watchedlist) ? watchedlist : [] };
    } catch (error) {
        console.error('Error parsing stored lists:', error);
        return { watchlist: [], watchedlist: [] };
    }
}

function removeFromWatchlist(itemId, itemType) {
    const { watchlist, watchedlist } = getStoredLists();
    const updatedWatchlist = watchlist.filter(item => !(item.id === itemId && item.type === itemType));
    localStorage.setItem('watchlist', JSON.stringify(updatedWatchlist));
    
    if (window.authManager && window.authManager.user) {
        window.authManager.saveUserData();
    }
}

function markAsWatched(itemId, itemType) {
    const { watchlist, watchedlist } = getStoredLists();
    
    const updatedWatchlist = watchlist.filter(item => !(item.id === itemId && item.type === itemType));
    const updatedWatchedlist = [...watchedlist, {
        id: itemId,
        type: itemType,
        watchDate: new Date().toISOString()
    }];
    
    localStorage.setItem('watchlist', JSON.stringify(updatedWatchlist));
    localStorage.setItem('watchedlist', JSON.stringify(updatedWatchedlist));
    
    if (window.authManager && window.authManager.user) {
        window.authManager.saveUserData();
    }
}

function showMessage(text, type) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}-message`;
    messageEl.textContent = text;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 4px;
        z-index: 1000;
        color: white;
        font-weight: bold;
        animation: slideIn 0.3s ease;
    `;
    
    if (type === 'success') {
        messageEl.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
        messageEl.style.backgroundColor = '#dc3545';
    } else if (type === 'info') {
        messageEl.style.backgroundColor = '#17a2b8';
    }
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 3000);
}