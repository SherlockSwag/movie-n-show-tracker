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

        resultsContainer.innerHTML = `<div class="placeholder"><p>Searching...</p></div>`;

        const endpoint = `${apiBaseUrl}/search/${currentFilter}?api_key=${apiKey}&query=${encodeURIComponent(query)}`;
        
        try {
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error('Search failed');
            const data = await response.json();
            
            const validItems = data.results.filter(item => item.poster_path);
            if (validItems.length === 0) {
                resultsContainer.innerHTML = '<p class="placeholder">No results found.</p>';
                return;
            }

            const detailedItemsPromises = validItems.map(item => {
                const detailUrl = `${apiBaseUrl}/${currentFilter}/${item.id}?api_key=${apiKey}`;
                return fetch(detailUrl).then(res => res.json()).then(details => ({ ...item, ...details }));
            });

            const detailedItems = await Promise.all(detailedItemsPromises);
            displayResults(detailedItems);

        } catch (error) {
            console.error('Failed to fetch results:', error);
            resultsContainer.innerHTML = `<p class="placeholder">Error fetching results.</p>`;
        }
    });

    function displayResults(items) {
        resultsContainer.innerHTML = '';
        const { watchlist, watchedlist } = getStoredLists();

        items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.classList.add('item-card');

            const title = item.title || item.name;
            const releaseDate = item.release_date || item.first_air_date;
            const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
            const posterUrl = `https://image.tmdb.org/t/p/w200${item.poster_path}`;
            const synopsis = item.overview || "No synopsis available.";
            
            const isInWatchlist = watchlist.some(i => i.id === item.id);
            const isInWatched = watchedlist.some(i => i.id === item.id);
            const isAdded = isInWatchlist || isInWatched;

            itemElement.innerHTML = `
                <img src="${posterUrl}" alt="${title} Poster">
                <div class="item-details">
                    <div class="item-header">
                        <h3>${title} (${year})</h3>
                        <div class="action-buttons">
                            <button class="action-btn add-btn ${isAdded ? 'added' : ''}" 
                                    data-id="${item.id}" 
                                    data-type="${currentFilter}" 
                                    ${isAdded ? 'disabled' : ''}>
                                <i class="fa-solid ${isAdded ? 'fa-check' : 'fa-plus'}"></i>
                            </button>
                        </div>
                    </div>
                    <p class="plot">${synopsis}</p>
                </div>
            `;
            resultsContainer.appendChild(itemElement);
        });
    }

    resultsContainer.addEventListener('click', (e) => {
        const button = e.target.closest('.add-btn');
        if (button && !button.disabled) {
            const { id, type } = button.dataset;
            let { watchlist } = getStoredLists();
            
            watchlist.push({ id: parseInt(id), type });
            localStorage.setItem('watchlist', JSON.stringify(watchlist));
            
            button.innerHTML = '<i class="fa-solid fa-check"></i>';
            button.classList.add('added');
            button.disabled = true;
        }
    });
});