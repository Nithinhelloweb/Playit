/**
 * Authentication JavaScript
 * Handles login and signup functionality
 */

// Check if already logged in
const token = localStorage.getItem('token');
if (token) {
    window.location.href = '/player';
}

// Login Form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('errorMessage');
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        // Clear previous errors
        errorMessage.classList.remove('show');
        errorMessage.textContent = '';

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Logging in...</span>';

        try {
            const data = await API.auth.login({ email, password });

            // Save auth data
            API.saveAuth(data);

            // Redirect to player
            window.location.href = '/player';
        } catch (error) {
            errorMessage.textContent = error.message || 'Login failed';
            errorMessage.classList.add('show');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Login</span>';
        }
    });
}

// Signup Form
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('errorMessage');
        const submitBtn = signupForm.querySelector('button[type="submit"]');

        // Clear previous errors
        errorMessage.classList.remove('show');
        errorMessage.textContent = '';

        // Validation
        if (name.length < 2) {
            errorMessage.textContent = 'Name must be at least 2 characters';
            errorMessage.classList.add('show');
            return;
        }

        if (password.length < 6) {
            errorMessage.textContent = 'Password must be at least 6 characters';
            errorMessage.classList.add('show');
            return;
        }

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Creating account...</span>';

        try {
            const data = await API.auth.signup({ name, email, password });

            // Save auth data
            API.saveAuth(data);

            // Redirect to player
            window.location.href = '/player';
        } catch (error) {
            errorMessage.textContent = error.message || 'Signup failed';
            errorMessage.classList.add('show');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Create Account</span>';
        }
    });
}
