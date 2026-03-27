# SalesFlow iOS App — Project Overview

## What Is SalesFlow?
An AI-powered platform that finds local businesses without websites, generates demo websites for them, and deploys independent contractors to walk in and sell them. The iOS app is the primary tool for these contractors.

## Business Model
- AI scrapes Google/social media to find businesses without websites
- AI generates a personalised demo website for each business
- Contractors walk into the business and pitch the website
- Customer pays £350 setup + £25/month
- Contractor earns £50 commission per sale
- Contractors are INDEPENDENT CONTRACTORS, not employees (legally important — no targets, no minimum hours)

## The Ecosystem
```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  iOS App     │     │   Web App    │     │  AI Pipeline     │
│  (SwiftUI)   │     │  (Next.js)   │     │  (Node.js)       │
│  This project│     │  Port 4300   │     │  On Raspberry Pi  │
└──────┬───────┘     └──────┬───────┘     └────────┬─────────┘
       │                    │                       │
       │ REST API           │ REST API              │ Direct DB
       └────────┬───────────┘                       │
                │                                   │
         ┌──────▼───────┐                           │
         │  Mobile API  │◄──────────────────────────┘
         │  (Express)   │
         │  Port 4350   │
         └──────┬───────┘
                │
         ┌──────▼───────┐
         │   SQLite DB  │
         │  (shared)    │
         └──────────────┘
```

## Target Users
- Age 18-25
- Commission-based, gig-economy workers
- iPhone users
- Walking into businesses 3-5 days a week
- Need the app to be FAST, information-dense, and motivating

## What The App Replaces
Without the app, a salesperson would need:
- A printed list of businesses
- Google searches to research each one
- A separate browser to show demo sites
- A notebook for notes and follow-ups
- A spreadsheet to track earnings
- A GPS app for directions

The iOS app combines ALL of this into one tool they open every morning.
