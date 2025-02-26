# 🚀 My Project

A powerful full-stack application built with **Node.js, Express, Prisma, and PostgreSQL**.

---

## 📌 Setup Guide

### **1️⃣ Clone the Repository**
```sh
git clone https://github.com/Amansai12/CollabDocs-backend.git
cd your-repo
```

### 2️⃣ Install Dependencies
```sh
npm install
```
### 3️⃣ Configure Environment Variables
```sh
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your_super_secret_key
DATABASE_URL=postgresql://user:password@localhost:5432/mydatabase
```

### 4️⃣ Run Database Migrations
---
To apply the Prisma schema to your database, run:
```sh
npx prisma migrate dev --name "initial"
```

### 5️⃣ Start the Server
---
Start the server
```sh
npx nodemon app.js
```
