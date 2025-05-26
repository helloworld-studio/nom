# Nom - Solana Token Monitor

A real-time Solana token monitoring application that tracks new token launches from Raydium LetsBonk Launchpad, providing analytics and soon will support AI-powered insights.

## Features
§
- **Real-time Token Monitoring**: Tracks newly launched tokens on Solana
- **Multi-Platform Support**: Monitors Raydium LetsBonk Launchpad
- **Token Analytics**: Provides holder distribution, bonding curve progress, and other metrics
- **AI Analysis**: Offers AI-powered insights on token launches via LLM API
- **React Frontend**: Modern UI for viewing and interacting with token data
- **Swap Integration**: Direct integration with Raydium for token swaps

## Prerequisites

- Node.js (v16+)
- npm or yarn
- Solana RPC endpoint (QuickNode or similar)
- LLM API key (for AI analysis coming soon)

## Environment Variables

Create a `.env` file in the root directory with the following:

```
RPC_URL=your_solana_rpc_endpoint
LLM_API_KEY=your_llm_api_key
CORS_ORIGIN=your_frontend_url_in_production
PORT=5000 (optional)
```

## Installation

1. Clone the repository:
```
git clone https://github.com/helloworld-studio/nom.git
cd nom
```

2. Install backend dependencies:
```
npm install
```

3. Install frontend dependencies:
```
cd client
npm install
cd ..
```

## Running the Application

### Development Mode

1. Start the backend server:
```
npm run dev
```

2. In a separate terminal, start the frontend development server:
```
cd client
npm start
```

3. Access the application at `http://localhost:3000`

### Production Mode

1. Build the frontend:
```
npm run build
```

2. Start the production server:
```
npm start
```

3. Access the application at `http://localhost:5000`

## API Endpoints

- `GET /api/latest-transaction`: Get the latest token transaction
- `GET /api/latest-token`: Get the latest token data
- `GET /api/latest-transaction/analytics`: Get analytics for the latest token
- `GET /api/token/analytics/:mint`: Get analytics for a specific token mint
- `POST /api/analyze`: Get AI analysis of a token (rate limited)

## Deployment on Render.com

### 1. Create a Web Service

1. Set up a production environment for your preferred hosting service
2. Configure your service:
   - **Name**: nom (or your preferred name)
   - **Environment**: Node
   - **Build Command**: `npm install && cd client && npm install && npm run build && cd ..`
   - **Start Command**: `npm start`

### 2. Configure Environment Variables

Click "Advanced" and add these environment variables:

- `NODE_ENV`: `production`
- `RPC_URL`: Your Solana RPC endpoint (mark as secret)
- `CORS_ORIGIN`: `*`
- `PORT`: `10000`
- `REACT_APP_API_URL`: The URL of your deployment
- `REACT_APP_RPC_URL`: Same value as your backend `RPC_URL`

### 3. Deploy

Click "Create Web Service" to deploy your application. Once deployment is complete, you can access your application at the URL provided by your hosting service.

### Important Notes for Deployment

- The server must bind to `0.0.0.0` to work on Render (this is already configured in the codebase)
- The frontend and backend are deployed together as a single service
- Environment variables with `REACT_APP_` prefix need to be available during build time

## License

MIT