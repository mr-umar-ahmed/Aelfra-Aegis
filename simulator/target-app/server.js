const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'target-app',
    message: 'Hello World from victim application'
  });
});

app.listen(PORT, () => {
  console.log(`[TARGET-APP] Victim server listening on http://localhost:${PORT}`);
});
