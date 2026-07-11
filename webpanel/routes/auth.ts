import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../../src/config';

const router = Router();

const DISCORD_API  = 'https://discord.com/api/v10';
const OAUTH_SCOPES = 'identify guilds';

/** Redirect user to Discord OAuth2 authorization page. */
router.get('/login', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id:     config.clientId,
    redirect_uri:  config.oauth2RedirectUri,
    response_type: 'code',
    scope:         OAUTH_SCOPES,
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

/** OAuth2 callback – exchange code for token, fetch user & guilds. */
router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).send('Missing code parameter.');
    return;
  }

  try {
    // Exchange code for access token
    const tokenRes = await axios.post(
      `${DISCORD_API}/oauth2/token`,
      new URLSearchParams({
        client_id:     config.clientId,
        client_secret: config.clientSecret,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  config.oauth2RedirectUri,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken: string = tokenRes.data.access_token;

    const headers = { Authorization: `Bearer ${accessToken}` };

    // Fetch current user
    const [userRes, guildsRes] = await Promise.all([
      axios.get(`${DISCORD_API}/users/@me`, { headers }),
      axios.get(`${DISCORD_API}/users/@me/guilds`, { headers }),
    ]);

    req.session.accessToken = accessToken;
    req.session.user        = userRes.data;
    req.session.guilds      = guildsRes.data;

    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth2 callback error:', err);
    res.status(500).send('Authentication failed. Please try again.');
  }
});

/** Logout: destroy session. */
router.get('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

export default router;
