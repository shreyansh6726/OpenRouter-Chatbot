# OpenRouter Chatbot

A full-stack chatbot with a React frontend and an Express backend powered by
the [OpenRouter](https://openrouter.ai/) API.

## Features

- Chat with OpenRouter models through a simple web interface.
- Attach images for vision-capable models.
- Render assistant responses as Markdown with GitHub-flavored Markdown support.
- Automatically search DuckDuckGo, Wikipedia, and Reddit for queries that ask
  for current information.
- Display the sources returned by the web search.
- Health-check endpoint for deployment platforms.

## Project structure

```text
.
├── backend/    # Express API and OpenRouter integration
├── frontend/   # Create React App user interface
└── render.yaml # Render configuration for the backend
```

## Requirements

- Node.js 18 or newer
- An [OpenRouter API key](https://openrouter.ai/keys)

## Local development

### 1. Configure the backend

```powershell
cd backend
Copy-Item .env.example .env
```

Set `OPEN_ROUTER_API` in `backend/.env`:

```env
OPEN_ROUTER_API=your_openrouter_api_key
CORS_ORIGINS=http://localhost:3000
```

`CORS_ORIGINS` accepts a comma-separated list of allowed frontend origins.

Install dependencies and start the API:

```powershell
npm install
npm run dev
```

The backend runs at `http://localhost:5000` by default. It can also be started
without file watching:

```powershell
npm start
```

### 2. Start the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm start
```

The frontend opens at `http://localhost:3000`. By default, it sends API
requests to `http://localhost:5000`. To use another backend URL, create
`frontend/.env` with:

```env
REACT_APP_API_URL=https://your-backend.example.com
```

The frontend can also be built for production:

```powershell
npm run build
```

## API

### `GET /api/health`

Returns the backend health status:

```json
{
  "ok": true
}
```

### `POST /api/chat`

Request body:

```json
{
  "message": "Explain recursion",
  "messages": [
    {
      "role": "user",
      "content": "Explain recursion"
    }
  ],
  "model": "openai/gpt-4o-mini",
  "image": null
}
```

`messages` is optional when sending a single message. `image` may contain a
data URL beginning with `data:image/` when an image is attached.

## Deployment

The included [`render.yaml`](./render.yaml) configures the backend as a Render
web service. Set these environment variables in Render:

- `OPEN_ROUTER_API`: your OpenRouter API key
- `CORS_ORIGINS`: the deployed frontend origin, such as
  `https://your-frontend.example.com`

Build the frontend with `npm run build` and deploy the resulting `frontend/build`
directory using your preferred static hosting provider. Set
`REACT_APP_API_URL` to the public backend URL before building.

## Security notes

- Never commit `.env` files or API keys.
- Keep the OpenRouter API key in the backend only; browser code should call the
  backend rather than OpenRouter directly.
- Restrict `CORS_ORIGINS` to the frontend origins you control in production.
