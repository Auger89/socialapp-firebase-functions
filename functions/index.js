const functions = require('firebase-functions');
const express = require('express');
const {
  getAllScreams,
  createScream,
  getScream,
  commentOnScream,
  likeScream,
  unlikeScream
} = require('./handlers/screams');
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser
} = require('./handlers/users');
const FBAuth = require('./util/fbAuth');

// TODO Section
// - Add ESLint

const app = express();

// scream routes
app.get('/screams', getAllScreams);
app.post('/scream', FBAuth, createScream);
app.get('/scream/:screamId', getScream);
// TODO delete scream
app.get('/scream/:screamId/like', FBAuth, likeScream);
app.get('/scream/:screamId/unlike', FBAuth, unlikeScream);
app.post('/scream/:screamId/comment', FBAuth, commentOnScream);

// user routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);

exports.api = functions.region('europe-west1').https.onRequest(app);
