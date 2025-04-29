# Automatic Tab Killer

A Firefox extension that automatically closes inactive tabs based on a configurable time limit.

## Features

- Automatically closes tabs that have been inactive for a specified duration
- Configurable time limit (in minutes)
- Whitelist support using pattern matching
- Simple and intuitive options page

## Installation

1. Open Firefox and go to `about:debugging`
2. Click "This Firefox" in the left sidebar
3. Click "Load Temporary Add-on"
4. Navigate to the extension directory and select any file (e.g., manifest.json)

## Configuration

1. Click the extension icon in the toolbar
2. Set the desired time limit in minutes
3. Add whitelist patterns (one per line)
   - Use `*` as a wildcard
   - Examples:
     - `*.google.com` (matches all Google domains)
     - `*mail.com` (matches any URL ending with mail.com)
     - `docs.*.com` (matches docs.example.com, etc.)
4. Click "Save Settings"

## How it works

- The extension tracks when each tab was last active
- Every minute, it checks for tabs that have exceeded the inactive time limit
- Tabs matching whitelist patterns are ignored
- A tab becomes "active" when you switch to it or when its URL changes
