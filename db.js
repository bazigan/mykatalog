const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || '',
};
const DB_NAME = process.env.DB_NAME || 'katalog';

let pool;

// Buat database + tabel + data contoh kalau belum ada
async function init() {
  const conn = await mysql.createConnection(config);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await conn.end();

  pool = mysql.createPool({ ...config, database: DB_NAME, connectionLimit: 5 });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'Umum',
      price DECIMAL(12,0) NOT NULL DEFAULT 0,
      stock INT NOT NULL DEFAULT 0,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM products');
  if (total === 0) {
    await pool.query(
      `INSERT INTO products (name, category, price, stock, description) VALUES ?`,
      [[
        ['Laptop ThinkPad E14', 'Laptop', 12500000, 5, 'Intel Core i5, RAM 16GB, SSD 512GB'],
        ['Mouse Wireless Logitech M331', 'Aksesoris', 225000, 40, 'Silent click, baterai tahan lama'],
        ['Keyboard Mechanical Rexus', 'Aksesoris', 450000, 25, 'Switch blue, RGB'],
        ['Monitor LG 24 inch', 'Monitor', 1850000, 10, 'IPS Full HD 75Hz'],
        ['Router MikroTik hAP ax2', 'Jaringan', 1350000, 8, 'WiFi 6 dual band'],
        ['SSD Samsung 990 Pro 1TB', 'Storage', 1950000, 15, 'NVMe PCIe 4.0'],
      ]]
    );
    console.log('Data contoh berhasil dimasukkan.');
  }
}

function getPool() {
  return pool;
}

module.exports = { init, getPool, config, DB_NAME };
