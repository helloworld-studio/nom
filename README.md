# Nom - Solana Token Monitor

A real-time Solana token monitoring application that tracks new token launches from Raydium LetsBonk Launchpad, providing analytics and AI-powered insights.

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
- LLM API key (for AI analysis)

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
git clone https://github.com/yourusername/nom.git
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

## Deployment

The application is ready for deployment on platforms like Heroku, Render, or DigitalOcean:

1. Set the required environment variables on your hosting platform
2. Deploy the code to your platform
3. The build script will automatically build the frontend

## License

MIT