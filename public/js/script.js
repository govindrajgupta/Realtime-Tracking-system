document.addEventListener("DOMContentLoaded", () => {
    const socket = io();
    const map = L.map("map").setView([0, 0], 10);
    const markers = {};
    let userCount = 0;
    let isTracking = true;
    let currentPosition = null;

    // Initialize map with better styling
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
        tileSize: 256,
        zoomOffset: 0,
    }).addTo(map);

    // Custom marker icons
    const userIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="background: #667eea; color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);"><i class="fas fa-user"></i></div>',
        iconSize: [25, 25],
        iconAnchor: [12, 12]
    });

    const myIcon = L.divIcon({
        className: 'custom-marker-me',
        html: '<div style="background: #48bb78; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; box-shadow: 0 4px 15px rgba(72, 187, 120, 0.4); border: 3px solid white;"><i class="fas fa-location-arrow"></i></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    // UI Elements
    const locateBtn = document.getElementById('locate-btn');
    const toggleTrackingBtn = document.getElementById('toggle-tracking');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const fullscreenBtn = document.getElementById('fullscreen');
    const currentCoordsEl = document.getElementById('current-coords');
    const accuracyEl = document.getElementById('accuracy');
    const lastUpdateEl = document.getElementById('last-update');
    const userCountEl = document.getElementById('user-count');
    const usersContainer = document.getElementById('users-container');

    // Utility functions
    function updateTime() {
        const now = new Date();
        lastUpdateEl.textContent = now.toLocaleTimeString();
    }

    function formatCoordinates(lat, lng) {
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    function updateUsersList() {
        usersContainer.innerHTML = '';
        Object.keys(markers).forEach(id => {
            if (id !== socket.id) {
                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                userItem.innerHTML = `<i class="fas fa-circle" style="color: #667eea; margin-right: 8px;"></i>User ${id.substring(0, 8)}`;
                usersContainer.appendChild(userItem);
            }
        });
    }

    // Geolocation handling
    if (navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition((position) => {
            if (!isTracking) return;

            const { latitude, longitude, accuracy } = position.coords;
            currentPosition = { latitude, longitude };

            // Update UI
            currentCoordsEl.textContent = formatCoordinates(latitude, longitude);
            accuracyEl.textContent = `${Math.round(accuracy)} meters`;
            updateTime();

            // Emit location
            socket.emit("send-location", { latitude, longitude });
        }, (error) => {
            console.error("Error obtaining location:", error);
            currentCoordsEl.textContent = "Location unavailable";
            
            // Show user-friendly error messages
            let errorMessage = "Location error occurred";
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = "Location access denied";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = "Location unavailable";
                    break;
                case error.TIMEOUT:
                    errorMessage = "Location request timeout";
                    break;
            }
            currentCoordsEl.textContent = errorMessage;
        }, {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 10000
        });
    } else {
        currentCoordsEl.textContent = "Geolocation not supported";
        alert("Geolocation is not supported by this browser.");
    }

    // Socket event handlers
    socket.on("receive-location", (data) => {
        const { id, latitude, longitude } = data;
        userCount = Object.keys(markers).length + 1;
        userCountEl.textContent = userCount;

        // Determine if this is the current user
        const isCurrentUser = id === socket.id;
        const icon = isCurrentUser ? myIcon : userIcon;

        // Set map view for first location or current user
        if (Object.keys(markers).length === 0 || isCurrentUser) {
            map.setView([latitude, longitude], 16);
        }

        // Add or update marker
        if (markers[id]) {
            markers[id].setLatLng([latitude, longitude]);
        } else {
            markers[id] = L.marker([latitude, longitude], { icon }).addTo(map);
            
            // Add popup
            const popupContent = isCurrentUser 
                ? '<div style="text-align: center;"><strong>📍 You are here</strong><br>Your current location</div>'
                : `<div style="text-align: center;"><strong>👤 User ${id.substring(0, 8)}</strong><br>Last seen: ${new Date().toLocaleTimeString()}</div>`;
            
            markers[id].bindPopup(popupContent);
        }

        updateUsersList();
    });

    socket.on("user-disconnected", (id) => {
        if (markers[id]) {
            map.removeLayer(markers[id]);
            delete markers[id];
            userCount = Object.keys(markers).length;
            userCountEl.textContent = userCount;
            updateUsersList();
        }
    });

    // Button event handlers
    locateBtn.addEventListener('click', () => {
        if (currentPosition) {
            map.setView([currentPosition.latitude, currentPosition.longitude], 16);
            locateBtn.innerHTML = '<i class="fas fa-check"></i> Centered!';
            setTimeout(() => {
                locateBtn.innerHTML = '<i class="fas fa-crosshairs"></i> Center on Me';
            }, 2000);
        }
    });

    toggleTrackingBtn.addEventListener('click', () => {
        isTracking = !isTracking;
        if (isTracking) {
            toggleTrackingBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Tracking';
            toggleTrackingBtn.classList.remove('paused');
        } else {
            toggleTrackingBtn.innerHTML = '<i class="fas fa-play"></i> Resume Tracking';
            toggleTrackingBtn.classList.add('paused');
        }
    });

    zoomInBtn.addEventListener('click', () => {
        map.zoomIn();
    });

    zoomOutBtn.addEventListener('click', () => {
        map.zoomOut();
    });

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
        } else {
            document.exitFullscreen();
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        }
    });

    // Map event handlers
    map.on('zoomend', () => {
        const zoom = map.getZoom();
        if (zoom >= 18) {
            zoomInBtn.style.opacity = '0.5';
            zoomInBtn.style.pointerEvents = 'none';
        } else {
            zoomInBtn.style.opacity = '1';
            zoomInBtn.style.pointerEvents = 'auto';
        }

        if (zoom <= 2) {
            zoomOutBtn.style.opacity = '0.5';
            zoomOutBtn.style.pointerEvents = 'none';
        } else {
            zoomOutBtn.style.opacity = '1';
            zoomOutBtn.style.pointerEvents = 'auto';
        }
    });

    // Add smooth animations for marker updates
    const originalSetLatLng = L.Marker.prototype.setLatLng;
    L.Marker.prototype.setLatLng = function(latlng, options) {
        if (this._map) {
            const oldLatLng = this.getLatLng();
            const newLatLng = L.latLng(latlng);
            
            // Animate marker movement
            let start = null;
            const duration = 1000; // 1 second animation
            
            const animate = (timestamp) => {
                if (!start) start = timestamp;
                const progress = Math.min((timestamp - start) / duration, 1);
                
                const lat = oldLatLng.lat + (newLatLng.lat - oldLatLng.lat) * progress;
                const lng = oldLatLng.lng + (newLatLng.lng - oldLatLng.lng) * progress;
                
                originalSetLatLng.call(this, [lat, lng], options);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };
            
            requestAnimationFrame(animate);
        } else {
            originalSetLatLng.call(this, latlng, options);
        }
        
        return this;
    };

    // Hide loading overlay when everything is ready
    setTimeout(() => {
        document.getElementById('loading-overlay').style.display = 'none';
    }, 2000);
});

// Add CSS for paused state
const style = document.createElement('style');
style.textContent = `
    .control-btn.paused {
        background: #e53e3e !important;
        color: white !important;
    }
    .control-btn.paused:hover {
        background: #c53030 !important;
    }
`;
document.head.appendChild(style);
