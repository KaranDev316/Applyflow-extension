# ApplyFlow Extension

A lightweight Chrome extension that autofills repetitive job applications and tracks applications across hiring platforms.

---

## Overview

ApplyFlow helps job seekers reduce repetitive work during job applications.

Instead of manually retyping the same information across every application form, ApplyFlow acts as a productivity copilot that:

- Autofills repetitive fields
- Tracks submitted applications
- Stores reusable profile information
- Reduces application fatigue

Currently supported platforms:

- Greenhouse
- Lever

Future support planned for additional hiring platforms.

---

# Product Vision

ApplyFlow is **not**:

- A bot army
- A LinkedIn scraper
- An autonomous AI applying to jobs

ApplyFlow **is**:

> A browser productivity assistant for job seekers.

This distinction matters technically and legally.

The goal is to help users complete applications faster while remaining fully in control.

---

# Core Features

## 1. Profile Vault

Users can securely store reusable application information locally in the browser.

### Supported Fields

- Full Name
- Email
- Phone
- LinkedIn
- GitHub
- Portfolio
- Location
- Resume URL
- Years of Experience

### Storage

Uses:

```txt
chrome.storage.local
```

No backend required for MVP.

---

## 2. Smart Autofill

### User Flow

1. Open a supported job application
2. Open the extension popup
3. Click:

```txt
Smart Autofill
```

4. Matching fields populate automatically

---

## Supported Inputs

ApplyFlow currently detects and fills:

- Text inputs
- Email fields
- Phone fields
- Textareas
- Dropdown/select fields
- Checkboxes

---

## Supported Platforms

### Tier 1 Platforms

- Greenhouse
- Lever

These platforms were selected because they are:

- Widely used
- Structurally predictable
- Ideal for MVP reliability

---

## 3. Job Tracker

Whenever autofill runs successfully, ApplyFlow stores:

- Company name
- Role title
- Application URL
- Application date

Users can track applications directly inside the popup dashboard.

### Example

```txt
Google — Frontend Engineer
Applied: May 17
```

---

## 4. Autofill Analytics

ApplyFlow tracks:

- Total autofills
- Total fields filled
- Application activity

Stored locally using browser storage.

---

# Architecture

## Frontend

Built with:

- React
- Vite
- TailwindCSS
- Chrome Extension Manifest V3

### Responsibilities

- Popup UI
- Profile management
- Tracker dashboard
- Autofill controls

---

## Content Scripts

Injected into supported hiring platforms.

### Responsibilities

- Detect fields
- Autofill forms
- Extract metadata
- Monitor dynamic React forms

---

## Background Script

Handles:

- Extension lifecycle
- Runtime messaging
- Future authentication hooks
- Future sync support

---

## Browser Storage

Uses:

```txt
chrome.storage.local
```

Stores:

- Profile data
- Application history
- Autofill statistics
- Extension settings

---

# Folder Structure

```txt
src/
├── adapters/
├── assets/
├── background/
├── components/
├── content/
├── hooks/
├── popup/
│   ├── index.jsx
│   └── Popup.jsx
├── storage/
├── types/
├── utils/
│   ├── autofillEngine.js
│   ├── autofillStats.js
│   ├── fieldDetection.js
│   ├── messaging.js
│   ├── metadataExtractor.js
│   ├── platformDetection.js
│   ├── platformMetadata.js
│   ├── profileStorage.js
│   └── storageUtil.js
```

---

# Dynamic Form Handling

ApplyFlow is designed to work reliably with modern React-based job application forms.

### Features

- Retry detection after DOM updates
- MutationObserver support
- Duplicate autofill prevention
- Safe handling of unknown fields
- Proper input/change event triggering

---

# Safety & Compliance

ApplyFlow intentionally does NOT:

- Auto-submit applications
- Bypass CAPTCHA
- Scrape LinkedIn aggressively
- Automate external account actions

This keeps the extension:

- Safer
- More stable
- Legally lower-risk
- Easier to maintain

---

# Development

## Install Dependencies

```bash
npm install
```

---

## Run Development Server

```bash
npm run dev
```

---

## Build Extension

```bash
npm run build
```

---

## Load Extension in Chrome

1. Open:

```txt
chrome://extensions
```

2. Enable:

```txt
Developer Mode
```

3. Click:

```txt
Load unpacked
```

4. Select the project `dist/` folder

---

# MVP Roadmap

## Current MVP

- Profile Vault
- Smart Autofill
- Job Tracker
- Greenhouse Support
- Lever Support

---

## Planned Features

### AI Quick Answers

Generate reusable answers for:

- “Why do you want this role?”
- “Tell us about yourself”

---

# Future Expansion

Planned Phase 2 features:

- Cloud sync
- User accounts
- Subscriptions
- Analytics
- Resume variants
- AI-assisted applications
- Interview preparation tools

---

# Monetization Strategy

## Free Tier

- Unlimited autofill
- Limited tracker history

OR

- Limited daily autofills

---

## Pro Tier (Future)

Planned pricing:

```txt
₹299–499/month
```

### Potential Features

- AI answers
- Unlimited history
- Analytics
- Export tools
- Resume variants

---

# Target Users

Designed primarily for:

- Developers
- Tech job seekers
- Recent graduates
- Remote workers
- Laid-off professionals
- High-volume applicants

---

# Core Promise

> Fill job applications in seconds instead of minutes.

---

# Success Criteria

Initial success is NOT:

- 10,000 users instantly

Initial success IS:

- Shipping publicly
- First real users
- First organic installs
- First paid customer
- Solving a real problem consistently

---

# Tech Stack

## Extension

- React
- Vite
- Chrome Extension Manifest V3

## Styling

- TailwindCSS

## Future Backend

- Node.js
- Express
- PostgreSQL / Supabase

---

# Final Product Definition

> “A lightweight Chrome extension that autofills repetitive job applications and tracks applications across hiring platforms.”

Useful.  
Focused.  
Realistic.  
Monetizable.  
Shippable.