const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors()); // Allows your Vercel frontend to call this server
app.use(express.json());

const PORT = process.env.PORT || 5000;

// API Keys stored safely in Server Environment Variables
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || '';
const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
const ODDSPAPI_KEY = process.env.ODDSPAPI_KEY || '';

// Proxy Route for Football Matches (football-data.org)
app.get('/api/football/matches', async (req, res) => {
  try {
    const { date } = req.query; // Format: YYYY-MM-DD
    if (!FOOTBALL_DATA_KEY) {
      return res.status(500).json({ error: "FOOTBALL_DATA_KEY is missing on server" });
    }

    const response = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`, {
      headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY }
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch football data", details: error.message });
  }
});

// Proxy Route for Odds (the-odds-api.com)
app.get('/api/odds', async (req, res) => {
  try {
    const { sport = 'soccer_epl' } = req.query;
    if (!ODDS_API_KEY) {
      return res.status(500).json({ error: "ODDS_API_KEY is missing on server" });
    }

    const response = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?regions=us,uk,eu&apiKey=${ODDS_API_KEY}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch odds data", details: error.message });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send("OmniSports Backend Server is Running Securely!");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});