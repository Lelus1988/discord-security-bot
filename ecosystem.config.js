// PM2 process configuration.
// Runs the compiled bot (dist/src/index.js) as a background service that:
//  - keeps running after you close the terminal / VS Code
//  - restarts automatically if it crashes
//  - can be set to auto-start when Windows boots (see README)
//
// IMPORTANT: run `npm run build` before starting this, since it points at
// the compiled output in dist/, not the TypeScript source.

module.exports = {
  apps: [
    {
      name: 'security-bot',
      script: 'dist/src/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      time: true,
    },
  ],
};
