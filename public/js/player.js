/**
 * Music Player JavaScript
 * Main player functionality with all controls and features
 */

// Check authentication
const user = API.getUser();
if (!user) {
    window.location.href = '/';
}

/// Display user info
document.getElementById('userName').textContent = user.name;
document.getElementById('userEmail').textContent = user.email;

// Show admin link if user is admin
if (user.isAdmin) {
    document.getElementById('adminLink').style.display = 'block';
    // Show Upload Songs nav item for admin
    document.getElementById('uploadNavItem').style.display = 'flex';
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    API.clearAuth();
    window.location.href = '/';
});

// ===== MOBILE MENU TOGGLE =====
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const sidebar = document.getElementById('sidebar');
const mobileOverlay = document.getElementById('mobileOverlay');

const closeMobileMenu = () => {
    sidebar.classList.remove('active');
    mobileOverlay.classList.remove('active');
    document.body.classList.remove('mobile-menu-open');
    document.body.style.overflow = '';
};

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        mobileOverlay.classList.toggle('active');
        document.body.classList.toggle('mobile-menu-open');
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
    });

    mobileOverlay.addEventListener('click', closeMobileMenu);

    // Auto-close menu when any nav item is clicked
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Small delay to allow the view to switch before closing
            setTimeout(closeMobileMenu, 100);
        });
    });
}

// ===== STATE =====
const state = {
    allSongs: [],
    currentSong: null,
    currentIndex: -1,
    queue: [],
    isPlaying: false,
    isLoading: false,
    isShuffle: false,
    repeatMode: 'none', // 'none', 'all', 'one'
    volume: 0.7,
    favorites: [],
    playlists: [],
    albums: [],
    currentAlbum: null,
    currentView: 'home'
};

// ===== AUDIO ELEMENT =====
const audio = document.getElementById('audioPlayer');
audio.volume = state.volume;

// ===== PLAYBACK STATE PERSISTENCE =====
const PLAYBACK_STATE_KEY = 'musicPlayerState';

const savePlaybackState = () => {
    if (state.currentSong) {
        const playbackState = {
            songId: state.currentSong._id,
            currentTime: audio.currentTime,
            volume: state.volume,
            wasPlaying: state.isPlaying
        };
        localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(playbackState));
    }
};

const restorePlaybackState = async () => {
    try {
        const savedState = localStorage.getItem(PLAYBACK_STATE_KEY);
        if (!savedState) return;

        const playbackState = JSON.parse(savedState);
        const song = state.allSongs.find(s => s._id === playbackState.songId);

        if (song) {
            state.currentSong = song;
            state.currentIndex = state.allSongs.findIndex(s => s._id === song._id);

            // Dynamic API URL for audio streaming
            const apiBaseUrl = window.location.hostname === 'localhost'
                ? 'http://localhost:5000'
                : window.location.origin;
            audio.src = `${apiBaseUrl}/api/songs/stream/${song._id}`;

            // Wait for audio to be ready before setting currentTime
            audio.addEventListener('loadedmetadata', function onLoaded() {
                audio.currentTime = playbackState.currentTime || 0;
                audio.removeEventListener('loadedmetadata', onLoaded);

                // Workaround for browser autoplay policy:
                // Start muted, then unmute after play starts
                const savedVolume = state.volume;
                audio.muted = true;

                audio.play().then(() => {
                    // Successfully started playing (muted), now unmute
                    setTimeout(() => {
                        audio.muted = false;
                        audio.volume = savedVolume;
                    }, 100);
                    state.isPlaying = true;
                    updatePlayerUI();
                    updatePlayingState();
                }).catch(() => {
                    // Even muted autoplay was blocked
                    audio.muted = false;
                    audio.volume = savedVolume;
                    console.log('Autoplay blocked - click play to continue');
                    state.isPlaying = false;
                    updatePlayerUI();
                    updatePlayingState();
                });
            });

            // Restore volume
            if (playbackState.volume !== undefined) {
                state.volume = playbackState.volume;
                audio.volume = state.volume;
                document.getElementById('volumeSlider').value = state.volume * 100;
            }

            updatePlayerUI();
        }
    } catch (error) {
        console.error('Failed to restore playback state:', error);
    }
};

// ===== LOAD INITIAL DATA =====
const loadInitialData = async () => {
    try {
        const [songs, favorites, playlists] = await Promise.all([
            API.songs.getAll(),
            API.favorites.getAll(),
            API.playlists.getAll()
        ]);

        state.allSongs = songs;
        state.favorites = favorites.map(f => f._id);
        state.playlists = playlists;
        state.queue = [...songs];

        renderSongList(songs);
        document.getElementById('songCount').textContent = `${songs.length} songs`;

        // Restore previous playback state after songs are loaded
        await restorePlaybackState();
    } catch (error) {
        console.error('Failed to load data:', error);
    }
};

// ===== NAVIGATION =====
document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', async (e) => {
        e.preventDefault();
        const view = item.dataset.view;

        // Special case: Upload redirects to admin page
        if (view === 'upload') {
            window.location.href = '/admin';
            return;
        }

        // Update active nav (only for items with data-view)
        document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.remove('active'));
        item.classList.add('active');

        // Update active view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${view}View`).classList.add('active');

        // Load view data
        if (view === 'favorites') {
            await loadFavorites();
        } else if (view === 'playlists') {
            await loadPlaylists();
        } else if (view === 'recent') {
            await loadRecentlyPlayed();
        } else if (view === 'albums') {
            await loadAlbums();
        }

        state.currentView = view;
    });
});

// ===== SEARCH =====
const searchInput = document.getElementById('searchInput');
let searchTimeout;

searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();

    if (!query) {
        renderSongList(state.allSongs);
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            const results = await API.songs.search(query);
            renderSongList(results);
        } catch (error) {
            console.error('Search failed:', error);
        }
    }, 300);
});

// ===== RENDER SONG LIST =====
const renderSongList = (songs, containerId = 'songList') => {
    const container = document.getElementById(containerId);

    if (songs.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No songs found</p>';
        return;
    }

    container.innerHTML = songs.map((song, index) => `
    <div class="song-item ${state.currentSong?._id === song._id ? 'playing' : ''}" data-song-id="${song._id}" data-index="${index}">
      <span class="song-index">${index + 1}</span>
      <div class="song-info">
        <p class="song-title">${song.title}</p>
        <p class="song-artist">${song.artist}</p>
      </div>
      <span class="song-duration">${formatTime(song.duration)}</span>
      <div class="song-actions">
        <button class="btn-icon add-to-playlist-btn" data-song-id="${song._id}" title="Add to playlist">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button class="btn-icon favorite-btn ${state.favorites.includes(song._id) ? 'active' : ''}" data-song-id="${song._id}" title="Add to favorites">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="${state.favorites.includes(song._id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

    // Add click handlers
    container.querySelectorAll('.song-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.song-actions')) return;
            const songId = item.dataset.songId;
            const song = songs.find(s => s._id === songId);
            playSong(song, songs);
        });
    });

    // Favorite buttons
    container.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const songId = btn.dataset.songId;
            await toggleFavorite(songId, btn);
        });
    });

    // Add to playlist buttons
    container.querySelectorAll('.add-to-playlist-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const songId = btn.dataset.songId;
            await showAddToPlaylistMenu(songId, btn);
        });
    });
};

// ===== LOADING STATE HELPERS =====
const showLoading = () => {
    state.isLoading = true;
    document.querySelector('.play-icon').classList.add('hidden');
    document.querySelector('.pause-icon').classList.add('hidden');
    document.querySelector('.loading-icon').classList.remove('hidden');
    document.getElementById('albumArt').classList.add('rotating-paused');
};

const hideLoading = () => {
    state.isLoading = false;
    document.querySelector('.loading-icon').classList.add('hidden');
    updatePlayingState();
};

// ===== PLAY SONG =====
const playSong = async (song, queue = null) => {
    if (!song) return;

    state.currentSong = song;
    if (queue) {
        state.queue = queue;
        state.currentIndex = queue.findIndex(s => s._id === song._id);
    }

    // Show loading state
    showLoading();
    updatePlayerUI();

    // Set audio source with dynamic API URL
    const apiBaseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : window.location.origin;
    audio.src = `${apiBaseUrl}/api/songs/stream/${song._id}`;

    // Wait for audio to be ready with timeout
    const playAudio = () => {
        return new Promise((resolve, reject) => {
            let hasStarted = false;
            const timeout = setTimeout(() => {
                if (!hasStarted) {
                    // Timeout - try to play anyway
                    audio.play().then(resolve).catch(reject);
                }
            }, 5000); // 5 second timeout

            const onCanPlay = () => {
                if (!hasStarted) {
                    hasStarted = true;
                    clearTimeout(timeout);
                    audio.removeEventListener('canplay', onCanPlay);
                    audio.removeEventListener('error', onError);
                    audio.play().then(resolve).catch(reject);
                }
            };

            const onError = (err) => {
                hasStarted = true;
                clearTimeout(timeout);
                audio.removeEventListener('canplay', onCanPlay);
                audio.removeEventListener('error', onError);
                reject(err);
            };

            audio.addEventListener('canplay', onCanPlay);
            audio.addEventListener('error', onError);

            // Load the audio
            audio.load();
        });
    };

    try {
        await playAudio();
        state.isPlaying = true;
        hideLoading();

        // Add to recently played
        try {
            await API.songs.addToRecentlyPlayed(song._id);
        } catch (error) {
            console.error('Failed to add to recently played:', error);
        }
    } catch (error) {
        console.error('Error playing song:', error);
        hideLoading();
        state.isPlaying = false;
        updatePlayingState();
    }
};

// ===== UPDATE PLAYER UI =====
const updatePlayerUI = () => {
    if (state.currentSong) {
        document.getElementById('currentSongTitle').textContent = state.currentSong.title;
        document.getElementById('currentSongArtist').textContent = state.currentSong.artist;

        const favoriteBtn = document.getElementById('currentFavoriteBtn');
        if (state.favorites.includes(state.currentSong._id)) {
            favoriteBtn.classList.add('active');
            favoriteBtn.querySelector('svg').setAttribute('fill', 'currentColor');
        } else {
            favoriteBtn.classList.remove('active');
            favoriteBtn.querySelector('svg').setAttribute('fill', 'none');
        }

        const albumArt = document.getElementById('albumArt');
        albumArt.classList.remove('rotating-paused');
        albumArt.classList.add('rotating');
    }
};

// ===== UPDATE PLAYING STATE =====
const updatePlayingState = () => {
    document.querySelectorAll('.song-item').forEach(item => {
        item.classList.remove('playing');
        if (state.currentSong && item.dataset.songId === state.currentSong._id) {
            item.classList.add('playing');
        }
    });

    // Don't update icons if loading
    if (state.isLoading) {
        return;
    }

    const playIcon = document.querySelector('.play-icon');
    const pauseIcon = document.querySelector('.pause-icon');

    if (state.isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        document.getElementById('albumArt').classList.remove('rotating-paused');
    } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        document.getElementById('albumArt').classList.add('rotating-paused');
    }
};

// ===== PLAY/PAUSE =====
document.getElementById('playPauseBtn').addEventListener('click', () => {
    if (!state.currentSong) {
        if (state.queue.length > 0) {
            playSong(state.queue[0], state.queue);
        }
        return;
    }

    if (state.isPlaying) {
        audio.pause();
        state.isPlaying = false;
    } else {
        audio.play();
        state.isPlaying = true;
    }

    updatePlayingState();
});

// ===== NEXT/PREVIOUS =====
document.getElementById('nextBtn').addEventListener('click', () => {
    playNext();
});

document.getElementById('prevBtn').addEventListener('click', () => {
    playPrevious();
});

// ===== SKIP FORWARD/BACKWARD 10 SECONDS =====
document.getElementById('skipForwardBtn').addEventListener('click', () => {
    if (audio.duration) {
        audio.currentTime = Math.min(audio.currentTime + 10, audio.duration);
    }
});

document.getElementById('skipBackBtn').addEventListener('click', () => {
    audio.currentTime = Math.max(audio.currentTime - 10, 0);
});

const playNext = () => {
    if (state.repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
        return;
    }

    let nextIndex;
    if (state.isShuffle) {
        nextIndex = Math.floor(Math.random() * state.queue.length);
    } else {
        nextIndex = state.currentIndex + 1;
        if (nextIndex >= state.queue.length) {
            if (state.repeatMode === 'all') {
                nextIndex = 0;
            } else {
                return;
            }
        }
    }

    state.currentIndex = nextIndex;
    playSong(state.queue[nextIndex]);
};

const playPrevious = () => {
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }

    let prevIndex = state.currentIndex - 1;
    if (prevIndex < 0) {
        prevIndex = state.queue.length - 1;
    }

    state.currentIndex = prevIndex;
    playSong(state.queue[prevIndex]);
};

// ===== SHUFFLE =====
document.getElementById('shuffleBtn').addEventListener('click', function () {
    state.isShuffle = !state.isShuffle;
    this.classList.toggle('active');
});

// ===== REPEAT =====
document.getElementById('repeatBtn').addEventListener('click', function () {
    if (state.repeatMode === 'none') {
        state.repeatMode = 'all';
        this.classList.add('active');
    } else if (state.repeatMode === 'all') {
        state.repeatMode = 'one';
        this.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="17 1 21 5 17 9"></polyline>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
      <polyline points="7 23 3 19 7 15"></polyline>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
      <text x="12" y="16" font-size="8" fill="currentColor" text-anchor="middle">1</text>
    </svg>`;
    } else {
        state.repeatMode = 'none';
        this.classList.remove('active');
        this.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="17 1 21 5 17 9"></polyline>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
      <polyline points="7 23 3 19 7 15"></polyline>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
    </svg>`;
    }
});

// ===== PROGRESS BAR =====
const progressBar = document.getElementById('progressBar');
const progressFilled = document.getElementById('progressFilled');

audio.addEventListener('timeupdate', () => {
    const percent = (audio.currentTime / audio.duration) * 100;
    progressFilled.style.width = `${percent}%`;
    document.getElementById('currentTime').textContent = formatTime(audio.currentTime);
    if (audio.duration) {
        document.getElementById('totalTime').textContent = formatTime(audio.duration);
    }

    // Save playback state every 2 seconds
    if (Math.floor(audio.currentTime) % 2 === 0) {
        savePlaybackState();
    }
});

progressBar.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
});

// ===== AUTO PLAY NEXT =====
audio.addEventListener('ended', () => {
    playNext();
});

// ===== VOLUME =====
const volumeSlider = document.getElementById('volumeSlider');
const muteBtn = document.getElementById('muteBtn');

volumeSlider.addEventListener('input', (e) => {
    state.volume = e.target.value / 100;
    audio.volume = state.volume;
    updateMuteIcon();
});

muteBtn.addEventListener('click', () => {
    if (audio.volume > 0) {
        audio.volume = 0;
        volumeSlider.value = 0;
    } else {
        audio.volume = state.volume;
        volumeSlider.value = state.volume * 100;
    }
    updateMuteIcon();
});

const updateMuteIcon = () => {
    const volumeIcon = muteBtn.querySelector('.volume-icon');
    const muteIcon = muteBtn.querySelector('.mute-icon');

    if (audio.volume === 0) {
        volumeIcon.classList.add('hidden');
        muteIcon.classList.remove('hidden');
    } else {
        volumeIcon.classList.remove('hidden');
        muteIcon.classList.add('hidden');
    }
};

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
        case ' ':
            e.preventDefault();
            document.getElementById('playPauseBtn').click();
            break;
        case 'ArrowRight':
            e.preventDefault();
            audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
            break;
        case 'ArrowLeft':
            e.preventDefault();
            audio.currentTime = Math.max(audio.currentTime - 5, 0);
            break;
        case 'ArrowUp':
            e.preventDefault();
            volumeSlider.value = Math.min(parseInt(volumeSlider.value) + 10, 100);
            volumeSlider.dispatchEvent(new Event('input'));
            break;
        case 'ArrowDown':
            e.preventDefault();
            volumeSlider.value = Math.max(parseInt(volumeSlider.value) - 10, 0);
            volumeSlider.dispatchEvent(new Event('input'));
            break;
    }
});

// ===== FAVORITES =====
const toggleFavorite = async (songId, btn) => {
    try {
        const isFavorite = state.favorites.includes(songId);

        if (isFavorite) {
            await API.favorites.remove(songId);
            state.favorites = state.favorites.filter(id => id !== songId);
            btn.classList.remove('active');
            btn.querySelector('svg').setAttribute('fill', 'none');
        } else {
            await API.favorites.add(songId);
            state.favorites.push(songId);
            btn.classList.add('active');
            btn.querySelector('svg').setAttribute('fill', 'currentColor');
        }

        updatePlayerUI();
    } catch (error) {
        console.error('Failed to toggle favorite:', error);
    }
};

document.getElementById('currentFavoriteBtn').addEventListener('click', async () => {
    if (state.currentSong) {
        const btn = document.getElementById('currentFavoriteBtn');
        await toggleFavorite(state.currentSong._id, btn);
    }
});

const loadFavorites = async () => {
    try {
        const favorites = await API.favorites.getAll();
        state.favorites = favorites.map(f => f._id);
        renderSongList(favorites, 'favoritesList');
        document.getElementById('favoritesCount').textContent = `${favorites.length} songs`;
    } catch (error) {
        console.error('Failed to load favorites:', error);
    }
};

// ===== RECENTLY PLAYED =====
const loadRecentlyPlayed = async () => {
    try {
        const recent = await API.songs.getRecentlyPlayed();
        const songs = recent.map(r => r.song);
        renderSongList(songs, 'recentList');
        document.getElementById('recentCount').textContent = `${songs.length} songs`;
    } catch (error) {
        console.error('Failed to load recently played:', error);
    }
};

// ===== PLAYLISTS =====
const loadPlaylists = async () => {
    try {
        const playlists = await API.playlists.getAll();
        state.playlists = playlists;
        renderPlaylists(playlists);
    } catch (error) {
        console.error('Failed to load playlists:', error);
    }
};

const renderPlaylists = (playlists) => {
    const container = document.getElementById('playlistGrid');

    if (playlists.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No playlists yet. Create one!</p>';
        return;
    }

    container.innerHTML = playlists.map(playlist => `
    <div class="playlist-card" data-playlist-id="${playlist._id}">
      <div class="playlist-icon">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
      </div>
      <p class="playlist-name">${playlist.name}</p>
      <p class="playlist-count">${playlist.songs.length} songs</p>
    </div>
  `).join('');

    container.querySelectorAll('.playlist-card').forEach(card => {
        card.addEventListener('click', () => {
            const playlistId = card.dataset.playlistId;
            const playlist = playlists.find(p => p._id === playlistId);
            if (playlist && playlist.songs.length > 0) {
                renderSongList(playlist.songs);
                state.queue = playlist.songs;
            }
        });
    });
};

// ===== CREATE PLAYLIST =====
document.getElementById('createPlaylistBtn').addEventListener('click', () => {
    document.getElementById('createPlaylistModal').classList.add('active');
});

document.getElementById('closePlaylistModalBtn').addEventListener('click', () => {
    document.getElementById('createPlaylistModal').classList.remove('active');
});

document.getElementById('createPlaylistForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('playlistName').value;
    const description = document.getElementById('playlistDescription').value;

    try {
        await API.playlists.create({ name, description });
        document.getElementById('createPlaylistModal').classList.remove('active');
        document.getElementById('createPlaylistForm').reset();
        await loadPlaylists();
    } catch (error) {
        console.error('Failed to create playlist:', error);
    }
});

// ===== QUEUE =====
document.getElementById('queueBtn').addEventListener('click', () => {
    document.getElementById('queueModal').classList.add('active');
    renderQueue();
});

document.getElementById('closeQueueBtn').addEventListener('click', () => {
    document.getElementById('queueModal').classList.remove('active');
});

const renderQueue = () => {
    const container = document.getElementById('queueList');
    if (state.queue.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Queue is empty</p>';
        return;
    }

    container.innerHTML = state.queue.map((song, index) => `
    <div class="song-item ${state.currentSong?._id === song._id ? 'playing' : ''}" data-index="${index}">
      <span class="song-index">${index + 1}</span>
      <div class="song-info">
        <p class="song-title">${song.title}</p>
        <p class="song-artist">${song.artist}</p>
      </div>
      <span class="song-duration">${formatTime(song.duration)}</span>
    </div>
  `).join('');

    container.querySelectorAll('.song-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            state.currentIndex = index;
            playSong(state.queue[index]);
            document.getElementById('queueModal').classList.remove('active');
        });
    });
};

// ===== ADD TO PLAYLIST =====
const showAddToPlaylistMenu = async (songId, btnElement) => {
    if (state.playlists.length === 0) {
        alert('No playlists available. Create a playlist first!');
        return;
    }

    const playlistOptions = state.playlists.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
    const selection = prompt(`Select playlist number to add song:\n\n${playlistOptions}`);

    if (selection) {
        const index = parseInt(selection) - 1;
        if (index >= 0 && index < state.playlists.length) {
            try {
                await API.playlists.addSong(state.playlists[index]._id, songId);
                alert(`Song added to "${state.playlists[index].name}"!`);
                // Refresh playlists
                const playlists = await API.playlists.getAll();
                state.playlists = playlists;
            } catch (error) {
                alert('Failed to add song to playlist: ' + error.message);
            }
        } else {
            alert('Invalid selection');
        }
    }
};

// ===== ALBUMS =====
const loadAlbums = async () => {
    try {
        const albums = await API.songs.getAlbums();
        state.albums = albums;
        renderAlbums(albums);
        document.getElementById('albumsCount').textContent = `${albums.length} albums`;

        // Reset to grid view
        document.getElementById('albumsGrid').style.display = 'block';
        document.getElementById('albumDetail').style.display = 'none';
    } catch (error) {
        console.error('Failed to load albums:', error);
    }
};

const renderAlbums = (albums) => {
    const container = document.getElementById('albumGrid');

    if (albums.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No albums found</p>';
        return;
    }

    // Generate gradient colors for albums without covers
    const gradients = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
        'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
    ];

    container.innerHTML = albums.map((album, index) => `
    <div class="album-card" data-album-index="${index}">
      <div class="album-cover" style="background: ${album.coverImage ? `url(${album.coverImage})` : gradients[index % gradients.length]}">
        <div class="album-play-overlay">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </div>
      </div>
      <div class="album-info">
        <p class="album-name">${album.name}</p>
        <p class="album-artist">${album.artist}</p>
        <p class="album-song-count">${album.songCount} song${album.songCount !== 1 ? 's' : ''}</p>
      </div>
    </div>
  `).join('');

    // Add click handlers
    container.querySelectorAll('.album-card').forEach(card => {
        card.addEventListener('click', () => {
            const albumIndex = parseInt(card.dataset.albumIndex);
            const album = albums[albumIndex];
            showAlbumDetails(album);
        });
    });
};

const showAlbumDetails = (album) => {
    state.currentAlbum = album;

    // Hide grid, show detail
    document.getElementById('albumsGrid').style.display = 'none';
    document.getElementById('albumDetail').style.display = 'block';

    // Update header info
    document.getElementById('albumDetailName').textContent = album.name;
    document.getElementById('albumDetailArtist').textContent = album.artist;
    document.getElementById('albumDetailMeta').textContent =
        `${album.songCount} song${album.songCount !== 1 ? 's' : ''} • ${formatTime(album.totalDuration)}`;

    // Render songs
    renderSongList(album.songs, 'albumSongsList');
};

// Back to albums grid
document.getElementById('backToAlbumsBtn').addEventListener('click', () => {
    document.getElementById('albumsGrid').style.display = 'block';
    document.getElementById('albumDetail').style.display = 'none';
    state.currentAlbum = null;
});

// Play all songs in album
document.getElementById('playAlbumBtn').addEventListener('click', () => {
    if (state.currentAlbum && state.currentAlbum.songs.length > 0) {
        playSong(state.currentAlbum.songs[0], state.currentAlbum.songs);
    }
});

// ===== UTILITY FUNCTIONS =====
const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ===== INITIALIZE =====
loadInitialData();

/**
 * EXPANDABLE PLAYER MODAL - Full JavaScript Implementation
 * Add this to player.js or create a new file and include it in player.html
 */

(function () {
    'use strict';

    // Modal elements
    const playerModal = document.getElementById('playerModal');
    const playerModalBackdrop = document.getElementById('playerModalBackdrop');
    const closePlayerModal = document.getElementById('closePlayerModal');
    const playerBar = document.getElementById('playerBar');

    // Modal controls
    const modalPlayPauseBtn = document.getElementById('modalPlayPauseBtn');
    const modalPrevBtn = document.getElementById('modalPrevBtn');
    const modalNextBtn = document.getElementById('modalNextBtn');
    const modalShuffleBtn = document.getElementById('modalShuffleBtn');
    const modalRepeatBtn = document.getElementById('modalRepeatBtn');
    const modalProgressBar = document.getElementById('modalProgressBar');
    const modalProgressFilled = document.getElementById('modalProgressFilled');
    const modalCurrentTime = document.getElementById('modalCurrentTime');
    const modalTotalTime = document.getElementById('modalTotalTime');
    const modalVolumeSlider = document.getElementById('modalVolumeSlider');
    const modalMuteBtn = document.getElementById('modalMuteBtn');
    const modalFavoriteBtn = document.getElementById('modalFavoriteBtn');

    // Modal display elements
    const modalAlbumArt = document.getElementById('modalAlbumArt');
    const modalSongTitle = document.getElementById('modalSongTitle');
    const modalSongArtist = document.getElementById('modalSongArtist');
    const modalSongAlbum = document.getElementById('modalSongAlbum');

    // Player bar elements (existing)
    const playPauseBtn = document.getElementById('playPauseBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const shuffleBtn = document.getElementById('shuffleBtn');
    const repeatBtn = document.getElementById('repeatBtn');
    const progressBar = document.getElementById('progressBar');
    const volumeSlider = document.getElementById('volumeSlider');
    const audioPlayer = document.getElementById('audioPlayer');
    const currentFavoriteBtn = document.getElementById('currentFavoriteBtn');

    /**
     * Open the player modal
     */
    function openPlayerModal() {
        playerModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling

        // Sync current state to modal
        syncModalState();
    }

    /**
     * Close the player modal
     */
    function closeModal() {
        playerModal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }

    /**
     * Sync all player state to modal
     */
    function syncModalState() {
        // Sync song info
        const currentSongTitle = document.getElementById('currentSongTitle');
        const currentSongArtist = document.getElementById('currentSongArtist');

        if (currentSongTitle && modalSongTitle) {
            modalSongTitle.textContent = currentSongTitle.textContent;
        }

        if (currentSongArtist && modalSongArtist) {
            modalSongArtist.textContent = currentSongArtist.textContent;
        }

        // Sync album art
        const albumArt = document.getElementById('albumArt');
        if (albumArt && modalAlbumArt) {
            // Clone the album art content
            modalAlbumArt.innerHTML = albumArt.innerHTML;
        }

        // Sync album name if available from current song
        if (window.currentSong && window.currentSong.album) {
            modalSongAlbum.textContent = window.currentSong.album;
        }

        // Sync play/pause state
        const isPlaying = !audioPlayer.paused;
        updateModalPlayButton(isPlaying);

        // Sync volume
        if (volumeSlider && modalVolumeSlider) {
            modalVolumeSlider.value = volumeSlider.value;
        }

        // Sync shuffle/repeat state
        if (shuffleBtn && modalShuffleBtn) {
            if (shuffleBtn.classList.contains('active')) {
                modalShuffleBtn.classList.add('active');
            } else {
                modalShuffleBtn.classList.remove('active');
            }
        }

        if (repeatBtn && modalRepeatBtn) {
            if (repeatBtn.classList.contains('active')) {
                modalRepeatBtn.classList.add('active');
            } else {
                modalRepeatBtn.classList.remove('active');
            }
        }

        // Sync favorite state
        if (currentFavoriteBtn && modalFavoriteBtn) {
            if (currentFavoriteBtn.classList.contains('active')) {
                modalFavoriteBtn.classList.add('active');
            } else {
                modalFavoriteBtn.classList.remove('active');
            }
        }
    }

    /**
     * Update modal play button state
     */
    function updateModalPlayButton(isPlaying) {
        const playIcon = modalPlayPauseBtn.querySelector('.play-icon');
        const pauseIcon = modalPlayPauseBtn.querySelector('.pause-icon');

        if (isPlaying) {
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
        } else {
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
        }
    }

    /**
     * Update modal progress bar
     */
    function updateModalProgress() {
        if (!audioPlayer || !modalProgressBar) return;

        const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100 || 0;
        modalProgressFilled.style.width = `${progress}%`;

        // Update time displays
        if (modalCurrentTime) {
            modalCurrentTime.textContent = formatTime(audioPlayer.currentTime);
        }
        if (modalTotalTime) {
            modalTotalTime.textContent = formatTime(audioPlayer.duration);
        }
    }

    /**
     * Format time in MM:SS
     */
    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Handle modal progress bar click
     */
    function handleModalProgressClick(e) {
        if (!audioPlayer) return;

        const rect = modalProgressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audioPlayer.currentTime = percent * audioPlayer.duration;
    }

    /**
     * Handle modal volume change
     */
    function handleModalVolumeChange() {
        if (!audioPlayer || !volumeSlider) return;

        const volume = modalVolumeSlider.value / 100;
        audioPlayer.volume = volume;
        volumeSlider.value = modalVolumeSlider.value; // Sync to main player
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================

    // Open modal when clicking player bar
    if (playerBar) {
        playerBar.addEventListener('click', (e) => {
            // Don't open if clicking buttons
            if (e.target.closest('button') || e.target.closest('input[type="range"]')) {
                return;
            }
            openPlayerModal();
        });
    }

    // Close modal events
    if (closePlayerModal) {
        closePlayerModal.addEventListener('click', closeModal);
    }

    if (playerModalBackdrop) {
        playerModalBackdrop.addEventListener('click', closeModal);
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && playerModal.classList.contains('active')) {
            closeModal();
        }
    });

    // Modal control buttons
    if (modalPlayPauseBtn && playPauseBtn) {
        modalPlayPauseBtn.addEventListener('click', () => {
            playPauseBtn.click(); // Trigger existing player logic
        });
    }

    if (modalPrevBtn && prevBtn) {
        modalPrevBtn.addEventListener('click', () => {
            prevBtn.click();
        });
    }

    if (modalNextBtn && nextBtn) {
        modalNextBtn.addEventListener('click', () => {
            nextBtn.click();
        });
    }

    if (modalShuffleBtn && shuffleBtn) {
        modalShuffleBtn.addEventListener('click', () => {
            shuffleBtn.click();
            // Sync state
            setTimeout(() => {
                if (shuffleBtn.classList.contains('active')) {
                    modalShuffleBtn.classList.add('active');
                } else {
                    modalShuffleBtn.classList.remove('active');
                }
            }, 100);
        });
    }

    if (modalRepeatBtn && repeatBtn) {
        modalRepeatBtn.addEventListener('click', () => {
            repeatBtn.click();
            // Sync state
            setTimeout(() => {
                if (repeatBtn.classList.contains('active')) {
                    modalRepeatBtn.classList.add('active');
                } else {
                    modalRepeatBtn.classList.remove('active');
                }
            }, 100);
        });
    }

    if (modalFavoriteBtn && currentFavoriteBtn) {
        modalFavoriteBtn.addEventListener('click', () => {
            currentFavoriteBtn.click();
            // Sync state
            setTimeout(() => {
                if (currentFavoriteBtn.classList.contains('active')) {
                    modalFavoriteBtn.classList.add('active');
                    modalFavoriteBtn.querySelector('svg').style.fill = 'var(--primary-pink)';
                } else {
                    modalFavoriteBtn.classList.remove('active');
                    modalFavoriteBtn.querySelector('svg').style.fill = 'none';
                }
            }, 100);
        });
    }

    // Progress bar click
    if (modalProgressBar) {
        modalProgressBar.addEventListener('click', handleModalProgressClick);
    }

    // Volume slider
    if (modalVolumeSlider) {
        modalVolumeSlider.addEventListener('input', handleModalVolumeChange);
    }

    // Mute button
    if (modalMuteBtn) {
        modalMuteBtn.addEventListener('click', () => {
            const muteBtn = document.getElementById('muteBtn');
            if (muteBtn) muteBtn.click();
        });
    }

    // Listen to audio player events to update modal
    if (audioPlayer) {
        audioPlayer.addEventListener('timeupdate', () => {
            if (playerModal.classList.contains('active')) {
                updateModalProgress();
            }
        });

        audioPlayer.addEventListener('play', () => {
            updateModalPlayButton(true);
        });

        audioPlayer.addEventListener('pause', () => {
            updateModalPlayButton(false);
        });

        // Update modal when song changes
        audioPlayer.addEventListener('loadedmetadata', () => {
            if (playerModal.classList.contains('active')) {
                syncModalState();
            }
        });
    }

    // Handle window resize for responsive adjustments
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (playerModal.classList.contains('active')) {
                syncModalState();
            }
        }, 250);
    });

    console.log('✅ Expandable Player Modal initialized');

})();
