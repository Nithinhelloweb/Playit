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
