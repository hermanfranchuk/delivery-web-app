# Delivery – Pizza Ordering Web Application

Delivery is a university web development project that simulates an online food ordering service. It includes customer registration, a shopping cart, order processing and a separate administration interface.

## Customer Features

Visitors start on a homepage featuring a photo of pizza and a short introduction to the restaurant. The restaurant's address is displayed in the footer throughout the website. Customers can create an account by entering their first name, last name, email, password and delivery address. After successful registration, they can log in and access the menu.

The menu currently contains 20 products across four categories: 5 pizzas, 5 pasta dishes, 3 salads and 7 beverages. Categories can be switched using a dropdown menu. Each product includes a name, photo, description and price, while beverages also display their volume. Customers can add products to their shopping cart, view the total price and adjust quantities using the `+` and `−` buttons. Reducing an item's quantity below one removes it from the cart.

Once the minimum order value is reached, customers can proceed to an order summary displaying all selected products, their descriptions, individual prices, quantities and the final total. After reviewing the order, they can confirm their purchase and receive a confirmation message. Customers can then return to the menu and place additional orders.

## Administration

The application includes an administrator interface for managing incoming orders. Administrators can view open orders, search for customers by first or last name, inspect ordered products and view delivery locations on an interactive map. Orders can be marked as fulfilled, removing them from the list of open orders. Administrator access requires an account with the `admin` role configured in the database.

## Additional Features

The minimum order value is calculated automatically based on the distance between the customer's delivery address and the restaurant in Regensburg. Address coordinates are retrieved using OpenStreetMap Nominatim, and the distance is calculated using geographic coordinates.

| Distance | Minimum Order |
|---|---|
| Up to 10 km | €10 |
| 10–20 km | €25 |
| 20–30 km | €40 |
| 30–40 km | €50 |
| 40–60 km | €60 |
| Over 60 km | €100 |

The application also provides basic input validation and feedback messages for missing registration fields, already registered email addresses, incorrect passwords and unsuccessful login attempts.

## Technologies

The frontend is built using **HTML, CSS, JavaScript, Bootstrap and Handlebars templates**. The backend uses **Node.js and Express**, with **PostgreSQL** for data storage and **express-session** for user sessions. The database contains tables for users (`users`), available products (`products`), customer orders (`orders`) and ordered items (`order_products`). OpenStreetMap services are used for address geocoding and map visualization.

## Installation

1. Install **Node.js (22 or newer)** and **PostgreSQL**.
2. Download or clone the repository and open its project directory.
3. Install the required dependencies:

   ```bash
   npm install
   ```

4. Create an empty PostgreSQL database named `delivery` and execute `database.sql` in it (for example, using DBeaver or `psql`). This starter file creates the `users`, `products`, `orders` and `order_products` tables. All tables start empty except `users`, which contains one demo administrator.
5. Copy `.env.example` to `.env` and configure your database connection:

   ```env
   PORT=3000
   DATABASE_URL=postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/delivery
   ```

6. Import the available products from `import/products.csv`:

   ```bash
   node import/import.js
   ```

7. Start the application:

   ```bash
   npm start
   ```

8. Open `http://localhost:3000` in your browser.

The database template includes a demonstration administrator account for local testing:

- **Email:** `admin@admin`
- **Password:** `admin`

## Demo

The `Demo` folder contains screenshots of the application's main pages and a short video demonstrating its core functionality, including customer registration, ordering, administration and additional features such as distance-based minimum order values and input validation.

Feel free to explore the project and enjoy!
