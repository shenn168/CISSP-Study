# Installation and Usage Guide

## Installation

### Prerequisites

- Microsoft Edge
- Access to load unpacked extensions
- The extension source files in a local folder

### Required Files

Place these files in one folder:

- manifest.json
- background.js
- popup.html
- popup.js
- app.html
- app.css
- app.js

Example folder name:

- cissp-readiness-coaching-tool

## Load the Extension in Microsoft Edge

1. Open Microsoft Edge.
2. Go to:
   - `edge://extensions`
3. Turn on:
   - Developer mode
4. Click:
   - Load unpacked
5. Select the extension folder.
6. Confirm the extension appears in the extensions list.
7. Optionally pin the extension to the toolbar.

## First Launch

1. Click the extension icon.
2. Click:
   - Open Tool
3. On first launch, the app will prompt you to set a 4-digit PIN.
4. Enter and confirm the PIN.
5. The app will unlock and open.

## Using the Tool

# Dashboard

The Dashboard provides a coach overview across the current cohort filter.

You can view:
- total members
- readiness color counts
- members at risk
- upcoming exam dates
- stale members with no recent update
- top weak domains
- recent journal activity
- readiness score bar chart by member

## Global Cohort Filter

At the top of the app, use the cohort dropdown to:
- show all cohorts
- filter the dashboard and related views to a single cohort

# Members

Go to the Members section to manage study group participants.

## Add a Member

1. Click:
   - Add Member
2. Enter member information:
   - Full Name
   - Preferred Name
   - Cohort
   - Target Exam Date
   - Current Role/Title
   - Years in IT
   - Years in Security
   - ISC2 Experience Status
   - Managerial vs Technical Self-Rating
   - Initial Confidence Rating
   - Background Summary
   - Notes
3. Click:
   - Save Member

## Edit a Member

1. In the Members table, click:
   - Edit
2. Update the fields.
3. Click:
   - Save Member

## View a Member

1. In the Members table, click:
   - View
2. Review:
   - profile details
   - readiness breakdown
   - domain averages
   - journal timeline

## Delete a Member

1. In the Members table, click:
   - Delete
2. Confirm deletion.

Important:
- deleting a member also deletes all related journal entries

# Journal

Use the Journal section to capture coaching snapshots.

## Add a Journal Entry

1. Go to:
   - Journal
2. Click:
   - New Journal Entry
3. Complete the fields:
   - Member
   - Entry Date
   - Study Hours
   - Attendance Status
   - Practice Questions Completed
   - First-Attempt Mixed Score
   - Full Practice Exam Score
   - Confidence Rating
   - Managerial Reasoning Score
   - Exam Execution Score
   - Materials Covered
   - Domain 1 through Domain 8 scores
   - Coach Observations
   - Blockers
   - Next Actions
   - Tags
4. Click:
   - Save Journal Entry

## Journal Tips

- use one entry per meaningful coaching check-in
- use consistent scoring methods across members
- enter first-attempt mixed scores when possible
- record domain scores if available
- use observations and next actions to preserve coaching context

# Reports

Use the Reports section for export, import, and print operations.

## Export All Data to JSON

Use this when you want a full backup of:
- members
- journal entries
- settings

## Export Members to CSV

Use this when you want:
- a member list only
- spreadsheet-friendly export

## Export Safe JSON

Use this when you want a safer file that removes:
- detailed member notes
- coach observations
- blockers
- next actions
- PIN value

## Import Members CSV

Expected behavior:
- one row per member
- member data only
- journal entries are not included

## Import Full JSON

Use this to restore a full prior export.

Important:
- importing JSON may merge with current local data
- review carefully before repeated imports

## Print Member Summary

1. Select a member
2. Click:
   - Print Member Summary

# Settings

Use Settings to manage scoring and app preferences.

## Readiness Weights

You can change the category weights for:
- Experience and Background
- Study Discipline and Consistency
- Coverage of Study Materials
- Practice Question Performance
- Domain Balance
- Managerial Reasoning
- Exam Execution

After changes:
- click Save Weights

## Readiness Bands

The app uses these default bands:
- Green: 85-100
- Yellow: 70-84
- Orange: 55-69
- Red: below 55

## Theme

Choose:
- Dark
- Light

## Change PIN

Use:
- Change PIN

Enter a new 4-digit PIN when prompted.

## Load Sample Data

Use this to populate example members and journal entries for testing.

# Locking the App

At any time, click:
- Lock App

You will need the 4-digit PIN to unlock it again.

# Readiness Scoring Summary

Readiness is calculated from a weighted composite model using:
- profile background
- recent study discipline
- study material coverage
- practice performance
- domain balance
- managerial reasoning
- exam execution

The current chart on the Dashboard shows:
- current readiness score by member
- labeled with the latest journal snapshot date if available

# Troubleshooting

## Extension does not load
- confirm all required files are present
- confirm `manifest.json` exists
- confirm Developer mode is enabled in Edge

## Buttons do not work
- reload the extension from `edge://extensions`
- reopen the app tab

## Dashboard chart looks empty
- confirm there are members
- confirm the current cohort filter is correct
- confirm journal entries exist for the members if you expect stronger scores

## Forgot PIN
Current version does not include a PIN recovery workflow.
If needed, clear extension storage manually by removing and reloading the extension, or clear extension site data through browser developer tools.

Warning:
- this may remove locally stored data unless you exported it first

# Recommended Coach Workflow

1. Add members
2. Assign cohorts
3. Set target exam dates
4. Capture an initial member profile
5. Add regular journal entries
6. Review Dashboard weekly
7. Watch readiness score, weak domains, and stale updates
8. Export JSON backups periodically

# Data Handling Recommendation

Because the tool is local-only:
- export full JSON backups regularly
- keep backup files in a secure internal location
- use safe JSON when sharing limited data

# Support Notes

This version is intended as a local internal coaching tool and may be extended in future versions with:
- historical trends
- richer alerts
- editing journal entries
- more advanced reporting