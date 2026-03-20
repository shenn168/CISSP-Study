# 🛡️ CISSP StudyDeck — Browser Extension

A standalone, fully offline Microsoft Edge (Chromium-based) browser extension that enables CISSP study group members to load, merge, study, and share flash card decks across all 8 CISSP domains.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Offline](https://img.shields.io/badge/Mode-Offline-green)
![CISSP](https://img.shields.io/badge/CISSP-8%20Domains-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [CISSP Domains Covered](#cissp-domains-covered)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [File Format Specifications](#file-format-specifications)
  - [JSON Format](#json-format)
  - [CSV Format](#csv-format)
  - [Plain-Text Format](#plain-text-format)
- [Study Modes](#study-modes)
- [Spaced Repetition (SM-2)](#spaced-repetition-sm-2)
- [Duplicate Detection and Merge Engine](#duplicate-detection-and-merge-engine)
- [Progress Dashboard](#progress-dashboard)
- [Export and Sharing](#export-and-sharing)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Data Schema](#data-schema)
- [Contributing](#contributing)
- [Icon Attribution](#icon-attribution)
- [License](#license)

---

## Features

- **New Tab Override** — Opens as your default new tab page for frictionless study access
- **Popup Quick Access** — Click the extension icon for a quick stats summary and navigation
- **Multi-Format Import** — Import flash cards from JSON, CSV, or plain-text files
- **Duplicate Detection and Merge** — Intelligent deduplication with attribution tracking across contributors
- **3D Flip Cards** — Beautiful CSS 3D card flip animation for classic study mode
- **Scenario-Based Cards** — Long-form "Think Like a Manager" scenarios with detailed rationale
- **Spaced Repetition (SM-2)** — Industry-standard algorithm for optimized review scheduling
- **Progress Dashboard** — Domain mastery charts, streak tracking, weak area identification
- **Cross-Reference Links** — Clickable related card tags that jump to linked cards
- **Export Engine** — Export decks in JSON, CSV, or plain-text with optional progress data
- **Deck Manager** — View, manage, and delete imported decks with contributor tracking
- **Dark and Light Theme** — Toggle between cybersecurity-themed dark mode and clean light mode
- **Fully Offline** — Zero external dependencies, no network requests, all data stored locally in IndexedDB
- **Keyboard Shortcuts** — Full keyboard navigation for efficient study sessions
- **Responsive Design** — Works on various screen sizes

---

## Screenshots

> Open a new tab after installation to see the StudyDeck interface. The extension features a cybersecurity-themed dark mode with electric blue accents and a clean light mode alternative.

---

## CISSP Domains Covered

| Domain | Name |
|:-------|:-----|
| 1 | Security and Risk Management |
| 2 | Asset Security |
| 3 | Security Architecture and Engineering |
| 4 | Communication and Network Security |
| 5 | Identity and Access Management (IAM) |
| 6 | Security Assessment and Testing |
| 7 | Security Operations |
| 8 | Software Development Security |

---

## Installation

### Sideloading (Recommended for Study Groups)

1. Download or clone this repository to a local folder
2. Open Microsoft Edge and navigate to `edge://extensions/`
3. Enable **Developer mode** using the toggle in the bottom-left corner
4. Click **Load unpacked**
5. Select the `cissp-studydeck` project folder
6. The extension icon will appear in your toolbar and new tabs will load StudyDeck

### Updating

1. Make changes to the extension files
2. Go to `edge://extensions/`
3. Click the **Reload** button (circular arrow) on the CISSP StudyDeck card

---

## Getting Started

### Step 1 — Import the Starter Deck

1. Open a new tab (StudyDeck loads automatically)
2. Click **Import** in the navigation bar
3. Click the drop zone or drag and drop the file `data/cissp-starter-deck.json`
4. Review the import preview showing 40 cards across all 8 domains
5. Click **Confirm Import**

### Step 2 — Start Studying

1. Click **Study** in the navigation bar
2. Optionally filter by domain, card type, or review status
3. Click **Start Session**
4. Click the card or press **Space** to flip
5. Rate yourself: **Know It** (1), **Unsure** (2), or **Don't Know** (3)
6. Review your session summary when complete

### Step 3 — Track Your Progress

1. Click **Dashboard** to view your progress
2. Monitor domain mastery, study streaks, and weak areas
3. Cards marked "Don't Know" will surface more frequently via spaced repetition

---

## File Format Specifications

### JSON Format

The simplest format for creating and sharing decks. Each card is an object in a JSON array.
[
  {
    "term": "Business Continuity Plan (BCP)",
    "domain": "Security and Risk Management",
    "type": "definition",
    "answer": "A plan to ensure critical business functions continue during and after a disaster.",
    "examTip": "Choose BCP over technical fixes for organizational resilience.",
    "relatedCards": ["Disaster Recovery Plan (DRP)", "RTO", "RPO", "BIA"],
    "tags": ["governance", "planning", "resilience"],
    "contributor": "Alice"
  }
]

### CSV Format
term,domain,type,answer,examTip,relatedCards,contributor
"Business Continuity Plan","Security and Risk Management","definition","A plan to ensure...","Choose BCP over...","DRP;RTO;RPO;BIA","Alice"

### Plain-Text Format
Human-readable format using labeled fields. Cards are separated by a line containing only ---.
TERM: Business Continuity Plan
DOMAIN: Security and Risk Management
TYPE: definition
ANSWER: A plan to ensure critical business functions continue during and after a disaster.
TIP: Choose BCP over technical fixes for organizational resilience.
RELATED: Disaster Recovery Plan; RTO; RPO; BIA
TAGS: governance; planning; resilience
CONTRIBUTOR: Alice
---
TERM: Risk Assessment
DOMAIN: Security and Risk Management
TYPE: definition
ANSWER: The process of identifying, analyzing, and evaluating risks.
TIP: Know the difference between qualitative and quantitative methods.
CONTRIBUTOR: Bob
---

## Keyboard Shortcuts
Key	Action
Space 	Flip card 
1 	Know It (green) 
2 	Unsure (yellow) 
3 	Don't Know (red) 
→ (Right Arrow) 	Flip card, or if flipped, assess as Unsure and advance 


## Project Structure
cissp-studydeck/
├── manifest.json              Extension manifest (Manifest V3)
├── newtab.html                Main application (New Tab override)
├── popup.html                 Extension popup (quick access)
├── css/
│   └── styles.css             Master stylesheet (dark/light themes)
├── js/
│   ├── app.js                 Main application controller
│   ├── popup.js               Popup controller
│   ├── db.js                  IndexedDB storage engine
│   ├── parsers.js             File format parsers (JSON, CSV, TXT)
│   ├── importer.js            Import engine with dedup and merge
│   ├── studymode.js           Classic flip card study mode
│   ├── scenario.js            Scenario-based card mode
│   ├── sm2.js                 SM-2 spaced repetition algorithm
│   ├── dashboard.js           Progress dashboard
│   ├── exporter.js            Export engine
│   ├── deckmanager.js         Deck management UI
│   ├── settings.js            Settings panel
│   └── utils.js               Utility functions and constants
├── assets/
│   ├── icon16.png             Toolbar icon (16x16)
│   ├── icon48.png             Extension page icon (48x48)
│   └── icon128.png            Store/large icon (128x128)
└── data/
    └── cissp-starter-deck.json  40-card starter deck (all 8 domains)

## Data Schema
### Card Object
id               UUID v4 — unique identifier
term             String — the term, concept, or question
domain           String — one of the 8 CISSP domains
type             String — "definition" or "scenario"

primaryAnswer
  text           String — main definition or answer
  contributor    String — author name
  sourceDeck     String — deck file name
  importedAt     ISO 8601 timestamp

alsoSee          Array of alternate/supplementary answers
  text           String — alternate answer text
  contributor    String — author name
  sourceDeck     String — source deck name
  importedAt     ISO 8601 timestamp

examTip          String — exam-specific guidance
scenarioText     String — long-form scenario (scenario-type only)
relatedCards     Array of term strings — cross-referenced cards
tags             Array of strings — custom tags for filtering
flagged          Boolean — true if marked "Needs Review"

sm2
  interval       Integer — days until next review
  easeFactor     Float — SM-2 ease factor (default 2.5)
  repetitions    Integer — successful consecutive reviews
  nextReviewDate Date string (YYYY-MM-DD)

selfAssessment   String — "know", "unsure", or "dontknow"
reviewHistory    Array of review event objects
  timestamp      ISO 8601 timestamp
  quality        String — assessment result
  date           Date string (YYYY-MM-DD)

## Contributing
### Adding Cards
1. Create a new JSON, CSV, or plain-text file following the format specifications above
2. Ensure each card has at minimum a term field
3. Use the canonical CISSP domain names listed in the domains table
4. Set type to "scenario" for scenario cards and include a scenarioText field
5. Add examTip to provide exam-specific guidance
6. Use relatedCards to create cross-references between related concepts
7. Add tags for custom filtering beyond domains
8. Include your name as contributor for attribution tracking

### Study Group Workflow
1. Each member creates their own deck files covering their assigned domains
2. Members share deck files via email, Slack, or shared drive
3. Each member imports all shared decks — the merge engine handles duplicates
4. Different perspectives on the same term are preserved as "Also See" entries
5. Conflicting information is automatically flagged for group review
6. Full attribution tracking shows who contributed each answer

### Code Contributions
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test by sideloading in Edge (edge://extensions/ → Load unpacked)
5. Submit a pull request