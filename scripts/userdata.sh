#!/bin/bash
# EC2 User Data - Amazon Linux 2023
# Ganti nilai DB_* di bawah sebelum dipakai.
set -e
dnf install -y nodejs git

cd /opt
git clone https://github.com/bazigan/lab-ec2-rds-katalog.git
cd lab-ec2-rds-katalog
npm install --omit=dev

cat > .env <<ENV
PORT=80
DB_HOST=katalog-db.xxxxxxxx.ap-southeast-3.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=GantiPasswordIni
DB_NAME=katalog
ENV

cat > /etc/systemd/system/katalog.service <<SVC
[Unit]
Description=Katalog Produk (Lab EC2 RDS)
After=network-online.target

[Service]
WorkingDirectory=/opt/lab-ec2-rds-katalog
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
systemctl enable --now katalog
