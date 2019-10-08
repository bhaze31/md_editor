const express = require('express');
const app = express();

// Set the view engine to ejs
app.set('view engine', 'ejs');

// public folder to store assets
app.use(express.static(__dirname + '/public'));

// routes for app
app.get('/', function (req, res) {
    res.render('pad');
});

app.get('/(:id)', function (req, res) {
    res.render('pad');
});

// get sharejs dependencies
var sharejs = require('share');
require('redis');

// options for sharejs
var options = {
    db: { type: 'redis' },
};

// attach the express server to sharejs
sharejs.server.attach(app, options);

// listen on port 8000 (for localhost) or the port defined for heroku
const port = process.env.PORT || 8000
app.listen(port);
