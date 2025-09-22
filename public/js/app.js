document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results-container');
    const filterButtons = document.querySelectorAll('.filter-btn');

    // IMPORTANT: Replace with your actual TMDB API key
    const apiKey = '06251a03ea2bdbb4cf38b681d8263a92';
    const apiBaseUrl = 'https://api.themoviedb.org/3';
    
    let currentFilter = 'movie';

    // Function to get both lists to check for existence
    const getStoredLists = () => {
        const watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
        const watchedlist = JSON.parse(localStorage.getItem('watchedlist')) || [];
        return { watchlist, watchedlist };
    };

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.filter;
            if (searchInput.value.trim()) {
                searchForm.dispatchEvent(new Event('submit'));
            }
        });
    });

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) return;

        resultsContainer.innerHTML = `<div class="placeholder"><p><i class="fa-solid fa-spinner fa-spin"></i> Searching...</p></div>`;

        try {
            const endpoint = `${apiBaseUrl}/search/${currentFilter}?api_key=${apiKey}&query=${encodeURIComponent(query)}`;
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
                    const detailUrl = `${apiBaseUrl}/${currentFilter}/${item.id}?api_key=${apiKey}`;
                    const detailResponse = await fetch(detailUrl);
                    
                    if (!detailResponse.ok) {
                        console.warn(`Failed to fetch details for ${item.id}`);
                        return { ...item, overview: item.overview || "No synopsis available." };
                    }
                    
                    const details = await detailResponse.json();
                    return { ...item, ...details };
                } catch (error) {
                    console.warn(`Error fetching details for ${item.id}:`, error);
                    return { ...item, overview: item.overview || "No synopsis available." };
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
    });

    function displayResults(items) {
        resultsContainer.innerHTML = '';
        const { watchlist, watchedlist } = getStoredLists();

        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.classList.add('item-card');

            const title = item.title || item.name || 'Unknown Title';
            const releaseDate = item.release_date || item.first_air_date;
            const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
            const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : 'https://via.placeholder.com/200x300/333333/ffffff?text=No+Image';
            const synopsis = item.overview || "No synopsis available.";
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
                            <button class="action-btn add-btn ${isAdded ? 'added' : ''}" 
                                    data-id="${item.id}" 
                                    data-type="${currentFilter}" 
                                    ${isAdded ? 'disabled' : ''}
                                    title="${isAdded ? 'Already in list' : 'Add to watchlist'}">
                                <i class="fa-solid ${isAdded ? 'fa-check' : 'fa-plus'}"></i>
                            </button>
                        </div>
                    </div>
                    <div class="item-meta">
                        <span><i class="fa-solid fa-calendar"></i> ${formattedDate}</span>
                        <span><i class="fa-solid fa-star"></i> ${userScore}%</span>
                        <span><i class="fa-solid fa-clock"></i> ${runtime}${runtime !== 'N/A' ? 'm' : ''}</span>
                    </div>
                    <p class="genres">${genres}</p>
                    <p class="plot">${synopsis}</p>
                </div>
            `;

            // Make cards clickable
            itemElement.addEventListener('click', (e) => {
                // Don't trigger if clicking on action buttons
                if (!e.target.closest('.action-buttons')) {
                    window.location.href = `detail.html?type=${currentFilter}&id=${item.id}`;
                }
            });

            resultsContainer.appendChild(itemElement);
        });
    }

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
            }
        }
    });
});