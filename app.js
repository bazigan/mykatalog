require('dotenv').config();
const express = require('express');
const os = require('os');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ambil info EC2 dari metadata (IMDSv2). Di luar EC2 akan fallback ke hostname.
const serverInfo = { hostname: os.hostname(), instanceId: '-', az: '-' };
async function loadEc2Metadata() {
  try {
    const base = 'http://169.254.169.254/latest';
    const opt = { signal: AbortSignal.timeout(1000) };
    const tokenRes = await fetch(`${base}/api/token`, {
      ...opt, method: 'PUT', headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
    });
    if (!tokenRes.ok) return;
    const token = await tokenRes.text();
    const get = async (p) => {
      const r = await fetch(`${base}/meta-data/${p}`, {
        ...opt, headers: { 'X-aws-ec2-metadata-token': token },
      });
      if (!r.ok) throw new Error('metadata tidak tersedia');
      return r.text();
    };
    const id = await get('instance-id');
    if (!id.startsWith('i-')) return;
    serverInfo.instanceId = id;
    serverInfo.az = await get('placement/availability-zone');
  } catch {
    // bukan di EC2, abaikan
  }
}

app.use((req, res, next) => {
  res.locals.server = serverInfo;
  res.locals.dbHost = db.config.host;
  next();
});

// Daftar produk + pencarian
app.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const [rows] = q
      ? await db.getPool().query(
          'SELECT * FROM products WHERE name LIKE ? OR category LIKE ? ORDER BY id DESC',
          [`%${q}%`, `%${q}%`])
      : await db.getPool().query('SELECT * FROM products ORDER BY id DESC');
    res.render('index', { products: rows, q });
  } catch (err) { next(err); }
});

app.get('/products/new', (req, res) => {
  res.render('form', { product: {}, action: '/products', title: 'Tambah Produk' });
});

app.post('/products', async (req, res, next) => {
  try {
    const { name, category, price, stock, description } = req.body;
    await db.getPool().query(
      'INSERT INTO products (name, category, price, stock, description) VALUES (?, ?, ?, ?, ?)',
      [name, category || 'Umum', Number(price) || 0, Number(stock) || 0, description]);
    res.redirect('/');
  } catch (err) { next(err); }
});

app.get('/products/:id/edit', async (req, res, next) => {
  try {
    const [[product]] = await db.getPool().query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).send('Produk tidak ditemukan');
    res.render('form', { product, action: `/products/${product.id}`, title: 'Edit Produk' });
  } catch (err) { next(err); }
});

app.post('/products/:id', async (req, res, next) => {
  try {
    const { name, category, price, stock, description } = req.body;
    await db.getPool().query(
      'UPDATE products SET name=?, category=?, price=?, stock=?, description=? WHERE id=?',
      [name, category || 'Umum', Number(price) || 0, Number(stock) || 0, description, req.params.id]);
    res.redirect('/');
  } catch (err) { next(err); }
});

app.post('/products/:id/delete', async (req, res, next) => {
  try {
    await db.getPool().query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.redirect('/');
  } catch (err) { next(err); }
});

// Health check (untuk ALB / monitoring)
app.get('/health', async (req, res) => {
  try {
    await db.getPool().query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ...serverInfo });
  } catch (err) {
    res.status(500).json({ status: 'error', db: err.message, ...serverInfo });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: err.message });
});

(async () => {
  await loadEc2Metadata();
  try {
    await db.init();
    console.log(`Terhubung ke database ${db.DB_NAME} di ${db.config.host}`);
  } catch (err) {
    console.error('Gagal konek ke database:', err.message);
    console.error('Cek DB_HOST, user/password, dan Security Group RDS (port 3306).');
    process.exit(1);
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Katalog berjalan di http://0.0.0.0:${PORT}`));
})();
