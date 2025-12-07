/**
 * API Service
 * Centralized HTTP client for all API requests
 */

// Dynamic API URL - works both locally and on Vercel
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : `${window.location.origin}/api`;

/**
 * Get authentication token from localStorage
 * @returns {string|null} JWT token
 */
const getToken = () => {
    return localStorage.getItem('token');
};

/**
 * Get user data from localStorage
 * @returns {Object|null} User object
 */
const getUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
};

/**
 * Save user data and token to localStorage
 * @param {Object} data - Response from login/signup
 */
const saveAuth = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify({
        id: data._id,
        name: data.name,
        email: data.email,
        isAdmin: data.isAdmin
    }));
};

/**
 * Clear authentication data from localStorage
 */
const clearAuth = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

/**
 * Make HTTP request with authentication
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise} Response data
 */
const request = async (endpoint, options = {}) => {
    const token = getToken();

    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        }
    };

    // Add authorization header if token exists
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

        // Handle unauthorized
        if (response.status === 401) {
            clearAuth();
            window.location.href = '/';
            throw new Error('Unauthorized');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }

        return data;
    } catch (error) {
        throw error;
    }
};

/**
 * API Methods
 */
const API = {
    // Auth
    auth: {
        signup: (data) => request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        login: (data) => request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    },

    // Songs
    songs: {
        getAll: () => request('/songs'),
        getById: (id) => request(`/songs/${id}`),
        search: (query) => request(`/songs/search?q=${encodeURIComponent(query)}`),
        getAlbums: () => request('/songs/albums'),
        download: (id) => {
            const token = getToken();
            window.open(`${API_BASE_URL}/songs/download/${id}?token=${token}`, '_blank');
        },
        addToRecentlyPlayed: (id) => request(`/songs/recently-played/${id}`, {
            method: 'POST'
        }),
        getRecentlyPlayed: () => request('/songs/recently-played')
    },

    // Playlists
    playlists: {
        create: (data) => request('/playlists', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        getAll: () => request('/playlists'),
        getById: (id) => request(`/playlists/${id}`),
        update: (id, data) => request(`/playlists/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }),
        delete: (id) => request(`/playlists/${id}`, {
            method: 'DELETE'
        }),
        addSong: (playlistId, songId) => request(`/playlists/${playlistId}/songs`, {
            method: 'POST',
            body: JSON.stringify({ songId })
        }),
        removeSong: (playlistId, songId) => request(`/playlists/${playlistId}/songs/${songId}`, {
            method: 'DELETE'
        })
    },

    // Favorites
    favorites: {
        getAll: () => request('/favorites'),
        add: (songId) => request(`/favorites/${songId}`, {
            method: 'POST'
        }),
        remove: (songId) => request(`/favorites/${songId}`, {
            method: 'DELETE'
        })
    },

    // Admin
    admin: {
        uploadSong: async (formData) => {
            const token = getToken();
            const response = await fetch(`${API_BASE_URL}/admin/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.status === 401) {
                clearAuth();
                window.location.href = '/';
                throw new Error('Unauthorized');
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Upload failed');
            }
            return data;
        },
        editSong: (id, data) => request(`/admin/songs/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }),
        deleteSong: (id) => request(`/admin/songs/${id}`, {
            method: 'DELETE'
        }),
        getUsers: () => request('/admin/users'),
        deleteUser: (id) => request(`/admin/users/${id}`, {
            method: 'DELETE'
        })
    },

    // Helper methods
    getToken,
    getUser,
    saveAuth,
    clearAuth
};
