document.addEventListener("DOMContentLoaded", () => {
    const socket = io();
    const map = L.map("map").setView([0, 0], 10);
    const markers = {};

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
    }).addTo(map);

    // 📍 Emit current location
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition((position) => {
            const { latitude, longitude } = position.coords;
            socket.emit("send-location", { latitude, longitude });
        }, (error) => {
            console.error("Error obtaining location:", error);
        }, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }

    // ✅ Receive location and update map
    socket.on("receive-location", (data) => {
        const { id, latitude, longitude } = data;

        map.setView([latitude, longitude], 16);

        // Add or update marker
        if (markers[id]) {
            markers[id].setLatLng([latitude, longitude]);
        } else {
            markers[id] = L.marker([latitude, longitude]).addTo(map);
        }
    });

    // ✅ Handle user disconnect
    socket.on("user-disconnected", (id) => {
        if (markers[id]) {
            map.removeLayer(markers[id]);
            delete markers[id];
        }
    });
});
