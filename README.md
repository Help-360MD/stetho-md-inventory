# Stetho MD - Live Multi-User Clinic Inventory & Dispensing System

A modern, responsive, real-time clinical inventory management and dispensing system designed for **Stetho MD** clinics in **Tampa** and **Zephyrhills**. Powered by **Firebase Firestore** for sub-second multi-device live sync and hosted for free on **GitHub Pages**.

---

## 🚀 Features

* **⚡ Sub-Second Live Sync:** Any action (unsealing a vial, deducting 35 units, receiving an order) syncs instantly across all logged-in devices across all clinic rooms without refreshing.
* **📍 Dual Location Isolation (Tampa & Zephyrhills):** Strictly independent inventory per physical clinic, with role-based location locks for regular staff.
* **🧪 Standard Unit Conversions ($1\text{ mL} = 100\text{ units}$):**
  - **Tirzepatide:** 1 mL (100u), 2 mL (200u), 3 mL (300u), 4 mL (400u), 5+ mL (custom).
  - **Semaglutide:** 5 mL (500u).
* **💧 Micro-Unit Opened Vial Tracking:** Live unit math ($200 - 35 = 165\text{ units remaining}$) with visual percentage progress bars and auto-retirement when fully depleted.
* **🔍 Master Inventory Overview:** Aggregated overview for Admins with instant hover tooltip popovers showing Tampa vs. Zephyrhills stock breakdowns.
* **🚚 Cross-Clinic Stock Transfers:** Seamlessly transfer sealed vials between clinics with atomic conflict-free transactions.
* **📦 Pharmacy Orders & Partial Deliveries:** Receive orders, record staff names, and auto-credit sealed inventory.
* **📡 Barcode Hardware Ready:** Global Bluetooth / USB HID scanner listener for instant catalog item lookup and physical count verification.

---

## 🛠️ Free Setup & Deployment Guide (Under 5 Minutes)

### Step 1: Create your Free Firebase Project (2 minutes)
1. Visit [Firebase Console](https://console.firebase.google.com/) and click **Add project** (e.g. `stetho-md-clinic`).
2. Go to **Build > Firestore Database** in the left menu and click **Create database**. Select your preferred region (e.g. `us-central1` or `us-east1`) and choose **Start in test mode**.
3. In Project Overview, click the **Web icon (`</>`)** to register a web app.
4. Copy the `firebaseConfig` object shown on the screen.

### Step 2: Configure Firebase in your Project
Open `firebase-config.js` and paste your copied credentials:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "stetho-md-clinic.firebaseapp.com",
  projectId: "stetho-md-clinic",
  storageBucket: "stetho-md-clinic.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```
*(Alternatively, you can click **Enter Firebase Config** in the top banner of the web app to paste your keys directly in your browser!)*

### Step 3: Publish to GitHub Pages (1 minute)
1. Create a new repository on GitHub (e.g. `stetho-md-inventory`).
2. Push this project folder to your repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Stetho MD real-time system"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/stetho-md-inventory.git
   git push -u origin main
   ```
3. In your GitHub repository settings, go to **Pages** > under **Build and deployment > Branch**, select `main` and `/ (root)` > click **Save**.
4. Your clinic system is now live at `https://YOUR_USERNAME.github.io/stetho-md-inventory/`!

### Step 4: Seed Clinic Catalog & Demo Users (1 Click)
1. Open your live GitHub Pages link in any browser.
2. Click the **Seed Catalog** button in the top navigation bar.
3. This will instantly create the standard catalog for Tampa and Zephyrhills (Tirzepatide 1–5+ mL, Semaglutide 5 mL, Vaccines, Supplies) and active opened vials with micro-unit tracking!

---

## 👥 Default Demo Accounts

| Full Name | Role | Username | Password | Location |
| :--- | :--- | :--- | :--- | :--- |
| **Dr. Smith** | Administrator | `admin` | `admin123` | All Clinics |
| **David Clark** | Inventory Manager | `manager` | `manager123` | All Clinics |
| **Sarah Jenkins, RN** | Nurse | `tampa_nurse` | `nurse123` | Tampa Clinic |
| **Michael Torres, MA** | Medical Assistant | `zephyr_ma` | `ma123` | Zephyrhills Clinic |
