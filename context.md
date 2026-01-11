# Project Context — SaveFrom-Style Downloader Website

## Project Goal
Build a full-featured, production-ready video/audio downloader website similar to savefrom.net.

The website allows users to paste a media URL, analyze available formats, and download or convert media files.

---

## Functional Requirements

### Core Features
- Accept a media URL from the user
- Analyze the URL and extract:
  - Title
  - Thumbnail
  - Duration
  - Available video/audio formats
- Allow downloading:
  - Video (MP4, WEBM)
  - Audio (MP3, AAC)
- Allow conversion via FFmpeg
- Stream downloads directly to the browser
- Responsive, mobile-first UI

---

## Technical Stack

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Axios

### Backend
- Node.js
- Express
- TypeScript
- yt-dlp (media extraction)
- FFmpeg (conversion)
- Rate limiting + validation

### Infrastructure
- Docker (backend)
- Environment variables via `.env`
- Local-first, deployable later

---

## Backend Responsibilities
- URL validation
- Metadata extraction
- Format listing
- Media streaming
- Media conversion
- Abuse prevention

---

## Frontend Responsibilities
- URL input
- Loading and error states
- Media preview
- Format selection
- Download actions
- Legal pages (Terms, Privacy, Disclaimer)

---

## API Contract

### POST /api/analyze
Input:
```json
{ "url": "string" }
```

Output:
```json
{
  "title": "string",
  "thumbnail": "string",
  "duration": "string",
  "formats": [
    {
      "format_id": "string",
      "ext": "string",
      "resolution": "string",
      "filesize": "string",
      "type": "audio|video"
    }
  ]
}
```

---

### GET /api/download
Query params:
- url
- format_id

Streams the file to the browser using proper headers.

---

### POST /api/convert
Input:
- url
- target_format

Streams converted output.

---

## Non-Goals
- No user accounts initially
- No ads initially
- No browser extensions initially

---

## Legal Notice
This project is for educational purposes. Users are responsible for content rights and compliance with platform terms of service.

---

## Development Rules
- Keep code modular
- No hardcoded paths
- Handle errors explicitly
- Comment non-obvious logic
- Never expose raw system commands to the client
- Prevent open proxy behavior
