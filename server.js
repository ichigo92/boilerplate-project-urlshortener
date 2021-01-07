require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const crypto = require('crypto');
const dns = require('dns');
const mongoose = require('mongoose');

const { Schema } = mongoose;

// Basic Configuration
const port = process.env.PORT || 3000;

mongoose.connect(process.env.DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const checkMongoDBConnection = async () => {
  if (mongoose.connection.readystate === 0) {
    await mongoose.connect(process.env.DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  }

  return true;
};


const shorturlSchema = new Schema({
  original_url: { type: String, required: true },
  short_url: { type: String, required: true }
});

const Shorturl = mongoose.model('Shorturl', shorturlSchema);

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

app.use(bodyParser.urlencoded({extended: false}));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

app.get('/api/shorturl/:shorturl', (req, res) => {
  checkMongoDBConnection();
  const url = req.params.shorturl;
  if (!url) {
    return res.json({error: "invalid url"})
  }
  Shorturl.findOne({short_url: url}, (err, data) => {
    if (err) return res.json({error:  err});
    if (!err && !data) return res.json({error: "invalid url"});
    res.redirect(data.original_url);
  });
});

app.post('/api/shorturl/new', async (req, res) => {
  checkMongoDBConnection();
  const url = req.body.url;
  
  if (!url) {
    console.log('url--', url)
    return res.json({error: "invalid url"})
  }
  console.log('url', url);
  let temp_url = url.split(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/img)[1];
  dns.lookup(temp_url, async (err, address, family) => {
    console.log(`address ${address} IPv4${family} err${err}`);
    if (err) {
      res.json({error: "invalid url"});
    } else {
      const exists = await Shorturl.findOne({original_url: url});
      if (exists) {
        const {original_url, short_url} = exists;
        res.json({original_url, short_url});
      } else {
        const hash = crypto.createHmac('sha256', process.env.CRYPTO_SECRET)
                        .update(url)
                        .digest('hex');
      
        const shorturl = new Shorturl({ original_url: url, short_url: hash });
        shorturl.save((err, data) => {
          if (err) return res.json({error: err});
          res.json({original_url: url, short_url: hash});
        });
      }
    }
  });
  
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
