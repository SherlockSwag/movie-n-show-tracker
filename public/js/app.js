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
    }, 1000);
});

document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');
    const filterButtons = document.querySelectorAll('.filter-btn');

    const apiKey = '06251a03ea2bdbb4cf38b681d8263a92';
    const apiBaseUrl = 'https://api.themoviedb.org/3';
    
    let currentFilter = 'movie';

    // Function to get both lists to check for existence
    const getStoredLists = () => {
        const watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
        const watchedlist = JSON.parse(localStorage.getItem('watchedlist')) || [];
        return { watchlist, watchedlist };
    };

    // Show the original search page state
    function showOriginalSearchPage() {
        searchInput.value = '';
        currentFilter = 'movie';
        
        filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === 'movie');
        });
        
        // Simple version - icon will be block level due to CSS
        resultsContainer.innerHTML = '<div class="placeholder"><i class="fa-solid fa-clapperboard"></i><p>Start exploring titles to add to your watchlist!</p></div>';
        
        clearSearchState();
        setTimeout(() => {
            searchInput.focus();
        }, 100);
    }

    // Check if we're already on the search page
    function isSearchPage() {
        return window.location.pathname.includes('index.html') || 
               window.location.pathname === '/' ||
               window.location.pathname.endsWith('/');
    }

    // Load saved search state from sessionStorage
    function loadSearchState() {
        // If we're coming from a navigation that should reset, show original page
        const shouldShowOriginal = sessionStorage.getItem('showOriginalPage') === 'true';
        const savedQuery = sessionStorage.getItem('lastSearchQuery');
        
        if (shouldShowOriginal || !savedQuery) {
            showOriginalSearchPage();
            sessionStorage.removeItem('showOriginalPage');
        } else if (savedQuery) {
            searchInput.value = savedQuery;
            currentFilter = sessionStorage.getItem('lastSearchFilter') || 'movie';
            
            // Update active filter button
            filterButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === currentFilter);
            });
            
            // Perform the search if there's a saved query
            if (savedQuery.trim()) {
                performSearch(savedQuery, currentFilter);
            }
        }
    }

    // Save search state to sessionStorage
    function saveSearchState(query, filter) {
        sessionStorage.setItem('lastSearchQuery', query);
        sessionStorage.setItem('lastSearchFilter', filter);
        sessionStorage.setItem('showOriginalPage', 'false');
    }

    // Clear search state
    function clearSearchState() {
        sessionStorage.removeItem('lastSearchQuery');
        sessionStorage.removeItem('lastSearchFilter');
    }

    // Set flag to show original page on next load
    function setShowOriginalPage() {
        sessionStorage.setItem('showOriginalPage', 'true');
    }

    // Navigate to search page with reset
    function navigateToSearchPage() {
        if (isSearchPage()) {
            // If we're already on the search page, just reset it
            showOriginalSearchPage();
        } else {
            // If we're on another page, set flag and navigate
            setShowOriginalPage();
            window.location.href = 'index.html';
        }
    }

    // Perform search function
    async function performSearch(query, filter) {
        if (!query.trim()) {
            showOriginalSearchPage();
            return;
        }

        resultsContainer.innerHTML = `<div class="placeholder"><p><i class="fa-solid fa-spinner fa-spin"></i> Searching...</p></div>`;

        try {
            const endpoint = `${apiBaseUrl}/search/${filter}?api_key=${apiKey}&query=${encodeURIComponent(query)}`;
            const response = await fetch(endpoint);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success === false) {
                throw new Error(data.status_message || 'API error');
            }
            
            const validItems = data.results ? data.results.filter(item => item.poster_path) : [];
            if (validItems.length === 0) {
                resultsContainer.innerHTML = '<div class="placeholder"><p><i class="fa-solid fa-magnifying-glass"></i> No results found. Try a different search term.</p></div>';
                return;
            }

            // Fetch detailed information for each item with error handling
            const detailedItemsPromises = validItems.map(async (item) => {
                try {
                    const detailUrl = `${apiBaseUrl}/${filter}/${item.id}?api_key=${apiKey}`;
                    const detailResponse = await fetch(detailUrl);
                    
                    if (!detailResponse.ok) {
                        console.warn(`Failed to fetch details for ${item.id}`);
                        return { ...item };
                    }
                    
                    const details = await detailResponse.json();
                    return { ...item, ...details };
                } catch (error) {
                    console.warn(`Error fetching details for ${item.id}:`, error);
                    return { ...item };
                }
            });

            const detailedItems = await Promise.allSettled(detailedItemsPromises);
            const successfulItems = detailedItems
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value)
                .filter(item => item !== null);

            if (successfulItems.length === 0) {
                resultsContainer.innerHTML = '<div class="placeholder"><p><i class="fa-solid fa-exclamation-triangle"></i> Error loading results. Please try again.</p></div>';
                return;
            }

            displayResults(successfulItems);

        } catch (error) {
            console.error('Failed to fetch results:', error);
            resultsContainer.innerHTML = `
                <div class="placeholder">
                    <p><i class="fa-solid fa-exclamation-triangle"></i> Error fetching results.</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">${error.message}</p>
                    <p style="font-size: 0.8rem; margin-top: 0.5rem;">Please check your internet connection and try again.</p>
                </div>`;
        }
    }

    function displayResults(items) {
        resultsContainer.innerHTML = '';
        const { watchlist, watchedlist } = getStoredLists();

        if (items.length === 0) {
            resultsContainer.innerHTML = `
                <div class="placeholder">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <p>No results found. Try a different search term.</p>
                </div>`;
            return;
        }

        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.classList.add('item-card');

            const title = item.title || item.name || 'Unknown Title';
            const releaseDate = item.release_date || item.first_air_date;
            const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
            const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : 'https://via.placeholder.com/200x300/333333/ffffff?text=No+Image';
            const userScore = item.vote_average ? Math.round(item.vote_average * 10) : 'N/A';
            const runtime = item.runtime || item.episode_run_time?.[0] || 'N/A';
            const genres = item.genres ? item.genres.map(genre => genre.name).join(', ') : 'N/A';
            const formattedDate = releaseDate ? new Date(releaseDate).toLocaleDateString() : 'N/A';

            const isInWatchlist = watchlist.some(i => i.id === item.id);
            const isInWatched = watchedlist.some(i => i.id === item.id);
            const isAdded = isInWatchlist || isInWatched;

            itemElement.innerHTML = `
                <img src="${posterUrl}" alt="${title} Poster" onerror="this.src='https://via.placeholder.com/200x300/333333/ffffff?text=No+Image'">
                <div class="item-details">
                    <div class="item-header">
                        <h3>${title} ${year !== 'N/A' ? `(${year})` : ''}</h3>
                        <div class="action-buttons">
                            <button class="action-btn add-btn ${isAdded ? 'added' : ''} ${isInWatched ? 'watched-indicator' : ''}" 
                                    data-id="${item.id}" 
                                    data-type="${currentFilter}" 
                                    ${isAdded ? 'disabled' : ''}
                                    title="${isInWatched ? 'Already watched' : isInWatchlist ? 'In watchlist' : 'Add to watchlist'}">
                                <i class="fa-solid ${isInWatched ? 'fa-eye' : isInWatchlist ? 'fa-check' : 'fa-plus'}"></i>
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
                            <span class="info-value">${genres}</span>
                        </div>
                    </div>
                </div>
            `;

            // Make cards clickable
            itemElement.addEventListener('click', (e) => {
                if (!e.target.closest('.action-buttons')) {
                    window.location.href = `detail.html?type=${currentFilter}&id=${item.id}`;
                }
            });

            resultsContainer.appendChild(itemElement);
        });
    }

    // Set up navigation event listeners
    function setupNavigation() {
        // Logo click
        const logoLink = document.querySelector('.logo');
        if (logoLink) {
            logoLink.addEventListener('click', (e) => {
                e.preventDefault();
                navigateToSearchPage();
            });
        }

        // Search nav link click - wait a bit for DOM to be fully ready
        setTimeout(() => {
            const searchNavLinks = document.querySelectorAll('.nav-search-link, a[href="index.html"]');
            searchNavLinks.forEach(link => {
                // Only target the search link in the nav, not other links that might point to index.html
                if (link.closest('.nav-links') || link.textContent.includes('Search') || link.textContent === 'Search') {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        navigateToSearchPage();
                    });
                }
            });
        }, 100);

        // Also handle clicks on the search nav link using event delegation
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href="index.html"]');
            if (link && (link.closest('.nav-links') || link.textContent.includes('Search') || link.textContent === 'Search')) {
                e.preventDefault();
                navigateToSearchPage();
            }
        });
    }

    // Event listener for filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.filter;
            
            // If there's a current search, update it with new filter
            if (searchInput.value.trim()) {
                saveSearchState(searchInput.value, currentFilter);
                performSearch(searchInput.value, currentFilter);
            }
        });
    });

    // Event listener for search form submission
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        
        if (!query) {
            // If empty search, show original page
            showOriginalSearchPage();
            return;
        }
        
        saveSearchState(query, currentFilter);
        await performSearch(query, currentFilter);
    });

    // Handle page refresh
    window.addEventListener('beforeunload', () => {
        // Check if this is a refresh (not navigation)
        if (performance.navigation && performance.navigation.type === 1) {
            setShowOriginalPage();
        }
    });

    // Set up navigation and load initial state
    setupNavigation();
    loadSearchState();

    // Event listener for add to watchlist buttons
    resultsContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.add-btn');
        if (button && !button.disabled) {
            const { id, type } = button.dataset;
            let { watchlist } = getStoredLists();
            
            // Check if item already exists
            const exists = watchlist.some(item => item.id === parseInt(id) && item.type === type);
            if (!exists) {
                watchlist.push({ id: parseInt(id), type });
                localStorage.setItem('watchlist', JSON.stringify(watchlist));
                
                button.innerHTML = '<i class="fa-solid fa-check"></i>';
                button.classList.add('added');
                button.disabled = true;
                button.title = 'Added to watchlist';
                
                // Show success message
                showMessage('Added to watchlist!', 'success');
            }
        }
    });

    // Function to show temporary messages
    function showMessage(text, type) {
        // Remove existing messages first
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());
        
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
});