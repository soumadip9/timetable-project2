# Admin Account Seeding

This document explains how to create the default admin account for the Timetable Management System.

## Default Admin Credentials

- **Email:** `admin@school.com`
- **Password:** Set via `ADMIN_DEFAULT_PASSWORD` environment variable, or defaults to `admin123`

⚠️ **Important:** Change the default password immediately after first login!

## Method 1: Using the API Endpoint

You can create the admin account by calling the API endpoint:

### Check if admin exists:
```bash
curl http://localhost:3000/api/seed/admin
```

### Create admin account:
```bash
curl -X POST http://localhost:3000/api/seed/admin \
  -H "Content-Type: application/json" \
  -d '{"password": "your-secure-password"}'
```

Or using fetch in browser console:
```javascript
fetch('/api/seed/admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'your-secure-password' })
})
.then(r => r.json())
.then(console.log);
```

## Method 2: Using the Standalone Script

1. **Install tsx** (if not already installed):
   ```bash
   npm install -D tsx
   ```

2. **Set environment variables** in `.env.local`:
   ```env
   MONGODB_URI=your-mongodb-connection-string
   ADMIN_DEFAULT_PASSWORD=your-secure-password
   ```

3. **Run the seed script**:
   ```bash
   npm run seed:admin
   ```

   Or directly with tsx:
   ```bash
   npx tsx scripts/seed-admin.ts
   ```

## Security Notes

- The API endpoint `/api/seed/admin` should ideally be:
  - Protected by environment variable check (e.g., only in development)
  - Removed or disabled after initial setup
  - Protected by IP whitelist in production

- The default password should be changed immediately after first login.

- Consider using a strong password generator for the initial admin password.

## Role-Based Access

The admin account has the `admin` role, which provides:
- Full access to all CRUD operations
- Ability to manage all entities (classes, teachers, subjects, rooms, timetables)
- Access to admin-only features (if implemented)

Teachers have the `teacher` role with limited access (as configured in your application).

