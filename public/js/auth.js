class AuthManager {
    constructor() {
        this.user = null;
        this.init();
    }

    init() {
        // Set initial UI state immediately
        this.updateUI();
        
        // Then listen for auth state changes
        auth.onAuthStateChanged((user) => {
            this.user = user;
            this.updateUI();
            if (user) {
                this.loadUserData();
            } else {
                this.clearUserData();
            }
        });
    }

    // Sign up new user - ENHANCED VERSION
    async signUp(email, password, displayName) {
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName });
            
            // Create user document in Firestore with proper structure
            await db.collection('users').doc(userCredential.user.uid).set({
                displayName: displayName,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                watchlist: [],
                watchedlist: [],
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Set empty lists in localStorage
            localStorage.setItem('watchlist', JSON.stringify([]));
            localStorage.setItem('watchedlist', JSON.stringify([]));
            
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Sign in existing user
    async signIn(email, password) {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Sign out
    async signOut() {
        try {
            await auth.signOut();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Enhance updateUI to handle page-specific elements
    updateUI() {
        const authElements = document.querySelectorAll('.auth-only');
        const unauthElements = document.querySelectorAll('.unauth-only');
        const userDisplay = document.getElementById('user-display');
        
        if (this.user) {
            authElements.forEach(el => el.style.display = 'block');
            unauthElements.forEach(el => el.style.display = 'none');
            if (userDisplay) {
                userDisplay.textContent = this.user.displayName || this.user.email;
            }
        } else {
            authElements.forEach(el => el.style.display = 'none');
            unauthElements.forEach(el => el.style.display = 'block');
            if (userDisplay) {
                userDisplay.textContent = '';
            }
        }
        
        // Update page-specific content based on auth state
        this.updatePageContent();
    }

    updatePageContent() {
        const currentPage = window.location.pathname;
        
        if (this.user) {
            // User is authenticated
            if (currentPage.includes('watchlist.html') || currentPage.includes('watched.html')) {
                // These pages will load content via their respective JS files
            }
        } else {
            // User is not authenticated - show appropriate messages
            if (currentPage.includes('watchlist.html')) {
                document.getElementById('movie-watchlist-container').innerHTML = `
                    <div class="placeholder">
                        <i class="fa-solid fa-sign-in-alt"></i>
                        <p>Please sign in to view your watchlist</p>
                    </div>`;
            }
            if (currentPage.includes('watched.html')) {
                document.getElementById('watched-container').innerHTML = `
                    <div class="placeholder">
                        <i class="fa-solid fa-sign-in-alt"></i>
                        <p>Please sign in to view your watched history</p>
                    </div>`;
            }
        }
    }
    // Load user data from Firestore - FIXED VERSION
    async loadUserData() {
        if (!this.user) {
            console.log('No user logged in, skipping data load');
            return;
        }
        
        try {
            const userDoc = await db.collection('users').doc(this.user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                // Load watchlist and watchedlist into localStorage
                localStorage.setItem('watchlist', JSON.stringify(userData.watchlist || []));
                localStorage.setItem('watchedlist', JSON.stringify(userData.watchedlist || []));
                
                console.log('User data loaded from Firebase:', {
                    watchlistCount: (userData.watchlist || []).length,
                    watchedlistCount: (userData.watchedlist || []).length
                });
            } else {
                console.log('No user document found, creating one with empty lists');
                // Create the document with empty lists
                localStorage.setItem('watchlist', JSON.stringify([]));
                localStorage.setItem('watchedlist', JSON.stringify([]));
                
                // Create the document in Firestore
                await this.saveUserData();
            }
        } catch (error) {
            console.error('Error loading user data from Firebase:', error);
        }
    }

    // Save user data to Firestore - FIXED VERSION
    async saveUserData() {
        if (!this.user) {
            console.log('No user logged in, skipping save');
            return;
        }
        
        try {
            const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
            const watchedlist = JSON.parse(localStorage.getItem('watchedlist') || '[]');
            
            console.log('Saving to Firebase:', { 
                watchlistCount: watchlist.length, 
                watchedlistCount: watchedlist.length 
            });
            
            // Use set with merge: true instead of update - this will create the document if it doesn't exist
            await db.collection('users').doc(this.user.uid).set({
                displayName: this.user.displayName || this.user.email,
                email: this.user.email,
                watchlist: watchlist,
                watchedlist: watchedlist,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }); // This is the key change - merge: true
            
            console.log('User data saved successfully to Firebase');
        } catch (error) {
            console.error('Error saving user data to Firebase:', error);
        }
    }

    // Clear user data when signed out
    clearUserData() {
        localStorage.removeItem('watchlist');
        localStorage.removeItem('watchedlist');
    }
}

window.authManager = new AuthManager();