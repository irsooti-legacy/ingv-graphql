const express = require('express');
const graphqlHTTP = require('express-graphql');
const app = express();

const redis = require('redis');

const redisClient = require('./redisClient');

const schema = require('./schema');

app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    graphiql: true
  })
);

app.listen(process.env.PORT || 8080);
console.log('Listening....');
