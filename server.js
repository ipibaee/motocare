// server.js
// Local development server supporting both static file hosting and API endpoints
const express = require('express');
const path = require('path');
const apiRouter = require('./api/index.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Mount the API router
app.use(apiRouter);

// Serve static files from root directory
app.use(express.static(__dirname));

// Serve files from lib folder specifically if requested
app.use('/lib', express.static(path.join(__dirname, 'lib')));

// Fallback for single page app (SPA) routing: serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Local server running at http://localhost:${PORT}/`);
  console.log('Press Ctrl+C to stop the server.');
});
