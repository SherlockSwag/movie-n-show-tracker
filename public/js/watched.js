document.addEventListener('DOMContentLoaded', () => {
    const watchedContainer = document.getElementById('watched-container');
    const searchInput = document.getElementById('watched-search');
    const sortSelect = document.getElementById('sort-options');
    const typeFilter = document.getElementById('type-filter');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const totalCount = document.getElementById('total-count');
    const movieCount = document.getElementById('movie-count');
    const tvCount = document.getElementById('tv-count');

    const apiKey = '06251a03ea2bdbb4cf38b681d8263a92';
    const apiBaseUrl = 'https://api.themoviedb.org/3';

    let allWatchedItems = [];
    let displayedItems = [];
    let currentPage = 1;
    const itemsPerPage = 20;
    let currentSearch = '';
    let currentSort = 'date-desc';
    let currentTypeFilter = 'all';

    // Date formatting function for dd/mm/yyyy
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    };

    // Get year range for TV shows
    const getYearRange = (item) => {
        if (!item.release_date && !item.first_air_date) return 'N/A';
        
        const startDate = item.release_date || item.first_air_date;
        const startYear = new Date(startDate).getFullYear();
        
        if (item.type === 'movie') {
            return `(${startYear})`;
        } else {
            // For TV shows, try to get end year if available
            const endYear = item.last_air_date ? new Date(item.last_air_date).getFullYear() : null;
            if (endYear && endYear !== startYear) {
                return `(${startYear} - ${endYear})`;
            } else {
                return `(${startYear})`;
            }
        }
    };

    const getStoredLists = () => {
        try {
            const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
            const watchedlist = JSON.parse(localStorage.getItem('watchedlist') || '[]');
            
            // Ensure we always return arrays
            return {
                watchlist: Array.isArray(watchlist) ? watchlist.map(item => ({ ...item, id: Number(item.id) })) : [],
                watchedlist: Array.isArray(watchedlist) ? watchedlist.map(item => ({
                    ...item,
                    id: Number(item.id),
                    watchDate: item.watchDate || new Date().toISOString()
                })) : []
            };
        } catch (error) {
            console.error('Error parsing stored lists:', error);
            return { watchlist: [], watchedlist: [] };
        }
    };

    const saveLists = (watchlist, watchedlist) => {
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
        localStorage.setItem('watchedlist', JSON.stringify(watchedlist));
    };

    const loadWatchedItems = async () => {
        const { watchedlist } = getStoredLists();
        
        console.log('Loading watched items from localStorage:', watchedlist);
        
        if (!watchedlist || watchedlist.length === 0) {
            watchedContainer.innerHTML = `
                <div class="placeholder full-width">
                    <i class="fa-solid fa-circle-check"></i>
                    <h3>No watched items yet</h3>
                    <p>Start watching movies and TV shows to build your history!</p>
                </div>`;
            updateStats([]); // Pass empty array instead of 0
            loadMoreBtn.style.display = 'none';
            return;
        }

        watchedContainer.innerHTML = `
            <div class="placeholder full-width">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>Loading your watched history...</p>
            </div>`;

        try {
            const itemsWithDetails = await Promise.allSettled(
                watchedlist.map(async (item) => {
                    try {
                        const url = `${apiBaseUrl}/${item.type}/${item.id}?api_key=${apiKey}`;
                        const response = await fetch(url);
                        if (!response.ok) throw new Error('API error');
                        
                        const details = await response.json();
                        return {
                            ...item,
                            title: details.title || details.name,
                            poster_path: details.poster_path,
                            release_date: details.release_date || details.first_air_date,
                            last_air_date: details.last_air_date,
                            media_type: item.type === 'movie' ? 'Movie' : 'TV Show'
                        };
                    } catch (error) {
                        return {
                            ...item,
                            title: `Unknown ${item.type === 'movie' ? 'Movie' : 'TV Show'}`,
                            poster_path: null,
                            release_date: null,
                            last_air_date: null,
                            media_type: item.type === 'movie' ? 'Movie' : 'TV Show'
                        };
                    }
                })
            );

            allWatchedItems = itemsWithDetails
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value);

            console.log('Processed watched items:', allWatchedItems);
            
            updateStats(allWatchedItems);
            filterAndSortItems();
            displayItems();

        } catch (error) {
            console.error('Error loading watched items:', error);
            watchedContainer.innerHTML = `
                <div class="placeholder full-width">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <p>Error loading watched history</p>
                </div>`;
            updateStats([]); // Pass empty array on error
        }
    };

    const updateStats = (items = allWatchedItems) => {
        // Ensure items is an array
        const itemsArray = Array.isArray(items) ? items : allWatchedItems;
        
        const movies = itemsArray.filter(item => item.type === 'movie').length;
        const tvShows = itemsArray.filter(item => item.type === 'tv').length;
        const total = itemsArray.length;
        
        totalCount.textContent = `${total} ${total === 1 ? 'item' : 'items'}`;
        movieCount.textContent = `${movies} ${movies === 1 ? 'movie' : 'movies'}`;
        tvCount.textContent = `${tvShows} ${tvShows === 1 ? 'TV show' : 'TV shows'}`;
    };

    const filterAndSortItems = () => {
        let filtered = allWatchedItems.filter(item => 
            item.title.toLowerCase().includes(currentSearch.toLowerCase())
        );

        if (currentTypeFilter !== 'all') {
            filtered = filtered.filter(item => item.type === currentTypeFilter);
        }

        filtered.sort((a, b) => {
            switch (currentSort) {
                case 'date-desc':
                    return new Date(b.watchDate) - new Date(a.watchDate);
                case 'date-asc':
                    return new Date(a.watchDate) - new Date(b.watchDate);
                case 'title-asc':
                    return a.title.localeCompare(b.title);
                case 'title-desc':
                    return b.title.localeCompare(a.title);
                default:
                    return 0;
            }
        });

        displayedItems = filtered;
        currentPage = 1;
    };

    const displayItems = () => {
        const startIndex = 0;
        const endIndex = currentPage * itemsPerPage;
        const itemsToShow = displayedItems.slice(0, endIndex);

        if (itemsToShow.length === 0) {
            watchedContainer.innerHTML = `
                <div class="placeholder full-width">
                    <i class="fa-solid fa-search"></i>
                    <p>No items found matching your criteria</p>
                </div>`;
            loadMoreBtn.style.display = 'none';
            updateStats([]); // Pass empty array
            return;
        }

        watchedContainer.innerHTML = itemsToShow.map(item => createCompactCard(item)).join('');
        loadMoreBtn.style.display = endIndex < displayedItems.length ? 'block' : 'none';
        updateStats(displayedItems); // This should now work with the fixed updateStats
    };

    const createCompactCard = (item) => {
        const title = item.title;
        const yearRange = getYearRange(item);
        const posterUrl = item.poster_path 
            ? `https://image.tmdb.org/t/p/w154${item.poster_path}`
            : 'https://via.placeholder.com/154x231/333333/ffffff?text=No+Image';
        const mediaType = item.media_type;

        return `
            <div class="compact-card" data-id="${item.id}" data-type="${item.type}">
                <div class="compact-poster">
                    <img src="${posterUrl}" alt="${title}" onerror="this.src='https://via.placeholder.com/154x231/333333/ffffff?text=No+Image'">
                </div>
                <div class="compact-info">
                    <h4 class="compact-title">${title} ${yearRange}</h4>
                    <div class="compact-details">
                        <span class="compact-type">${mediaType}</span>
                    </div>
                </div>
            </div>
        `;
    };

    // Event listeners
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        filterAndSortItems();
        displayItems();
    });

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        filterAndSortItems();
        displayItems();
    });

    typeFilter.addEventListener('change', (e) => {
        currentTypeFilter = e.target.value;
        filterAndSortItems();
        displayItems();
    });

    loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        displayItems();
    });

    watchedContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.compact-card');
        if (card) {
            const id = parseInt(card.dataset.id);
            const type = card.dataset.type;
            window.location.href = `detail.html?type=${type}&id=${id}`;
        }
    });

    // Initial load
    loadWatchedItems();
});