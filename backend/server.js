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

// Poisson probability calculation helper for live matches
function calculatePoissonProb(k, lambda) {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact;
}

// Unified Proxy Route matching frontend calls (/api/matches?sport=football&date=YYYY-MM-DD)
app.get('/api/matches', async (req, res) => {
  try {
    const { sport = 'football', date } = req.query; // Format: YYYY-MM-DD

    if (sport === 'football') {
      if (!FOOTBALL_DATA_KEY) {
        return res.status(500).json({ error: "FOOTBALL_DATA_KEY is missing on server", matches: [] });
      }

      const response = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${date}&dateTo=${date}`, {
        headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY }
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `Football-Data API error: ${response.status}`, details: errText, matches: [] });
      }

      const data = await response.json();
      const rawApiMatches = data.matches || [];

      // Map raw API fixtures to your frontend's prediction card format
      const matches = rawApiMatches.map((m) => {
        const homeTeam = m.homeTeam?.name || 'Home Team';
        const awayTeam = m.awayTeam?.name || 'Away Team';
        const leagueName = m.competition?.name || 'League';
        const leagueId = m.competition?.code || 'PL';
        const country = m.area?.name || 'World';
        const flag = '⚽';
        const matchTime = m.utcDate ? m.utcDate.replace('T', ' ').substring(0, 16) : `${date} 15:00`;

        // Statistical projection estimation
        const homeXg = 1.35;
        const awayXg = 1.15;

        let homeWinP = 0, drawP = 0, awayWinP = 0;
        for (let h = 0; h <= 6; h++) {
          for (let a = 0; a <= 6; a++) {
            const p = calculatePoissonProb(h, homeXg) * calculatePoissonProb(a, awayXg);
            if (h > a) homeWinP += p;
            else if (h === a) drawP += p;
            else awayWinP += p;
          }
        }
        const totalP = homeWinP + drawP + awayWinP;
        const homeProb = Math.round((homeWinP / totalP) * 100);
        const drawProb = Math.round((drawP / totalP) * 100);
        const awayProb = Math.min(99, 100 - homeProb - drawProb);

        const expGoals = homeXg + awayXg;
        const over1_5 = Math.min(95, Math.max(25, Math.round((1 - (calculatePoissonProb(0, expGoals) + calculatePoissonProb(1, expGoals))) * 100)));
        const over2_5 = Math.min(90, Math.max(15, Math.round((1 - (calculatePoissonProb(0, expGoals) + calculatePoissonProb(1, expGoals) + calculatePoissonProb(2, expGoals))) * 100)));
        const cornersExp = 9.5;
        const cornersOver9_5 = 55;
        const shotsExp = 24.0;
        const shotsOver22_5 = 60;

        let recommendation = homeProb >= 60 ? `Home Win (${homeTeam})` : over2_5 >= 65 ? "Over 2.5 Goals" : `Double Chance 1X`;
        let confidence = homeProb >= 65 || over2_5 >= 70 ? "HIGH" : "MEDIUM";

        return {
          id: `fb-live-${m.id}`,
          sport: 'football',
          leagueId,
          leagueName,
          country,
          flag,
          date: matchTime,
          homeTeam,
          awayTeam,
          homeProb,
          drawProb,
          awayProb,
          homeXg,
          awayXg,
          over1_5,
          over2_5,
          cornersExp,
          cornersOver9_5,
          shotsExp,
          shotsOver22_5,
          recommendation,
          confidence
        };
      });

      return res.json({ matches });
    }

    // Basketball or other sports handling
    return res.json({ matches: [] });
  } catch (error) {
    console.error("Proxy fetch error:", error);
    res.status(500).json({ error: "Failed to fetch football data", details: error.message, matches: [] });
  }
});

// Legacy route backup
app.get('/api/football/matches', async (req, res) => {
  try {
    const { date } = req.query;
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