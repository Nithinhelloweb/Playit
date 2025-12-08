/**
 * Admin Panel JavaScript
 * Song and user management functionality
 */

// Check authentication and admin status
const user = API.getUser();
if (!user) {
    window.location.href = '/';
} else if (!user.isAdmin) {
    alert('Access denied. Admin only.');
    window.location.href = '/player';
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    API.clearAuth();
    window.location.href = '/';
});

// State
let allSongs = [];
let allUsers = [];

// ===== LOAD DATA =====
const loadSongs = async () => {
    try {
        allSongs = await API.songs.getAll();
        renderSongsTable();
        document.getElementById('songCount').textContent = `${allSongs.length} songs`;
    } catch (error) {
        console.error('Failed to load songs:', error);
    }
};

const loadUsers = async () => {
    try {
        allUsers = await API.admin.getUsers();
        renderUsersTable();
        document.getElementById('userCount').textContent = `${allUsers.length} users`;
    } catch (error) {
        console.error('Failed to load users:', error);
    }
};

// ===== RENDER TABLES =====
const renderSongsTable = () => {
    const tbody = document.getElementById('songsTableBody');

    if (allSongs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No songs uploaded yet</td></tr>';
        return;
    }

    tbody.innerHTML = allSongs.map(song => `
    <tr>
      <td><strong>${song.title}</strong></td>
      <td>${song.artist}</td>
      <td>${song.album || 'Unknown'}</td>
      <td>${formatTime(song.duration)}</td>
      <td>
        <button class="btn-edit" onclick="editSong('${song._id}')">Edit</button>
        <button class="btn-delete" onclick="deleteSong('${song._id}', '${song.title}')">Delete</button>
      </td>
    </tr>
  `).join('');
};

const renderUsersTable = () => {
    const tbody = document.getElementById('usersTableBody');

    if (allUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = allUsers.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td>${u.isAdmin ? '<span class="admin-badge">Admin</span>' : '<span class="user-badge">User</span>'}</td>
      <td>${new Date(u.createdAt).toLocaleDateString()}</td>
      <td>
        ${!u.isAdmin ? `<button class="btn-delete" onclick="deleteUser('${u._id}', '${u.name}')">Delete</button>` : ''}
      </td>
    </tr>
  `).join('');
};

// ===== UPLOAD SONG =====
const uploadForm = document.getElementById('uploadForm');
const songFileInput = document.getElementById('songFile');

// Update file name display
songFileInput.addEventListener('change', (e) => {
    const fileName = e.target.files[0]?.name || 'No file selected';
    document.querySelector('.file-name').textContent = fileName;
});

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorDiv = document.getElementById('uploadError');
    const successDiv = document.getElementById('uploadSuccess');
    const uploadBtn = document.getElementById('uploadBtn');

    // Clear messages
    errorDiv.classList.remove('show');
    successDiv.classList.remove('show');

    // Validate
    const file = songFileInput.files[0];
    if (!file) {
        errorDiv.textContent = 'Please select an audio file';
        errorDiv.classList.add('show');
        return;
    }

    const title = document.getElementById('songTitle').value.trim();
    const artist = document.getElementById('songArtist').value.trim();
    const album = document.getElementById('songAlbum').value.trim();

    if (!title || !artist) {
        errorDiv.textContent = 'Title and artist are required';
        errorDiv.classList.add('show');
        return;
    }

    // Create form data
    const formData = new FormData();
    formData.append('song', file);
    formData.append('title', title);
    formData.append('artist', artist);
    formData.append('album', album);

    // Disable button
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span>Uploading...</span>';

    try {
        await API.admin.uploadSong(formData);

        successDiv.textContent = 'Song uploaded successfully!';
        successDiv.classList.add('show');

        uploadForm.reset();
        document.querySelector('.file-name').textContent = 'No file selected';

        await loadSongs();

        setTimeout(() => {
            successDiv.classList.remove('show');
        }, 5000);
    } catch (error) {
        errorDiv.textContent = error.message || 'Upload failed';
        errorDiv.classList.add('show');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg><span>Upload Song</span>';
    }
});

// ===== EDIT SONG =====
window.editSong = (songId) => {
    const song = allSongs.find(s => s._id === songId);
    if (!song) return;

    document.getElementById('editSongId').value = song._id;
    document.getElementById('editTitle').value = song.title;
    document.getElementById('editArtist').value = song.artist;
    document.getElementById('editAlbum').value = song.album || '';
    document.getElementById('editDuration').value = song.duration;

    document.getElementById('editSongModal').classList.add('active');
};

document.getElementById('closeEditModalBtn').addEventListener('click', () => {
    document.getElementById('editSongModal').classList.remove('active');
});

document.getElementById('editSongForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const songId = document.getElementById('editSongId').value;
    const title = document.getElementById('editTitle').value;
    const artist = document.getElementById('editArtist').value;
    const album = document.getElementById('editAlbum').value;
    const duration = parseInt(document.getElementById('editDuration').value);

    try {
        await API.admin.editSong(songId, { title, artist, album, duration });
        document.getElementById('editSongModal').classList.remove('active');
        await loadSongs();
    } catch (error) {
        alert('Failed to update song: ' + error.message);
    }
});

// ===== DELETE SONG =====
window.deleteSong = async (songId, songTitle) => {
    if (!confirm(`Are you sure you want to delete "${songTitle}"? This action cannot be undone.`)) {
        return;
    }

    try {
        await API.admin.deleteSong(songId);
        await loadSongs();
    } catch (error) {
        alert('Failed to delete song: ' + error.message);
    }
};

// ===== DELETE USER =====
window.deleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
        return;
    }

    try {
        await API.admin.deleteUser(userId);
        await loadUsers();
    } catch (error) {
        alert('Failed to delete user: ' + error.message);
    }
};

// ===== UTILITY =====
const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ===== INITIALIZE =====
loadSongs();
loadUsers();
/**
 * ADMIN ALBUM COVER MANAGEMENT - Full JavaScript Implementation
 * Add this to admin.js
 */

(function () {
    'use strict';

    const albumGrid = document.getElementById('albumGrid');
    const albumCount = document.getElementById('albumCount');
    let albums = [];

    /**
     * Load all albums from API
     */
    async function loadAlbums() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/albums', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch albums');
            }

            albums = await response.json();
            renderAlbums();
            updateAlbumCount();
        } catch (error) {
            console.error('Error loading albums:', error);
            showError('Failed to load albums');
        }
    }

    /**
     * Render albums grid
     */
    function renderAlbums() {
        if (!albumGrid) return;

        if (albums.length === 0) {
            albumGrid.innerHTML = `
                <div class="albums-empty">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <p>No albums found. Upload some songs to get started!</p>
                </div>
            `;
            return;
        }

        albumGrid.innerHTML = albums.map(album => createAlbumCard(album)).join('');

        // Attach event listeners
        attachAlbumEventListeners();
    }

    /**
     * Create album card HTML
     */
    function createAlbumCard(album) {
        const hasCover = album.coverImage && album.coverImage !== 'null';
        const coverPreview = hasCover
            ? `<img src="${album.coverImage}" alt="${album.name}" />`
            : `<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>`;

        return `
            <div class="admin-album-card" data-album="${escapeHtml(album.name)}">
                <div class="album-cover-preview">
                    ${coverPreview}
                    <div class="album-cover-overlay">
                        <button class="btn-upload-cover" data-action="upload">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            ${hasCover ? 'Change' : 'Upload'}
                        </button>
                        ${hasCover ? `
                        <button class="btn-remove-cover" data-action="remove">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            Remove
                        </button>
                        ` : ''}
                    </div>
                </div>
                <div class="album-card-info">
                    <div class="album-card-name">${escapeHtml(album.name)}</div>
                    <div class="album-card-artist">${escapeHtml(album.artist || 'Various Artists')}</div>
                    <div class="album-card-meta">${album.songCount} ${album.songCount === 1 ? 'song' : 'songs'}</div>
                </div>
                <input type="file" class="album-cover-input" accept="image/jpeg,image/jpg,image/png,image/webp" data-album="${escapeHtml(album.name)}" />
            </div>
        `;
    }

    /**
     * Attach event listeners to album cards
     */
    function attachAlbumEventListeners() {
        // Upload buttons
        const uploadButtons = albumGrid.querySelectorAll('[data-action="upload"]');
        uploadButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.admin-album-card');
                const albumName = card.dataset.album;
                const fileInput = card.querySelector('.album-cover-input');
                fileInput.click();
            });
        });

        // Remove buttons
        const removeButtons = albumGrid.querySelectorAll('[data-action="remove"]');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.admin-album-card');
                const albumName = card.dataset.album;
                removeAlbumCover(albumName, card);
            });
        });

        // File inputs
        const fileInputs = albumGrid.querySelectorAll('.album-cover-input');
        fileInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const card = input.closest('.admin-album-card');
                    const albumName = input.dataset.album;
                    uploadAlbumCover(albumName, file, card);
                }
            });
        });
    }

    /**
     * Upload album cover
     */
    async function uploadAlbumCover(albumName, file, card) {
        // Validate file
        if (file.size > 5 * 1024 * 1024) {
            showError('Image size must be less than 5MB');
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            showError('Only JPEG, PNG, and WebP images are allowed');
            return;
        }

        // Show loading state
        card.classList.add('uploading');

        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('cover', file);

            const response = await fetch(`/api/albums/${encodeURIComponent(albumName)}/cover`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Upload failed');
            }

            const result = await response.json();

            // Show success
            showSuccess(`Album cover updated for ${result.updatedCount} song(s)`);

            // Reload albums to show new cover
            await loadAlbums();

        } catch (error) {
            console.error('Upload error:', error);
            showError(error.message || 'Failed to upload album cover');
            card.classList.remove('uploading');
        }
    }

    /**
     * Remove album cover
     */
    async function removeAlbumCover(albumName, card) {
        if (!confirm(`Remove cover for "${albumName}"? This will affect all songs in this album.`)) {
            return;
        }

        // Show loading state
        card.classList.add('uploading');

        try {
            const token = localStorage.getItem('token');

            const response = await fetch(`/api/albums/${encodeURIComponent(albumName)}/cover`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Delete failed');
            }

            const result = await response.json();

            // Show success
            showSuccess(`Removed cover from ${result.updatedCount} song(s)`);

            // Reload albums
            await loadAlbums();

        } catch (error) {
            console.error('Delete error:', error);
            showError(error.message || 'Failed to remove album cover');
            card.classList.remove('uploading');
        }
    }

    /**
     * Update album count display
     */
    function updateAlbumCount() {
        if (albumCount) {
            albumCount.textContent = `${albums.length} ${albums.length === 1 ? 'album' : 'albums'}`;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show success message
     */
    function showSuccess(message) {
        // You can customize this to use your existing notification system
        const successEl = document.getElementById('uploadSuccess');
        if (successEl) {
            successEl.textContent = message;
            successEl.style.display = 'block';
            setTimeout(() => {
                successEl.style.display = 'none';
            }, 5000);
        } else {
            alert(message);
        }
    }

    /**
     * Show error message
     */
    function showError(message) {
        // You can customize this to use your existing notification system
        const errorEl = document.getElementById('uploadError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            setTimeout(() => {
                errorEl.style.display = 'none';
            }, 5000);
        } else {
            alert('Error: ' + message);
        }
    }

    // Initialize on page load
    if (albumGrid) {
        loadAlbums();
        console.log('✅ Album cover management initialized');
    }

    // Refresh albums when a new song is uploaded
    window.addEventListener('songUploaded', () => {
        loadAlbums();
    });

})();
