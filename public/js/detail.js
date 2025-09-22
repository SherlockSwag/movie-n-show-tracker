document.addEventListener('DOMContentLoaded', () => {
    const detailContainer = document.getElementById('detail-container');
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    const id = urlParams.get('id');

    // IMPORTANT: Replace with your actual TMDB API key
    const apiKey = '06251a03ea2bdbb4cf38b681d8263a92';
    const apiBaseUrl = 'https://api.themoviedb.org/3';

    if (!type || !id) {
        detailContainer.innerHTML = '<div class="placeholder"><p>Invalid URL parameters.</p></div>';
        return;
    }

    const fetchDetails = async () => {
        try {
            // Fetch basic details
            const detailsUrl = `${apiBaseUrl}/${type}/${id}?api_key=${apiKey}&append_to_response=credits,videos`;
            const response = await fetch(detailsUrl);
            const details = await response.json();

            if (!details.id) {
                throw new Error('Item not found');
            }

            displayDetails(details);
        } catch (error) {
            console.error('Failed to fetch details:', error);
            detailContainer.innerHTML = '<div class="placeholder"><p>Error loading details.</p></div>';
        }
    };

    const displayDetails = (details) => {
        const title = details.title || details.name;
        const releaseDate = details.release_date || details.first_air_date;
        const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
        const formattedDate = releaseDate ? new Date(releaseDate).toLocaleDateString() : 'N/A';
        const userScore = details.vote_average ? Math.round(details.vote_average * 10) : 'N/A';
        const runtime = details.runtime || details.episode_run_time?.[0] || 'N/A';
        const genres = details.genres ? details.genres.map(genre => genre.name).join(', ') : 'N/A';
        const tagline = details.tagline || '';
        const backdropUrl = details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : '';
        const posterUrl = details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : '';
        
        // Get director (for movies) or creators (for TV)
        const directors = details.credits?.crew?.filter(person => person.job === 'Director') || [];
        const creators = details.created_by || [];
        
        // Get main cast (first 6)
        const cast = details.credits?.cast?.slice(0, 6) || [];
        
        // Get trailer
        const trailer = details.videos?.results?.find(video => video.type === 'Trailer' && video.site === 'YouTube');

        // Check if item is in lists
        const getStoredLists = () => {
            const watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
            const watchedlist = JSON.parse(localStorage.getItem('watchedlist')) || [];
            return { watchlist, watchedlist };
        };

        const { watchlist, watchedlist } = getStoredLists();
        const isInWatchlist = watchlist.some(item => item.id === details.id && item.type === type);
        const isInWatched = watchedlist.some(item => item.id === details.id && item.type === type);

        detailContainer.innerHTML = `
            <div class="detail-hero" style="${backdropUrl ? `background-image: linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url('${backdropUrl}')` : ''}">
                <div class="detail-content">
                    <div class="detail-poster">
                        <img src="${posterUrl}" alt="${title} Poster" onerror="this.style.display='none'">
                    </div>
                    <div class="detail-info">
                        <h1>${title} ${year !== 'N/A' ? `(${year})` : ''}</h1>
                        ${tagline ? `<p class="tagline">${tagline}</p>` : ''}
                        
                        <div class="detail-meta">
                            <div class="meta-item">
                                <i class="fa-solid fa-star"></i>
                                <span>${userScore}% User Score</span>
                            </div>
                            <div class="meta-item">
                                <i class="fa-solid fa-calendar"></i>
                                <span>${formattedDate}</span>
                            </div>
                            ${runtime !== 'N/A' ? `
                            <div class="meta-item">
                                <i class="fa-solid fa-clock"></i>
                                <span>${runtime} minutes</span>
                            </div>` : ''}
                        </div>
                        
                        <div class="detail-actions">
                            ${!isInWatchlist && !isInWatched ? `
                            <button class="action-btn large-btn add-to-watchlist" data-id="${details.id}" data-type="${type}">
                                <i class="fa-solid fa-plus"></i> Add to Watchlist
                            </button>` : ''}
                            
                            ${isInWatchlist ? `
                            <button class="action-btn large-btn mark-as-watched" data-id="${details.id}" data-type="${type}">
                                <i class="fa-solid fa-check"></i> Mark as Watched
                            </button>` : ''}
                            
                            ${trailer ? `
                            <button class="action-btn large-btn trailer-btn" data-key="${trailer.key}">
                                <i class="fa-solid fa-play"></i> Watch Trailer
                            </button>` : ''}
                        </div>
                        
                        <div class="overview">
                            <h3>Overview</h3>
                            <p>${details.overview || 'No overview available.'}</p>
                        </div>
                        
                        ${genres !== 'N/A' ? `
                        <div class="genres-section">
                            <h3>Genres</h3>
                            <div class="genres-list">
                                ${details.genres.map(genre => `<span class="genre-tag">${genre.name}</span>`).join('')}
                            </div>
                        </div>` : ''}
                    </div>
                </div>
            </div>
            
            ${(directors.length > 0 || creators.length > 0) ? `
            <div class="detail-section">
                <h2>${type === 'movie' ? 'Director' : 'Creators'}</h2>
                <div class="people-grid">
                    ${type === 'movie' ? 
                        directors.map(director => `
                            <div class="person-item">
                                <span class="person-name">${director.name}</span>
                                <span class="person-role">Director</span>
                            </div>
                        `).join('') : 
                        creators.map(creator => `
                            <div class="person-item">
                                <span class="person-name">${creator.name}</span>
                                <span class="person-role">Creator</span>
                            </div>
                        `).join('')
                    }
                </div>
            </div>` : ''}
            
            ${cast.length > 0 ? `
            <div class="detail-section">
                <h2>Cast</h2>
                <div class="cast-grid">
                    ${cast.map(actor => `
                        <div class="cast-item">
                            <div class="cast-photo">
                                ${actor.profile_path ? 
                                    `<img src="https://image.tmdb.org/t/p/w200${actor.profile_path}" alt="${actor.name}">` : 
                                    `<div class="no-photo"><i class="fa-solid fa-user"></i></div>`
                                }
                            </div>
                            <div class="cast-info">
                                <span class="cast-name">${actor.name}</span>
                                <span class="cast-character">${actor.character || 'N/A'}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}
            
            <!-- Trailer Modal -->
            <div id="trailer-modal" class="modal">
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <div id="trailer-container"></div>
                </div>
            </div>
        `;

        // Add event listeners
        setupEventListeners(details);
    };

    const setupEventListeners = (details) => {
        // Add to watchlist button
        const addToWatchlistBtn = document.querySelector('.add-to-watchlist');
        if (addToWatchlistBtn) {
            addToWatchlistBtn.addEventListener('click', () => {
                const { id, type } = addToWatchlistBtn.dataset;
                let { watchlist } = getStoredLists();
                
                watchlist.push({ id: parseInt(id), type });
                localStorage.setItem('watchlist', JSON.stringify(watchlist));
                
                addToWatchlistBtn.innerHTML = '<i class="fa-solid fa-check"></i> Added to Watchlist';
                addToWatchlistBtn.disabled = true;
            });
        }

        // Mark as watched button
        const markAsWatchedBtn = document.querySelector('.mark-as-watched');
        if (markAsWatchedBtn) {
            markAsWatchedBtn.addEventListener('click', () => {
                const { id, type } = markAsWatchedBtn.dataset;
                let { watchlist, watchedlist } = getStoredLists();
                
                // Remove from watchlist and add to watchedlist
                watchlist = watchlist.filter(item => !(item.id === parseInt(id) && item.type === type));
                watchedlist.push({ id: parseInt(id), type });
                
                localStorage.setItem('watchlist', JSON.stringify(watchlist));
                localStorage.setItem('watchedlist', JSON.stringify(watchedlist));
                
                markAsWatchedBtn.innerHTML = '<i class="fa-solid fa-check"></i> Marked as Watched';
                markAsWatchedBtn.disabled = true;
            });
        }

        // Trailer button
        const trailerBtn = document.querySelector('.trailer-btn');
        const modal = document.getElementById('trailer-modal');
        const closeModal = document.querySelector('.close-modal');

        if (trailerBtn && modal) {
            trailerBtn.addEventListener('click', () => {
                const trailerKey = trailerBtn.dataset.key;
                const trailerContainer = document.getElementById('trailer-container');
                trailerContainer.innerHTML = `
                    <iframe width="100%" height="100%" 
                            src="https://www.youtube.com/embed/${trailerKey}" 
                            frameborder="0" 
                            allowfullscreen>
                    </iframe>`;
                modal.style.display = 'block';
            });

            closeModal.addEventListener('click', () => {
                modal.style.display = 'none';
                document.getElementById('trailer-container').innerHTML = '';
            });

            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    document.getElementById('trailer-container').innerHTML = '';
                }
            });
        }
    };

    const getStoredLists = () => {
        const watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
        const watchedlist = JSON.parse(localStorage.getItem('watchedlist')) || [];
        return { watchlist, watchedlist };
    };

    fetchDetails();
});