document.addEventListener('DOMContentLoaded', function() {
    initializeWatchlistPage();
});

function initializeWatchlistPage() {
    console.log('Initializing watchlist page...');
    
    const movieContainer = document.getElementById('movie-watchlist-container');
    const tvContainer = document.getElementById('tv-watchlist-container');
    
    // Show loading state immediately
    movieContainer.innerHTML = getLoadingHTML('Movies');
    tvContainer.innerHTML = getLoadingHTML('TV Shows');
    
    // Use Firebase auth state observer instead of checking authManager directly
    if (window.auth) {
        // Listen for auth state changes
        window.auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('User authenticated via Firebase observer:', user.email);
                loadWatchlistData();
            } else {
                console.log('No user authenticated via Firebase observer');
                showAuthRequiredMessage();
            }
        });
    } else {
        console.error('Firebase auth not available');
        showAuthRequiredMessage();
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
    
    movieContainer.innerHTML = authMessage;
    tvContainer.innerHTML = '';
    
    // Add event listener to the sign in button
    const signInBtn = document.getElementById('auth-required-signin');
    if (signInBtn) {
        signInBtn.addEventListener('click', function() {
            const signinModal = document.getElementById('signin-modal');
            if (signinModal) signinModal.style.display = 'block';
        });
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
    console.log('Loading watchlist data...');
    
    const { watchlist } = getStoredLists();
    
    console.log(`Found ${watchlist.length} items in watchlist`);
    
    if (watchlist.length === 0) {
        showEmptyState();
        return;
    }
    
    // Separate movies and TV shows
    const movieItems = watchlist.filter(item => item.type === 'movie');
    const tvItems = watchlist.filter(item => item.type === 'tv');
    
    console.log(`Processing ${movieItems.length} movies and ${tvItems.length} TV shows`);
    
    try {
        // Load both in parallel
        const [movieResults, tvResults] = await Promise.all([
            loadItemsDetails(movieItems, 'movie'),
            loadItemsDetails(tvItems, 'tv')
        ]);
        
        displayAllItems(movieResults, tvResults);
    } catch (error) {
        console.error('Error loading watchlist items:', error);
        showErrorState();
    }
}

async function loadItemsDetails(items, type) {
    if (items.length === 0) return [];
    
    const apiKey = '06251a03ea2bdbb4cf38b681d8263a92';
    const apiBaseUrl = 'https://api.themoviedb.org/3';
    
    // Load all items in parallel
    const promises = items.map(async (item) => {
        try {
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
    
    const results = await Promise.allSettled(promises);
    return results.filter(result => result.status === 'fulfilled').map(result => result.value);
}

function displayAllItems(movies, tvShows) {
    const movieContainer = document.getElementById('movie-watchlist-container');
    const tvContainer = document.getElementById('tv-watchlist-container');
    
    console.log(`Displaying ${movies.length} movies and ${tvShows.length} TV shows`);
    
    // Display movies
    if (movies.length > 0) {
        movieContainer.innerHTML = movies.map(item => createItemCard(item, 'movie')).join('');
        setupItemInteractions(movieContainer);
    } else {
        movieContainer.innerHTML = getEmptySectionHTML('movies');
    }
    
    // Display TV shows
    if (tvShows.length > 0) {
        tvContainer.innerHTML = tvShows.map(item => createItemCard(item, 'tv')).join('');
        setupItemInteractions(tvContainer);
    } else {
        tvContainer.innerHTML = getEmptySectionHTML('TV shows');
    }
}

function createItemCard(item, type) {
    const title = item.title;
    const releaseDate = item.release_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
    const posterUrl = item.poster_path 
        ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
        : 'https://via.placeholder.com/200x300/333333/ffffff?text=No+Image';
    const userScore = item.vote_average ? Math.round(item.vote_average * 10) : 'N/A';
    const runtime = item.runtime || item.episode_run_time?.[0] || 'N/A';
    const genres = item.genres || 'N/A';
    const formattedDate = releaseDate ? new Date(releaseDate).toLocaleDateString() : 'N/A';

    // Handle genres array or string
    const genresText = Array.isArray(genres) ? genres.map(genre => genre.name).join(', ') : genres;

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
                <div class="item-info">
                    <div class="info-row">
                        <i class="fa-solid fa-star"></i>
                        <span class="info-label">Rating:</span>
                        <span class="info-value">${userScore}%</span>
                    </div>
                    <div class="info-row">
                        <i class="fa-solid fa-clock"></i>
                        <span class="info-label">Runtime:</span>
                        <span class="info-value">${runtime}${runtime !== 'N/A' ? ' minutes' : ''}</span>
                    </div>
                    <div class="info-row">
                        <i class="fa-solid fa-calendar"></i>
                        <span class="info-label">Released:</span>
                        <span class="info-value">${formattedDate}</span>
                    </div>
                    <div class="info-row">
                        <i class="fa-solid fa-film"></i>
                        <span class="info-label">Genres:</span>
                        <span class="info-value">${genresText}</span>
                    </div>
                </div>
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
        return { watchlist, watchedlist };
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