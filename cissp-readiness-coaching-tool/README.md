# CISSP Readiness and Coaching Tool

A standalone Microsoft Edge extension for CISSP coaches to track study group members, journal coaching updates, and score readiness over time.

## Overview

This tool is designed for a coach-led CISSP study group workflow. It helps a coach:

- intake member profile data
- organize members by cohort
- track journal updates over time
- calculate CISSP readiness scores
- identify weak domains and coaching risks
- export and import local data
- review dashboard summaries and readiness charts

Version:
- 1.0.x local-only extension
- Manifest V3
- Microsoft Edge compatible

## Key Features

- Standalone Edge extension app
- Local-only data storage
- 4-digit PIN lock for app access
- Multi-cohort support
- Member intake and profile management
- Journal-based coaching updates
- Weighted CISSP readiness scoring model
- Dashboard with readiness summaries
- Readiness score bar chart by member
- CSV export/import for members
- JSON full export/import
- Safe JSON export without sensitive notes
- Printable member summary page
- Light and dark theme support

## Intended User

- CISSP coach
- study group facilitator
- internal training lead
- certification readiness coordinator

This tool is not intended for direct member self-service in the current version.

## Readiness Model

The default readiness model includes:

- Experience and Background
- Study Discipline and Consistency
- Coverage of Study Materials
- Practice Question Performance
- Domain Balance
- Managerial Reasoning
- Exam Execution

Default weights:

- Experience and Background: 15
- Study Discipline and Consistency: 20
- Coverage of Study Materials: 15
- Practice Question Performance: 25
- Domain Balance: 10
- Managerial Reasoning: 10
- Exam Execution: 5

Default readiness bands:

- Green: 85-100
- Yellow: 70-84
- Orange: 55-69
- Red: below 55

## Supported Workflows

### Members
- add a member
- edit a member
- delete a member
- view member detail
- assign a cohort
- set target exam date

### Journal
- add coaching journal entries
- track study hours
- track attendance
- record practice question counts
- record mixed and full practice scores
- track all 8 CISSP domains
- add coach observations, blockers, next actions, and tags

### Reports and Data
- export all data to JSON
- export members to CSV
- export safe JSON without notes
- import members from CSV
- import full data from JSON
- print member summary pages

## Data Storage

The extension stores data locally in the browser using IndexedDB.

Stored entities:
- members
- journal entries
- app settings

No cloud backend is used in the current version.

## Security

This version includes:
- 4-digit PIN lock
- local-only data storage
- no external API calls
- no network dependency for operation

Important:
- the PIN controls app access
- it is not a replacement for enterprise-grade encryption
- exported files should be handled carefully

## Technology

- Manifest V3
- HTML
- CSS
- JavaScript
- IndexedDB

## File Structure

Expected extension files:

- manifest.json
- background.js
- popup.html
- popup.js
- app.html
- app.css
- app.js

## Compatibility

Test target:
- Microsoft Edge with Developer Mode enabled for unpacked extensions

## Limitations

Current version limitations include:

- no cloud sync
- no user accounts
- no coach-to-coach shared workspace
- no direct journal entry editing UI
- no direct journal entry deletion UI
- no encrypted export package
- no predictive pass/fail analytics model
- no historical time-series readiness chart per member

## Recommended Next Enhancements

Potential future improvements:

- edit and delete journal entries
- richer readiness explanation panel
- alerts for weak domains and inactivity
- cohort analytics dashboard
- historical readiness trend by member
- recommendation engine for next coaching actions
- stronger validation and warnings
- encrypted backup/export options

## Disclaimer

This tool provides a structured coaching score and readiness framework. It does not guarantee CISSP exam outcomes and should be used as a coaching aid rather than a pass/fail predictor.

## License

See `LICENSE.md`.