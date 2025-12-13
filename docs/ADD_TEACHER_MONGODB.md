# How to Add a Teacher Directly in MongoDB Atlas

## Overview
To add a teacher, you need to create **TWO documents**:
1. A **User** document (for authentication)
2. A **Teacher** document (that references the User)

## Step 1: Create User Document

Go to your MongoDB Atlas dashboard → Browse Collections → Select the `users` collection → Click "INSERT DOCUMENT"

### User Document Structure:
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "$2a$10$YourHashedPasswordHere",
  "role": "TEACHER",
  "createdAt": ISODate("2025-01-15T10:00:00.000Z"),
  "updatedAt": ISODate("2025-01-15T10:00:00.000Z")
}
```

### Important Notes:
- **email**: Must be unique, lowercase, and trimmed
- **password**: Must be hashed using bcrypt (see password hashing below)
- **role**: Must be exactly `"TEACHER"` (uppercase)
- **timestamps**: MongoDB will auto-generate these, but you can set them manually

### Password Hashing Options:

**Option A: Use a temporary password and let the user change it later**
- Set password to: `$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy` (this is "password123" hashed)
- User can change it after first login

**Option B: Hash your own password**
- Use an online bcrypt generator: https://bcrypt-generator.com/
- Or use Node.js:
  ```javascript
  const bcrypt = require('bcryptjs');
  const hashed = await bcrypt.hash('yourpassword', 10);
  console.log(hashed);
  ```

**Option C: Use MongoDB's built-in function (if available)**
- Some MongoDB clients allow you to run JavaScript to hash passwords

## Step 2: Get the User ID

After creating the User document, **copy the `_id` field** (it will look like: `ObjectId("507f1f77bcf86cd799439011")` or just the string `"507f1f77bcf86cd799439011"`)

## Step 3: Create Teacher Document

Go to the `teachers` collection → Click "INSERT DOCUMENT"

### Teacher Document Structure:
```json
{
  "userId": ObjectId("507f1f77bcf86cd799439011"),
  "subject": "Mathematics",
  "phone": "+1234567890",
  "createdAt": ISODate("2025-01-15T10:00:00.000Z"),
  "updatedAt": ISODate("2025-01-15T10:00:00.000Z")
}
```

### Important Notes:
- **userId**: Must be a valid ObjectId that exists in the `users` collection
- **subject**: Required field (e.g., "Mathematics", "Physics", "Chemistry Lab")
- **phone**: Optional field (can be omitted)
- Replace `ObjectId("507f1f77bcf86cd799439011")` with the actual `_id` from Step 2

## Step 4: Verify in Frontend

1. **Refresh the page** in your browser (the API fetches directly from the database)
2. Go to the Teachers page (`/admin/teachers` or `/teachers`)
3. The new teacher should appear immediately

## Quick Example (Complete)

**User Document:**
```json
{
  "name": "Jane Smith",
  "email": "jane.smith@school.com",
  "password": "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
  "role": "TEACHER"
}
```
*(Note: The password above is "password123" - user should change it)*

**Teacher Document:**
```json
{
  "userId": ObjectId("PASTE_USER_ID_HERE"),
  "subject": "Computer Science",
  "phone": "+1-555-0123"
}
```

## Troubleshooting

### Teacher not showing in frontend?
1. Check that the `userId` in Teacher document matches a valid User `_id`
2. Verify the User document has `role: "TEACHER"`
3. Check browser console for errors
4. Verify the API endpoint `/api/teachers` is working

### Login not working?
1. Ensure password is properly hashed (bcrypt format)
2. Check email is lowercase and matches exactly
3. Verify User document exists and has correct role

### Common Mistakes:
- ❌ Using plain text password (must be hashed)
- ❌ Wrong `userId` format (must be ObjectId)
- ❌ Email not lowercase
- ❌ Role not exactly "TEACHER" (case-sensitive)
- ❌ Missing required fields

## Alternative: Use the API

Instead of adding directly in MongoDB, you can also use the API endpoint:

```bash
POST /api/teachers
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "plaintextpassword",
  "subject": "Mathematics",
  "phone": "+1234567890"
}
```

This automatically:
- Creates the User document
- Hashes the password
- Creates the Teacher document
- Links them together

But requires admin authentication.


