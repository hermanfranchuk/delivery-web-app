const express = require("express");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const session = require("express-session");

dotenv.config();

const PORT = process.env.PORT;
const app = express();

/* database connection */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const locationCalculator = require("./utils/locationCalculator");

app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || "dev_secret",
    resave: false,
    saveUninitialized: false
}));

app.use(express.static("public"));

app.set("views", "views");
app.set("view engine", "hbs");


// transform address lat\lon
async function geocodeToLatLon(street, postcode, city) {
    const addressText = `${street}, ${postcode} ${city}, Germany`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addressText)}`;

    const r = await fetch(url, {
        headers: {
            "User-Agent": "DeliveryWebTechStudentProject/1.0"
        }
    });

    if (!r.ok) return null;

    const data = await r.json();
    if (!data || data.length === 0) return null;

    return {
        lat: Number(data[0].lat),
        lon: Number(data[0].lon)
    };
}


// transform distance to minimum order price
function distanceKmToMinOrderCents(distanceKm) {
    if (distanceKm <= 10) return 1000;
    if (distanceKm <= 20) return 2500;
    if (distanceKm <= 30) return 4000;
    if (distanceKm <= 40) return 5000;
    if (distanceKm <= 60) return 6000;
    return 10000;
}


// calculate minimum order price for user
function getMinOrderCentForUser(lat, lon) {
    if (typeof lat !== "number" || typeof lon !== "number" || Number.isNaN(lat) || Number.isNaN(lon)) {
        return 1500;
    }

    const distanceKm = locationCalculator.greatCircleDistanceKilometer(
        { lat, lon },
        { lat: 49.01942, lon: 12.09558 }
    );

    return distanceKmToMinOrderCents(distanceKm);
}


// index page (index.hbs)
app.get("/", (req, res) => {
    const user = req.session.user || null;
    const cart = req.session.cart || [];

    let cartTotalCent = 0;
    let cartTotalItems = 0;

    const cartItems = cart.map(item => {
        const subtotalCent = item.price * item.amount;
        cartTotalCent += subtotalCent;
        cartTotalItems += item.amount;

        return {
            id: item.id,
            name: item.name,
            amount: item.amount,
            priceText: (item.price / 100).toFixed(2).replace(".", ",") + " €",
            subtotalText: (subtotalCent / 100).toFixed(2).replace(".", ",") + " €"
        };
    });

    const hideCart = !user || cartTotalItems === 0;
    const minOrderCent = user?.minOrderCent ?? 1000;

    res.render("index", {
        loggedIn: !!user,
        user,
        isAdmin: req.session.user?.isAdmin,

        cartItems,
        cartTotalItems,
        cartTotalEuro: (cartTotalCent / 100).toFixed(2).replace(".", ",") + " €",
        minOrder: (minOrderCent / 100).toFixed(2).replace(".", ",") + " €",
        minOrderOk: cartTotalCent >= minOrderCent,
        hideCart
    });
});


// menu page (menu.hbs)
app.get("/produkte", async (req, res, next) => {
    try {
        if (!req.session.user) {
            return res.redirect("/?msg=needlogin");
        }

        const user = req.session.user;
        const category = req.query.category;

        const categoriesResult = await pool.query(
            `SELECT DISTINCT category FROM products ORDER BY category`
        );

        const allCategories = categoriesResult.rows.map(row => {
            let title = row.category;
            if (row.category === "pizza") title = "Pizza";
            if (row.category === "pasta") title = "Nudeln";
            if (row.category === "salat") title = "Salat";
            if (row.category === "beverage") title = "Getränke";

            return {
                key: row.category,
                title,
                selected: row.category === category
            };
        });

        const productsResult = await pool.query(
            `SELECT id, name, description, image_uri, price_cent
             FROM products
             WHERE category = $1
             ORDER BY name`,
            [category]
        );

        const products = productsResult.rows.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            imageUri: p.image_uri,
            price: (p.price_cent / 100).toFixed(2) + " €"
        }));

        const cart = req.session.cart || [];
        let cartTotalCent = 0;
        let cartTotalItems = 0;

        const cartItems = cart.map(item => {
            const subtotalCent = item.price * item.amount;
            cartTotalCent += subtotalCent;
            cartTotalItems += item.amount;

            return {
                id: item.id,
                name: item.name,
                amount: item.amount,
                priceText: (item.price / 100).toFixed(2).replace(".", ",") + " €",
                subtotalText: (subtotalCent / 100).toFixed(2).replace(".", ",") + " €"
            };
        });

        const minOrderCent = user?.minOrderCent ?? 1000;

        res.render("menu", {
            products,
            allCategories,
            user,
            isAdmin: user.isAdmin,
            cartItems,
            cartTotalItems,
            cartTotalEuro: (cartTotalCent / 100).toFixed(2).replace(".", ",") + " €",
            minOrder: (minOrderCent / 100).toFixed(2).replace(".", ",") + " €",
            minOrderOk: cartTotalCent >= minOrderCent
        });
    } catch (err) {
        next(err);
    }
});


// add product to cart (menu.hbs)
app.post("/cart/add", async (req, res, next) => {
    try {
        const productId = Number(req.body.productId);
        if (!productId) return res.redirect(req.get("Referer"));

        if (!req.session.cart) req.session.cart = [];

        const result = await pool.query(
            "SELECT id, name, price_cent FROM products WHERE id = $1",
            [productId]
        );

        if (result.rows.length === 0) return res.redirect(req.get("Referer"));

        const product = result.rows[0];
        const existing = req.session.cart.find(i => i.id === product.id);

        if (!existing) {
            req.session.cart.push({
                id: product.id,
                name: product.name,
                price: product.price_cent,
                amount: 1
            });
        } else {
            existing.amount += 1;
        }

        res.redirect(req.get("Referer"));
    } catch (err) {
        next(err);
    }
});


// remove product from cart (menu.hbs / index.hbs)
app.post("/cart/remove", (req, res) => {
    const productId = Number(req.body.productId);
    if (!req.session.cart) return res.redirect(req.get("Referer"));

    const item = req.session.cart.find(i => i.id === productId);
    if (!item) return res.redirect(req.get("Referer"));

    item.amount -= 1;
    if (item.amount <= 0) {
        req.session.cart = req.session.cart.filter(i => i.id !== productId);
    }

    res.redirect(req.get("Referer"));
});


// registration page (registrieren.html)
app.get("/registrieren", (req, res) => {
    res.sendFile(__dirname + "/views/registrieren.html");
});


// registration submit (registrieren.html)
app.post("/registrieren", async (req, res) => {
    const { vorname, nachname, email, password, street, postcode, city } = req.body;

    if (!vorname || !nachname || !email || !password || !street || !postcode || !city) {
        return res.redirect("/registrieren?msg=missing");
    }

    const existing = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [email]
    );

    if (existing.rows.length > 0) {
        return res.redirect("/registrieren?msg=exists");
    }

    let lat = null;
    let lon = null;
    let minOrderCent = 1000;

    try {
        const coords = await geocodeToLatLon(street, postcode, city);
        if (coords) {
            lat = coords.lat;
            lon = coords.lon;
            minOrderCent = getMinOrderCentForUser(lat, lon);
        }
    } catch {}

    await pool.query(
        `INSERT INTO users
         (firstname, lastname, email, password, role, street, postcode, city, lat, lon, min_order_cent)
         VALUES ($1,$2,$3,$4,'user',$5,$6,$7,$8,$9,$10)`,
        [vorname, nachname, email, password, street, postcode, city, lat, lon, minOrderCent]
    );

    res.redirect("/einloggen?msg=registered");
});


// login page (einloggen.html)
app.get("/einloggen", (req, res) => {
    res.sendFile(__dirname + "/views/einloggen.html");
});


// login submit (einloggen.html)
app.post("/einloggen", async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.redirect("/einloggen?msg=missing");

        const result = await pool.query(
            "SELECT id, firstname, password, role, min_order_cent FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) return res.redirect("/einloggen?msg=notfound");
        const user = result.rows[0];
        if (user.password !== password) return res.redirect("/einloggen?msg=wrongpass");

        req.session.user = {
            id: user.id,
            firstname: user.firstname,
            role: user.role,
            isAdmin: user.role === "admin",
            minOrderCent: user.min_order_cent
        };

        res.redirect("/");
    } catch (err) {
        next(err);
    }
});


// logout
app.get("/ausloggen", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});


// order overview page (bestelluebersicht.hbs)
app.get("/bestelluebersicht", async (req, res, next) => {
    try {
        const user = req.session.user;
        const cart = req.session.cart || [];
        if (!user || cart.length === 0) return res.redirect("/produkte?category=pizza");

        const ids = cart.map(i => i.id);
        const prodRes = await pool.query(
            "SELECT id, description, image_uri FROM products WHERE id = ANY($1)",
            [ids]
        );

        const prodMap = new Map();
        for (const p of prodRes.rows) {
            prodMap.set(p.id, { description: p.description, imageUri: p.image_uri });
        }

        let totalCent = 0;
        const cartItems = cart.map(item => {
            const subtotalCent = item.price * item.amount;
            totalCent += subtotalCent;

            const extra = prodMap.get(item.id) || {};
            return {
                id: item.id,
                name: item.name,
                amount: item.amount,
                description: extra.description || "",
                imageUri: extra.imageUri || "",
                priceText: (item.price / 100).toFixed(2).replace(".", ",") + " €",
                subtotalText: (subtotalCent / 100).toFixed(2).replace(".", ",") + " €"
            };
        });

        const minOrderCent = user.minOrderCent ?? 1000;

        res.render("bestelluebersicht", {
            loggedIn: true,
            user,
            isAdmin: user.isAdmin,
            cartItems,
            cartTotalEuro: (totalCent / 100).toFixed(2).replace(".", ",") + " €",
            minOrder: (minOrderCent / 100).toFixed(2).replace(".", ",") + " €",
            minOrderOk: totalCent >= minOrderCent
        });
    } catch (err) {
        next(err);
    }
});


// order confirmation page (bestellen.hbs)
app.get("/bestellen", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    res.render("bestellen", {
        loggedIn: true,
        user: req.session.user,
        isAdmin: req.session.user?.isAdmin
    });
});


// submit order (bestellen.hbs)
app.post("/bestellen", async (req, res) => {
    const user = req.session.user;
    const cart = req.session.cart;

    if (!user || !cart || cart.length === 0) {
        return res.redirect("/produkte?category=pizza");
    }

    const orderResult = await pool.query(
        "INSERT INTO orders (customer_id, time_created, status) VALUES ($1, NOW(), $2) RETURNING id",
        [user.id, "open"]
    );

    const orderId = orderResult.rows[0].id;

    for (const item of cart) {
        await pool.query(
            "INSERT INTO order_products (order_id, product_id, quantity) VALUES ($1,$2,$3)",
            [orderId, item.id, item.amount]
        );
    }

    req.session.cart = [];

    res.render("bestellen", {
        loggedIn: true,
        user,
        isAdmin: req.session.user?.isAdmin
    });
});


// admin orders page (admin_bestellungen.hbs)
app.get("/admin/bestellungen", async (req, res, next) => {
    try {
        if (!req.session.user || req.session.user.role !== "admin") {
            return res.redirect("/");
        }

        const search = req.query.search?.trim() || null;
        let ordersResult;

        if (search) {
            ordersResult = await pool.query(`
                SELECT o.id AS order_id, u.firstname, u.lastname, u.street, u.postcode, u.city
                FROM orders o
                JOIN users u ON o.customer_id = u.id
                WHERE o.status = 'open'
                  AND (LOWER(u.firstname) LIKE LOWER($1) OR LOWER(u.lastname) LIKE LOWER($1))
                ORDER BY o.time_created DESC
            `, [`%${search}%`]);
        } else {
            ordersResult = await pool.query(`
                SELECT o.id AS order_id, u.firstname, u.lastname, u.street, u.postcode, u.city
                FROM orders o
                JOIN users u ON o.customer_id = u.id
                WHERE o.status = 'open'
                ORDER BY o.time_created DESC
            `);
        }

        const orders = [];

        for (const row of ordersResult.rows) {
            const itemsResult = await pool.query(`
                SELECT p.name, op.quantity
                FROM order_products op
                JOIN products p ON op.product_id = p.id
                WHERE op.order_id = $1
            `, [row.order_id]);

            orders.push({
                id: row.order_id,
                customerName: `${row.firstname} ${row.lastname}`,
                address: `${row.street}, ${row.postcode} ${row.city}`,
                items: itemsResult.rows
            });
        }

        res.render("admin_bestellungen", {
            loggedIn: true,
            user: req.session.user,
            isAdmin: true,
            orders,
            search
        });
    } catch (err) {
        next(err);
    }
});


// mark order as fulfilled (admin_bestellungen.hbs)
app.post("/admin/bestellung/erledigt", async (req, res, next) => {
    try {
        if (!req.session.user || req.session.user.role !== "admin") {
            return res.redirect("/");
        }

        const orderId = Number(req.body.orderId);

        await pool.query(
            "UPDATE orders SET status = 'fulfilled' WHERE id = $1",
            [orderId]
        );

        res.redirect(`/admin/bestellungen?msg=fulfilled&orderId=${orderId}`);
    } catch (err) {
        next(err);
    }
});


// maps
const geocodeCache = new Map();
const GEOCODE_TTL_MS = 24 * 60 * 60 * 1000;

let lastNominatimCall = 0;
async function throttleNominatim() {
    const now = Date.now();
    const diff = now - lastNominatimCall;
    if (diff < 1100) {
        await new Promise(r => setTimeout(r, 1100 - diff));
    }
    lastNominatimCall = Date.now();
}

app.get("/api/geocode", async (req, res) => {
    try {
        if (!req.session.user || req.session.user.role !== "admin") {
            return res.status(403).json({ error: "forbidden" });
        }

        const address = String(req.query.address || "").trim();
        if (!address) return res.status(400).json({ error: "missing_address" });

        const cached = geocodeCache.get(address);
        if (cached && (Date.now() - cached.ts) < GEOCODE_TTL_MS) {
            return res.json({ lat: cached.lat, lon: cached.lon, cached: true });
        }

        await throttleNominatim();

        const url = "https://nominatim.openstreetmap.org/search?" +
            new URLSearchParams({ format: "jsonv2", limit: "1", q: address });

        const resp = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "Delivery-WebTech-StudentProject/1.0"
            }
        });

        if (!resp.ok) return res.status(502).json({ error: "nominatim_failed" });

        const data = await resp.json();
        if (!Array.isArray(data) || data.length === 0) {
            return res.json({ lat: null, lon: null });
        }

        const lat = Number(data[0].lat);
        const lon = Number(data[0].lon);

        geocodeCache.set(address, { lat, lon, ts: Date.now() });
        res.json({ lat, lon, cached: false });
    } catch {
        res.status(500).json({ error: "server_error" });
    }
});


// start server
app.listen(PORT, () => {
    console.log(`Delivery running and listening on port ${PORT}`);
});
