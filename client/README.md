# Nom - Solana Token Monitor Frontend

This is the frontend for the Nom application, a Solana token monitoring tool that tracks new token launches from Raydium LetsBonk launchpad.

## Features

- Real-time monitoring of new Solana token launches
- Token analytics (holder distribution, bonding curve progress)
- Swap integration with Raydium
- AI-powered token analysis

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on the `.env.example` template:
   ```
   REACT_APP_RPC_URL=your_rpc_url_here
   REACT_APP_API_URL=http://localhost:5000
   ```

## Available Scripts

### `npm start`

Runs the app in development mode with hot reloading.
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### `npm run build`

Builds the app for production to the `build` folder.
The build is optimized and ready for deployment.

## Architecture

This frontend uses:
- React 18
- Solana Web3.js and wallet adapters
- Raydium SDK for swap functionality
- React Toastify for notifications
- Custom CSS for styling

## Backend Connection

The frontend connects to the Nom backend Express server which:
- Monitors the Solana blockchain for new tokens
- Provides token analytics
- Offers AI analysis of token data

## Deployment

To deploy the frontend:

1. Set up your environment variables for production
2. Run `npm run build`
3. Deploy the contents of the `build` directory to your hosting service

## Notes

- The app requires an active internet connection and cannot work offline
- You need a valid Solana RPC endpoint for blockchain interactions
- For full functionality, the backend server must be running
