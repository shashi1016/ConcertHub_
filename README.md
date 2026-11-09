# ConcertHub

Concert ticket booking website with a full admin portal. HTML, CSS and JavaScript on the front, Node.js + Express + MongoDB on the back.

## Run it
1. Copy `.env.example` to a new file named `.env` in the project root (same folder as `package.json`).
2. Put your MongoDB Atlas connection string, a private session secret, and your own admin email/password in `.env`.
3. Run:
```powershell
npm.cmd install
npm.cmd start
```
Wait for `Connected to MongoDB.`, then open:
- Website: http://localhost:8080
- Admin portal: http://localhost:8080/admin/

Open it through Node (port 8080), not Live Server. MongoDB Atlas: add your IP under Network Access, otherwise the connection fails.

## Admin login
The admin account is created from your `.env` values (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) on first start. Set your own strong password before starting the server. Any registered user can also be promoted from Admin > Users.

## Features
**Website:** browse and search concerts, filter by city and genre, sort by date or price, concert details with live availability, sign up / log in, favourites, VIP / Gold / Silver numbered seat selection, payment method and fee summary (demo checkout, no real payment), booking reference, my tickets, cancellation up to 48 hours before the show, profile and password change.

**Admin portal:** dashboard (revenue, tickets, bookings, 14-day chart, best sellers, almost sold out), add / edit / cancel / delete concerts with genre, image and featured flag, all bookings with search, filter, cancel and CSV export, user management (promote, disable).

**Safety:** bcrypt passwords, sessions in MongoDB, rate-limited login, helmet + CSP, input validation, atomic seat reservations so the same seat can't be sold twice, CSV formula-injection protection.

## Structure
```
backend/   server.js, models.js, utils.js, seed.js, routes/ (auth, public, admin)
frontend/  index.html + js/app.js (website), admin/ (portal), css/style.css
```

## Notes
- Never commit `.env` (it is in `.gitignore`) and never share your database password publicly.
- Payments are a demo: nothing is charged.


## Numbered seating (VIP / Gold / Silver)

- Admins configure the seat count and ticket price for VIP, Gold and Silver when creating a concert. Total capacity is calculated from the three sections.
- Each section is numbered automatically in rows of eight (for example, `VIP-A1`, `GOLD-A1`, `SILVER-A1`).
- Customers choose one section and select up to 10 exact seats before checkout.
- MongoDB stores reserved seat IDs on the concert and on each booking. Seat reservations use an atomic update so two customers cannot reserve the same seat at the same time.
- Cancelling a confirmed booking releases its selected seats back into the available seat map.
- Existing concerts without a seat plan receive a default VIP/Gold/Silver plan during startup migration.

Checkout remains a college-project demo: it records a selected payment method but does not charge real money.
