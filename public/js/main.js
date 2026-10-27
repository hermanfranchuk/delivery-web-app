<!-- errors -->
const toast = document.getElementById("toast_msg");

const showToast = (text, type) => {
    toast.textContent = text;
    toast.classList.remove("error", "success");
    toast.classList.add(type, "show");
    setTimeout(() => toast.classList.remove("show"), 1200);
};

if (toast) {
    <!-- mouse follow -->
    document.addEventListener("mousemove", (e) => {
        toast.style.left = (e.clientX + 12) + "px";
        toast.style.top = (e.clientY + 12) + "px";
    });

    const params = new URLSearchParams(window.location.search);
    const msg = params.get("msg");
    const orderId = params.get("orderId");

    <!-- types of errors -->
    if (msg === "missing") showToast("Please fill in all fields", "error");
    if (msg === "exists") showToast("Email already registered, please log in", "error");
    if (msg === "registered") showToast("Registration successful, now you can log in", "success");
    if (msg === "notfound") showToast("Email not found", "error");
    if (msg === "wrongpass") showToast("Incorrect password", "error");
    if (msg === "fulfilled") {
        if (orderId) {
            showToast(`Order #${orderId} successfully fulfilled`, "success");
        } else {
            showToast("Order successfully fulfilled", "success");
        }
    }

    if (msg) {
        history.replaceState(null, "", window.location.pathname);
    }
}

<!-- menu error -->
const menuLink = document.getElementById("menu_nav");
if (menuLink) {
    menuLink.addEventListener("click", (e) => {
        if (menuLink.dataset.locked === "true") {
            e.preventDefault();
            showToast("Please log in to see the menu", "error");
        }
    });
}

<!-- maps -->
const mapBoxes = document.querySelectorAll(".admin_order_map");

async function loadAdminMaps() {
    if (!mapBoxes.length) return;

    for (const box of mapBoxes) {
        const address = box.dataset.address;
        if (!address) continue;

        try {
            const resp = await fetch("/api/geocode?" + new URLSearchParams({ address }));
            const data = await resp.json();

            if (!data || data.lat == null || data.lon == null) {
                box.innerHTML = `<div class="admin_map_placeholder">No location</div>`;
                continue;
            }

            const lat = Number(data.lat);
            const lon = Number(data.lon);

            const d = 0.003;
            const left = lon - d;
            const right = lon + d;
            const top = lat + d;
            const bottom = lat - d;

            const iframeSrc =
                "https://www.openstreetmap.org/export/embed.html?" +
                new URLSearchParams({
                    bbox: `${left},${bottom},${right},${top}`,
                    marker: `${lat},${lon}`
                });

            box.innerHTML = `
        <iframe class="admin_map_iframe"
                src="${iframeSrc}"
                loading="lazy"></iframe>
      `;
        } catch (e) {
            box.innerHTML = `<div class="admin_map_placeholder">Map error</div>`;
        }
    }
}

document.addEventListener("DOMContentLoaded", loadAdminMaps);

