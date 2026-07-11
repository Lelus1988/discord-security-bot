import express, { Request, Response } from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { config } from '../src/config';
import { logger } from '../src/utils/logger';
import { requireAuth } from './middleware/authMiddleware';

import authRoutes          from './routes/auth';
import meRoutes            from './routes/me';
import guildRoutes         from './routes/guilds';
import configRoutes        from './routes/config';
import memberRoutes        from './routes/members';
import roleRoutes          from './routes/roles';
import channelRoutes       from './routes/channels';
import welcomeRoutes       from './routes/welcome';
import rulesRoutes         from './routes/rules';
import customCommandRoutes from './routes/customcommands';
import logsRoutes          from './routes/logs';

const app = express();
const PUBLIC_DIR = path.join(__dirname, 'public');

// ── Middleware ────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret:            config.sessionSecret,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// ── Static assets (css/js) ──────────────────────────────────────────────
app.use(express.static(PUBLIC_DIR, { index: false }));

// ── Auth & API routes ────────────────────────────────────────────────────
app.use('/auth',           authRoutes);
app.use('/api/me',         meRoutes);
app.use('/api/guilds',     guildRoutes);
app.use('/api/config',     configRoutes);
app.use('/api/members',    memberRoutes);
app.use('/api/roles',      roleRoutes);
app.use('/api/channels',   channelRoutes);
app.use('/api/welcome',    welcomeRoutes);
app.use('/api/rules',      rulesRoutes);
app.use('/api/commands',   customCommandRoutes);
app.use('/api/logs',       logsRoutes);

// ── Pages ─────────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/dashboard', requireAuth, (_req: Request, res: Response) => {
  res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
});

app.get('/server/:guildId', requireAuth, (_req: Request, res: Response) => {
  res.sendFile(path.join(PUBLIC_DIR, 'server.html'));
});

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Not Found' });
  } else {
    res.status(404).send('Page not found. <a href="/dashboard">Back to Dashboard</a>');
  }
});

// ── Start (called from src/index.ts, runs in the same process as the bot) ─
export async function startWebPanel(): Promise<void> {
  return new Promise(resolve => {
    app.listen(config.webPort, () => {
      logger.info(`Web panel running at http://localhost:${config.webPort}`);
      resolve();
    });
  });
}
