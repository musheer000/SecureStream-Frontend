# 🛡️ SecureStream - Enterprise SIEM & Threat Intelligence Platform

![SecureStream Banner](https://via.placeholder.com/1200x400/0f172a/38bdf8?text=SecureStream+SIEM)

> **SecureStream** is a Full-Stack Security Information and Event Management (SIEM) platform designed to monitor, score, and mitigate cyber threats in real-time. 

Built with a high-performance **React/TypeScript** frontend and a **Java Spring Boot** backend, this platform replaces standard HTTP polling with a sub-second **WebSocket (STOMP)** data pipeline.

---

## ✨ Core Features

*   🔴 **Real-Time Threat Dashboard:** Live event streaming via WebSockets. Watch attacks drop onto the dashboard and Geo-Map the exact second they hit the firewall.
*   🧠 **ARIA Engine (AI Risk Intelligence):** An automated scoring algorithm that evaluates attacker IPs, historical velocity, and coordinated attack patterns to assign a Threat Score (0-100) and automatically blacklist critical IPs.
*   🛡️ **Role-Based Access Control (RBAC):** Strict JWT-based authentication supporting `ADMIN`, `ANALYST`, and `VIEWER` roles.
*   📋 **War Room & Incident Response:** A Kanban-style ticketing system where security analysts can isolate assets, execute playbooks, and track mitigation progress.
*   📊 **Executive PDF Reporting:** Automated daily generation of colorful, branded PDF compliance reports using OpenPDF.
*   🌗 **Premium UI/UX:** A custom CSS-variable theme engine enabling flawless Light and Dark mode transitions.

---

## 🛠️ Technology Stack

### Frontend (Client)
*   **React 18** (Functional Components, Hooks, Context API)
*   **TypeScript** (Strict Type Safety)
*   **Vite** (Next-generation frontend tooling)
*   **Lucide React** (Modern iconography)

### Backend (Server)
*   **Java 17 & Spring Boot 3** (RESTful API & Core Logic)
*   **Spring Security & JWT** (Stateless Authentication)
*   **STOMP & WebSockets** (Bi-directional real-time communication)
*   **Hibernate / Spring Data JPA** (ORM Mapping)
*   **H2 / PostgreSQL** (Relational Database)
*   **OpenPDF** (Programmatic Document Generation)

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/SecureStream.git
```

### 2. Start the Backend (Spring Boot)
Ensure Java 17+ is installed.
```bash
cd backend
./mvnw spring-boot:run
```
*The backend runs on `http://localhost:8080`*

### 3. Start the Frontend (React/Vite)
Ensure Node.js is installed.
```bash
cd frontend
npm install
npm run dev
```
*The frontend runs on `http://localhost:5173`*

---

## 🔐 Default Test Accounts

| Role | Username | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin** | `Musheer` | `Sm50738789@` | Full system access, user deletion, API key management |
| **Analyst** | `analyst_sec` | `Analyst123!` | Can resolve threats and manage the War Room |
| **Viewer** | `viewer_audit` | `Viewer123!` | Read-only access to dashboards and compliance reports |

---

## 🌐 Architecture & Data Flow

1.  **Ingestion:** External systems (firewalls, AWS CloudTrail) send JSON payloads to the REST API using an `X-API-Key`.
2.  **Processing:** The ARIA Engine intercepts the event, cross-references the attacker's IP against the database, and assigns a risk score.
3.  **Broadcast:** The backend pushes the processed threat through the STOMP WebSocket broker.
4.  **UI Update:** The React frontend receives the WebSocket message and instantly updates the Dashboard without a page refresh.

---

*Developed as a comprehensive showcase of Full-Stack Architecture, Real-Time Systems, and Enterprise Security patterns.*
