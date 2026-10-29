# Lab EC2 + RDS — Katalog Produk (Node.js)

Aplikasi katalog produk sederhana (CRUD) untuk latihan deploy **Amazon EC2** yang terhubung ke **Amazon RDS for MySQL**.

- Node.js + Express + EJS + mysql2
- Database, tabel, dan 6 data contoh dibuat otomatis saat aplikasi pertama kali jalan
- Header menampilkan **hostname, Instance ID, dan AZ** EC2 (via IMDSv2) — berguna untuk lab ALB / multi-AZ
- Endpoint `/health` untuk health check ALB

## Arsitektur Lab

```
Internet ──▶ EC2 (Amazon Linux 2023, Node.js, port 80) ──▶ RDS MySQL (port 3306, private)
```

## 1. Buat Security Group

| SG | Inbound | Source |
|----|---------|--------|
| `sg-web` (EC2) | HTTP 80 | 0.0.0.0/0 |
| `sg-web` (EC2) | SSH 22 | IP Anda |
| `sg-db` (RDS) | MySQL/Aurora 3306 | `sg-web` |

## 2. Buat RDS

- Engine: **MySQL 8.x**, template **Free tier**
- DB instance identifier: `katalog-db`
- Master username: `admin`, password: sesuai keinginan
- Instance class: `db.t3.micro` / `db.t4g.micro`
- Public access: **No**, Security group: `sg-db`
- Tidak perlu membuat database awal — aplikasi akan membuat database `katalog` sendiri

Catat **Endpoint** RDS setelah status `Available`.

## 3. Buat EC2

- AMI: **Amazon Linux 2023**, tipe `t3.micro`
- Subnet: public, Auto-assign public IP: **Enable**
- Security group: `sg-web`

### Opsi A — Otomatis dengan User Data

Salin isi [`scripts/userdata.sh`](scripts/userdata.sh) ke kolom **Advanced details → User data**, ganti `DB_HOST` dan `DB_PASSWORD`, lalu launch. Tunggu 2–3 menit, buka `http://<public-ip-ec2>`.

### Opsi B — Manual via SSH

```bash
sudo dnf install -y nodejs git
git clone https://github.com/bazigan/mykatalog.git
cd mykatalog
npm install
cp .env.example .env
nano .env          # isi DB_HOST, DB_USER, DB_PASSWORD
npm start          # jalan di port 3000
```

Buka `http://<public-ip-ec2>:3000` (tambahkan inbound port 3000 di `sg-web`), atau set `PORT=80` di `.env` dan jalankan `sudo npm start`.

## 4. Verifikasi

```bash
curl http://localhost:3000/health
# {"status":"ok","db":"connected","hostname":"ip-10-0-1-23...","instanceId":"i-0abc...","az":"ap-southeast-3a"}
```

Cek data langsung dari EC2:

```bash
sudo dnf install -y mariadb105
mysql -h <endpoint-rds> -u admin -p -e "SELECT * FROM katalog.products;"
```

## Troubleshooting

| Gejala | Penyebab umum |
|--------|---------------|
| `ETIMEDOUT` / `connect ETIMEDOUT` | Inbound 3306 di `sg-db` belum mengizinkan `sg-web`, atau EC2 & RDS beda VPC |
| `ER_ACCESS_DENIED_ERROR` | Username / password salah |
| `ENOTFOUND` | `DB_HOST` salah ketik (pakai endpoint, bukan nama instance) |
| Halaman tidak bisa dibuka | Inbound port 80/3000 di `sg-web` belum dibuka |
| Instance ID tampil `-` | Normal kalau jalan di luar EC2 |

## Pengembangan Lanjutan (opsional)

- Pasang **ALB + Auto Scaling Group** dengan 2 EC2 di AZ berbeda — refresh halaman untuk melihat Instance ID berganti
- Aktifkan **RDS Multi-AZ** dan uji failover (`Reboot with failover`)
- Simpan kredensial DB di **AWS Secrets Manager** / **SSM Parameter Store**

## Variabel Environment

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `PORT` | `3000` | Port aplikasi |
| `DB_HOST` | `localhost` | Endpoint RDS |
| `DB_PORT` | `3306` | Port MySQL |
| `DB_USER` | `admin` | Username |
| `DB_PASSWORD` | – | Password |
| `DB_NAME` | `katalog` | Nama database (dibuat otomatis) |


## Background App

```bash
sudo mv ~/mykatalog /opt/
sudo tee /etc/systemd/system/katalog.service > /dev/null <<'EOF'
[Unit]
Description=Katalog Produk (Lab EC2 RDS)
After=network-online.target

[Service]
WorkingDirectory=/opt/mykatalog
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now katalog
sudo systemctl status katalog
```