import fs from "node:fs";
import { parse } from "csv-parse";
import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
console.log(process.env.DATABASE_URL ? "ENV OK" : "ENV MISSING");

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const csvPath = path.join(__dirname, "products.csv");

const processFile = async () => {
    const parser = fs.createReadStream(csvPath).pipe(
        parse({
            columns: true,
            trim: true,
            skip_empty_lines: true,
        })
    );

    for await (const row of parser) {
        await pool.query(
            `INSERT INTO products (category, name, description, image_uri, price_cent)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                row.category,
                row.name,
                row.description,
                row.imageUri,
                Number(row.priceCent)
            ]
        );
    }

    await pool.end();
};

(async () => {
    await processFile();
    console.log("IMPORT DONE");
})();
