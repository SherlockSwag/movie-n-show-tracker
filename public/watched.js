document.addEventListener('DOMContentLoaded', () => {
    const movieContainer = document.getElementById('movie-watched-container');
    const tvContainer = document.getElementById('tv-watched-container');

    // IMPORTANT: Replace with your actual TMDB API key
    const apiKey = '06251a03ea2bdbb4cf38b681d8263a92';
    const apiBaseUrl = 'https://api.themoviedb.org/3';

    const getStoredLists = () => {
        // Parse the lists from localStorage
        const watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
        const watchedlist = JSON.parse(localStorage.getItem('watchedlist')) || [];
        
        // Normalize IDs to numbers for all items in both lists
        // This ensures consistency and fixes the deletion issue
        const normalizeIds = (list) => list.map(item => ({
            ...item,
            id: Number(item.id) // Force convert id to a Number
        }));
        
        return {
            watchlist: normalizeIds(watchlist),
            watchedlist: normalizeIds(watchedlist)
        };
    };

    const saveLists = (watchlist, watchedlist) => {
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
        localStorage.setItem('watchedlist', JSON.stringify(watchedlist));
    };

    const displayItems = async () => {
        let { watchedlist } = getStoredLists();
        movieContainer.innerHTML = '';
        tvContainer.innerHTML = '';

        const movies = watchedlist.filter(item => item.type === 'movie');
        const tvShows = watchedlist.filter(item => item.type === 'tv');

        if (movies.length === 0) movieContainer.innerHTML = '<p class="placeholder">You haven\'t watched any movies yet.</p>';
        if (tvShows.length === 0) tvContainer.innerHTML = '<p class="placeholder">You haven\'t watched any TV shows yet.</p>';

        const fetchAndDisplay = async (items, container) => {
            for (const item of items) {
                const url = `${apiBaseUrl}/${item.type}/${item.id}?api_key=${apiKey}`;
                const response = await fetch(url);
                const details = await response.json();
                
                const itemElement = document.createElement('div');
                itemElement.classList.add('item-card');
                const title = details.title || details.name;
                const year = new Date(details.release_date || details.first_air_date).getFullYear();

                itemElement.innerHTML = `
                    <img src="https://image.tmdb.org/t/p/w200${details.poster_path}" alt="${title} Poster">
                    <div class="item-details">
                        <div class="item-header">
                            <h3>${title} (${year})</h3>
                            <div class="action-buttons">
                                <button title="Move back to Watchlist" class="action-btn move-to-watchlist-btn" data-id="${item.id}" data-type="${item.type}"><i class="fa-solid fa-arrow-rotate-left"></i></button>
                                <button title="Remove" class="action-btn remove-btn" data-id="${item.id}" data-type="${item.type}"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                        <p class="plot">${details.overview}</p>
                    </div>`;
                container.appendChild(itemElement);
            }
        };

        await fetchAndDisplay(movies, movieContainer);
        await fetchAndDisplay(tvShows, tvContainer);
    };

    document.querySelector('.list-page-container').addEventListener('click', (e) => {
        const button = e.target.closest('.action-btn');
        if (!button) return;

        const id = parseInt(button.dataset.id);
        const type = button.dataset.type;
        let { watchlist, watchedlist } = getStoredLists();
        
        if (button.classList.contains('move-to-watchlist-btn')) {
            // Move from watchedlist to watchlist
            const itemToMove = watchedlist.find(i => i.id === id && i.type === type);
            if (itemToMove) {
                watchlist.push(itemToMove);
                watchedlist = watchedlist.filter(i => i.id !== id || i.type !== type);
            }
        } else if (button.classList.contains('remove-btn')) {
            // Remove from watchedlist
            watchedlist = watchedlist.filter(i => i.id !== id || i.type !== type);
        }

        saveLists(watchlist, watchedlist);
        displayItems(); // Refresh the view
    });

    displayItems();
});