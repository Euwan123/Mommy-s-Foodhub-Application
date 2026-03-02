# Mommy's FoodHub POS — Deployment Guide

## Your project folder structure:
```
mommysfoodhub/        ← root folder (drag this to Netlify)
├── index.html        ← move here from HTML/index.html
├── manifest.json     ← new PWA file
├── sw.js             ← new Service Worker file
├── icon-192.png      ← new app icon
├── icon-512.png      ← new app icon
├── CSS/
│   └── style.css
└── JS/
    └── script.js
```

⚠️ IMPORTANT: index.html must be in the ROOT folder (not inside HTML/)
   because PWA service workers only work from the root.

---

## Deploy to Netlify (Free):

1. Go to https://netlify.com → Sign up free
2. Click "Add new site" → "Deploy manually"
3. Drag and drop your entire `mommysfoodhub/` folder
4. Netlify gives you a live link like: https://mommysfoodhub.netlify.app
5. Share that link with anyone!

---

## How users install it (like Codashop):

### On Android (Chrome):
1. Open the link in Chrome
2. A banner appears at the bottom: "Install FoodHub POS"
3. Tap Install → it appears on their home screen like a real app!

### On iPhone (Safari):
1. Open the link in Safari
2. Tap the Share button (box with arrow)
3. Tap "Add to Home Screen"
4. Tap Add → installed!

### On PC (Chrome/Edge):
1. Open the link
2. Look for the install icon (⊕) in the address bar
3. Click it → installs as a desktop app!

---

## Update the app anytime:
Just drag the folder to Netlify again → everyone gets the update automatically.
