// Auto-save to Firebase when data changes
function setupAutoSave() {
    const originalSetItem = localStorage.setItem;
    
    localStorage.setItem = function(key, value) {
        originalSetItem.apply(this, arguments);
        
        if ((key === 'watchlist' || key === 'watchedlist') && authManager.user) {
            console.log(`Auto-saving ${key} to Firebase`);
            setTimeout(() => {
                authManager.saveUserData().catch(error => {
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
    const detailContainer = document.getElementById('detail-container');
    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('id');
    const itemType = urlParams.get('type');

    const apiKey = '06251a03ea2bdbb4cf38b681d8263a92';
    const apiBaseUrl = 'https://api.themoviedb.org/3';

    if (!itemId || !itemType) {
        detailContainer.innerHTML = '<div class="placeholder"><p>Invalid item ID or type</p></div>';
        return;
    }

    loadItemDetails(itemId, itemType);

    // Function to get both lists
    function getStoredLists() {
        try {
            const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
            const watchedlist = JSON.parse(localStorage.getItem('watchedlist') || '[]');
            
            return {
                watchlist: Array.isArray(watchlist) ? watchlist : [],
                watchedlist: Array.isArray(watchedlist) ? watchedlist : []
            };
        } catch (error) {
            console.error('Error parsing stored lists:', error);
            return { watchlist: [], watchedlist: [] };
        }
    }

    // Function to save both lists
    function saveLists(watchlist, watchedlist) {
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
        localStorage.setItem('watchedlist', JSON.stringify(watchedlist));
        
        if (authManager && authManager.user) {
            authManager.saveUserData();
        }
    }

    // Function to mark item as watched
    function markAsWatched(itemId, itemType) {
        const { watchlist, watchedlist } = getStoredLists();
        
        // Remove from watchlist if it exists there
        const updatedWatchlist = watchlist.filter(item => 
            !(item.id === parseInt(itemId) && item.type === itemType)
        );
        
        // Check if already in watchedlist
        const alreadyWatched = watchedlist.some(item => 
            item.id === parseInt(itemId) && item.type === itemType
        );
        
        let updatedWatchedlist = [...watchedlist];
        
        if (!alreadyWatched) {
            // Add to watchedlist with current date
            updatedWatchedlist.push({
                id: parseInt(itemId),
                type: itemType,
                watchDate: new Date().toISOString()
            });
        }
        
        // Save the updated lists
        saveLists(updatedWatchlist, updatedWatchedlist);
        
        return { updatedWatchlist, updatedWatchedlist };
    }

    // Function to mark item as unwatched
    function markAsUnwatched(itemId, itemType) {
        const { watchlist, watchedlist } = getStoredLists();
        
        // Remove from watchedlist
        const updatedWatchedlist = watchedlist.filter(item => 
            !(item.id === parseInt(itemId) && item.type === itemType)
        );
        
        // Check if already in watchlist
        const alreadyInWatchlist = watchlist.some(item => 
            item.id === parseInt(itemId) && item.type === itemType
        );
        
        let updatedWatchlist = [...watchlist];
        
        if (!alreadyInWatchlist) {
            // Add back to watchlist
            updatedWatchlist.push({
                id: parseInt(itemId),
                type: itemType
            });
        }
        
        // Save the updated lists
        saveLists(updatedWatchlist, updatedWatchedlist);
        
        return { updatedWatchlist, updatedWatchedlist };
    }

    // Function to show temporary messages
    function showMessage(text, type) {
        // Create a temporary message element
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}-message`;
        messageEl.textContent = text;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem;
            border-radius: 4px;
            z-index: 1000;
            color: white;
            font-weight: bold;
        `;
        
        if (type === 'success') {
            messageEl.style.backgroundColor = '#28a745';
        } else if (type === 'error') {
            messageEl.style.backgroundColor = '#dc3545';
        } else if (type === 'info') {
            messageEl.style.backgroundColor = '#17a2b8';
        }
        
        document.body.appendChild(messageEl);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 3000);
    }

    async function loadItemDetails(id, type) {
        detailContainer.innerHTML = `
            <div class="placeholder">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>Loading details...</p>
            </div>
        `;

        try {
            // Fetch main details
            const detailsUrl = `${apiBaseUrl}/${type}/${id}?api_key=${apiKey}`;
            const detailsResponse = await fetch(detailsUrl);
            
            if (!detailsResponse.ok) {
                throw new Error('Failed to fetch details');
            }
            
            const details = await detailsResponse.json();
            
            // Fetch credits
            const creditsUrl = `${apiBaseUrl}/${type}/${id}/credits?api_key=${apiKey}`;
            const creditsResponse = await fetch(creditsUrl);
            const credits = creditsResponse.ok ? await creditsResponse.json() : { cast: [] };

            displayItemDetails(details, credits, type);

        } catch (error) {
            console.error('Error loading item details:', error);
            detailContainer.innerHTML = `
                <div class="placeholder">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <p>Error loading details. Please try again.</p>
                </div>
            `;
        }
    }

    function displayItemDetails(details, credits, type) {
        const { watchlist, watchedlist } = getStoredLists();
        
        const isInWatchlist = watchlist.some(item => item.id === parseInt(itemId) && item.type === itemType);
        const isInWatched = watchedlist.some(item => item.id === parseInt(itemId) && item.type === itemType);

        const title = details.title || details.name;
        const tagline = details.tagline;
        const overview = details.overview || 'No overview available.';
        const posterPath = details.poster_path;
        const backdropPath = details.backdrop_path;
        const voteAverage = details.vote_average ? Math.round(details.vote_average * 10) : 'N/A';
        const releaseDate = details.release_date || details.first_air_date;
        const runtime = details.runtime || details.episode_run_time?.[0] || 'N/A';
        const genres = details.genres ? details.genres.map(genre => genre.name).join(', ') : 'N/A';
        
        const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
        const formattedDate = releaseDate ? new Date(releaseDate).toLocaleDateString() : 'N/A';

        const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w400${posterPath}` : 'https://via.placeholder.com/400x600/333333/ffffff?text=No+Image';
        const backdropUrl = backdropPath ? `https://image.tmdb.org/t/p/w1400${backdropPath}` : '';

        // Get top 10 cast members
        const topCast = credits.cast ? credits.cast.slice(0, 10) : [];

        const detailHTML = `
            <div class="detail-hero" style="${backdropUrl ? `background-image: linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url('${backdropUrl}')` : ''}">
                <div class="detail-content">
                    <div class="detail-poster">
                        <img src="${posterUrl}" alt="${title} Poster" onerror="this.src='https://via.placeholder.com/400x600/333333/ffffff?text=No+Image'">
                    </div>
                    <div class="detail-info">
                        <h1>${title} ${year !== 'N/A' ? `(${year})` : ''}</h1>
                        ${tagline ? `<p class="tagline">"${tagline}"</p>` : ''}
                        
                        <div class="detail-meta">
                            <div class="meta-item">
                                <i class="fa-solid fa-star"></i>
                                <span>${voteAverage}% User Score</span>
                            </div>
                            <div class="meta-item">
                                <i class="fa-solid fa-calendar"></i>
                                <span>${formattedDate}</span>
                            </div>
                            <div class="meta-item">
                                <i class="fa-solid fa-clock"></i>
                                <span>${runtime}${runtime !== 'N/A' ? 'm' : ''}</span>
                            </div>
                        </div>

                        <div class="detail-actions">
                            <button id="add-to-watchlist" class="action-btn large-btn ${isInWatchlist ? 'added' : ''}" 
                                    ${isInWatchlist || isInWatched ? 'disabled' : ''}>
                                <i class="fa-solid ${isInWatchlist ? 'fa-check' : 'fa-plus'}"></i>
                                ${isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                            </button>
                            <button id="mark-watched" class="action-btn large-btn ${isInWatched ? 'watched' : 'unwatched'}">
                                <i class="${isInWatched ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle-check'}"></i>
                                ${isInWatched ? 'Watched' : 'Mark as Watched'}
                            </button>
                        </div>

                        <div class="overview">
                            <h3>Overview</h3>
                            <p>${overview}</p>
                        </div>

                        ${genres !== 'N/A' ? `
                        <div class="genres-section">
                            <h3>Genres</h3>
                            <div class="genres-list">
                                ${details.genres.map(genre => `<span class="genre-tag">${genre.name}</span>`).join('')}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            ${topCast.length > 0 ? `
            <div class="detail-section">
                <h2>Top Cast</h2>
                <div class="cast-grid">
                    ${topCast.map(person => `
                        <div class="cast-item">
                            <div class="cast-photo">
                                ${person.profile_path ? 
                                    `<img src="https://image.tmdb.org/t/p/w200${person.profile_path}" alt="${person.name}">` : 
                                    `<div class="no-photo"><i class="fa-solid fa-user"></i></div>`
                                }
                            </div>
                            <div class="cast-info">
                                <span class="cast-name">${person.name}</span>
                                <span class="cast-character">${person.character || 'Unknown Role'}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        `;

        detailContainer.innerHTML = detailHTML;
        setupActionButtons(parseInt(itemId), itemType);
    }

    function setupActionButtons(itemId, itemType) {
        const watchlistBtn = document.getElementById('add-to-watchlist');
        const watchedBtn = document.getElementById('mark-watched');
        
        if (watchlistBtn) {
            watchlistBtn.addEventListener('click', () => {
                const { watchlist } = getStoredLists();
                const exists = watchlist.some(item => item.id === itemId && item.type === itemType);
                
                if (!exists) {
                    const updatedWatchlist = [...watchlist, { id: itemId, type: itemType }];
                    saveLists(updatedWatchlist, getStoredLists().watchedlist);
                    updateActionButtons(itemId, itemType);
                    showMessage('Added to watchlist!', 'success');
                }
            });
        }
        
        if (watchedBtn) {
            watchedBtn.addEventListener('click', () => {
                const { watchedlist } = getStoredLists();
                const isWatched = watchedlist.some(item => item.id === itemId && item.type === itemType);
                
                if (isWatched) {
                    // Mark as unwatched
                    markAsUnwatched(itemId, itemType);
                    showMessage('Marked as unwatched', 'info');
                } else {
                    // Mark as watched
                    markAsWatched(itemId, itemType);
                    showMessage('Marked as watched!', 'success');
                }
                
                updateActionButtons(itemId, itemType);
            });
        }
    }

    function updateActionButtons(itemId, itemType) {
        const { watchlist, watchedlist } = getStoredLists();
        
        const isInWatchlist = watchlist.some(item => item.id === itemId && item.type === itemType);
        const isInWatched = watchedlist.some(item => item.id === itemId && item.type === itemType);
        
        const watchlistBtn = document.getElementById('add-to-watchlist');
        const watchedBtn = document.getElementById('mark-watched');
        
        if (watchlistBtn) {
            if (isInWatchlist) {
                watchlistBtn.innerHTML = '<i class="fa-solid fa-check"></i> In Watchlist';
                watchlistBtn.classList.add('added');
                watchlistBtn.disabled = true;
            } else if (isInWatched) {
                watchlistBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add to Watchlist';
                watchlistBtn.classList.remove('added');
                watchlistBtn.disabled = true;
            } else {
                watchlistBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add to Watchlist';
                watchlistBtn.classList.remove('added');
                watchlistBtn.disabled = false;
            }
        }
        
        if (watchedBtn) {
            if (isInWatched) {
                watchedBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Watched';
                watchedBtn.classList.add('watched');
                watchedBtn.classList.remove('unwatched');
            } else {
                watchedBtn.innerHTML = '<i class="fa-regular fa-circle-check"></i> Mark as Watched';
                watchedBtn.classList.add('unwatched');
                watchedBtn.classList.remove('watched');
            }
        }
    }
});