// pm2 の設定（自宅 PC で常駐させる場合に使用）: pm2 startOrReload ecosystem.config.cjs
const os = require('node:os');
const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'home-information',
      script: 'dist/server/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        HOME_INFO_PORT: process.env.HOME_INFO_PORT || '8580',
        // 設定・データはアプリ本体とは別の場所に保存（再デプロイしても消えない）
        HOME_INFO_DATA_DIR: process.env.HOME_INFO_DATA_DIR || path.join(os.homedir(), 'HomeInformation', 'data'),
      },
      max_restarts: 20,
      restart_delay: 5000,
    },
  ],
};
