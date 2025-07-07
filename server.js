javascript
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('Hello from Hardhat Express Web Service!');
});

app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});

