// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAsAythaTq1n_f3GDCz0kcfeifC34aoa_w",
    authDomain: "movie-tv-watchlist.firebaseapp.com",
    projectId: "movie-tv-watchlist",
    storageBucket: "movie-tv-watchlist.firebasestorage.app",
    messagingSenderId: "1033631183758",
    appId: "1:1033631183758:web:157ceb0bb38a04133a6adf"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();