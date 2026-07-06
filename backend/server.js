require('dotenv').config();
require('express-async-errors');

const app = require('./src/app');
const { startDepositCleanupJob } = require('./src/jobs/depositCleanup');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startDepositCleanupJob();
});
