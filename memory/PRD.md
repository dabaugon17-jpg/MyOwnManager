# PRD - Inventario, Ventas y Contabilidad

## Original problem statement
Build a dark-themed web app (mobile-first, also desktop) for inventory, sales, and accounting management. Bottom nav with 4 tabs (Dashboard, Inventario, Ventas, Incidencias). Login screen, Group/business sharing via codes.

## User personas
- **Admin** (creator of the business): creates a group, invites partner via union code
- **Partner** (joins via code): manages same inventory, sales and incidents

## Core requirements
- Dark theme, mobile-first with bottom nav
- Dashboard: 3 KPI cards (Facturación, Beneficio Neto, Inversión) + bar chart with Day/Week/Month/Year filters
- Inventory: product grid with photo, name, purchase price, VENDIDO button + FAB to add
- Sales: list view with sale price, profit margin (green), Incidencia button (red)
- Incidents: list of products with issues/returns
- Login: email/password + Google (Emergent OAuth)
- Groups: create/join via 6-char code

## Implemented (Feb 2026)
- [x] FastAPI backend with auth (JWT + Google OAuth)
- [x] MongoDB collections: users, user_sessions, grupos, productos, incidencias, files
- [x] Object storage integration for product photos
- [x] Group create + join with union code
- [x] Product CRUD + sell + incidencia endpoints
- [x] Dashboard analytics with day/week/month/year filters
- [x] React frontend with bottom nav, dark Swiss-style design
- [x] Login + Onboarding + Dashboard + Inventory + Sales + Incidents pages

## Backlog (P1)
- [ ] Edit/Delete product
- [ ] Export sales to CSV / PDF report
- [ ] Push notifications for new sales
- [ ] Members management (see who's in the group, remove)

## P2
- [ ] Multi-currency support
- [ ] Categories/tags for products
- [ ] Search & filter inventory
