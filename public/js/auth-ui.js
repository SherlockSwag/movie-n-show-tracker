// Auth UI Event Handlers
document.addEventListener('DOMContentLoaded', function() {
    // Modal elements
    const signinModal = document.getElementById('signin-modal');
    const signupModal = document.getElementById('signup-modal');
    const closeButtons = document.querySelectorAll('.close-modal');
    
    // Auth buttons
    const signInBtn = document.getElementById('sign-in-btn');
    const signUpBtn = document.getElementById('sign-up-btn');
    const signOutBtn = document.getElementById('sign-out-btn');
    
    // Forms
    const signinForm = document.getElementById('signin-form');
    const signupForm = document.getElementById('signup-form');
    
    // Open modals
    signInBtn?.addEventListener('click', () => showModal(signinModal));
    signUpBtn?.addEventListener('click', () => showModal(signupModal));
    
    // Close modals
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            hideModal(signinModal);
            hideModal(signupModal);
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === signinModal) hideModal(signinModal);
        if (event.target === signupModal) hideModal(signupModal);
    });
    
    // Sign out
    signOutBtn?.addEventListener('click', async () => {
        const result = await authManager.signOut();
        if (result.success) {
            showMessage('Signed out successfully', 'success');
        }
    });
    
    // Sign in form
    signinForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signin-email').value;
        const password = document.getElementById('signin-password').value;
        
        const result = await authManager.signIn(email, password);
        if (result.success) {
            hideModal(signinModal);
            signinForm.reset();
            showMessage('Signed in successfully!', 'success');
        } else {
            showMessage(result.error, 'error', 'signin-message');
        }
    });
    
    // Sign up form
    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        
        const result = await authManager.signUp(email, password, name);
        if (result.success) {
            hideModal(signupModal);
            signupForm.reset();
            showMessage('Account created successfully!', 'success');
        } else {
            showMessage(result.error, 'error', 'signup-message');
        }
    });
    
    function showModal(modal) {
        modal.style.display = 'block';
    }
    
    function hideModal(modal) {
        modal.style.display = 'none';
        // Clear messages
        const messages = modal.querySelectorAll('.auth-message');
        messages.forEach(msg => msg.textContent = '');
    }
    
    function showMessage(text, type, elementId = null) {
        if (elementId) {
            const messageEl = document.getElementById(elementId);
            messageEl.textContent = text;
            messageEl.className = `auth-message ${type}`;
        } else {
            // Show temporary message (you might want to implement a toast system)
            console.log(`${type}: ${text}`);
        }
    }
});