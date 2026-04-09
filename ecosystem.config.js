module.exports = {
  apps: [
    {
      name: '{{PROJECT_NAME_LOWER}}-api',
      script: 'dist/src/app.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      // Restart on failure
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000
    }
  ]
};
