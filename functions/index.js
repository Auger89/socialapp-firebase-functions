const functions = require("firebase-functions");
const express = require("express");
const {
  getAllScreams,
  createScream,
  getScream
} = require("./handlers/screams");
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser
} = require("./handlers/users");
const FBAuth = require("./util/fbAuth");
// Warning!! Google Cloud Functions only supports Node v6, so: Do not use ES6 syntax!

const app = express();

// scream routes
app.get("/screams", getAllScreams);
app.post("/scream", FBAuth, createScream);
app.get("/scream/:screamId", getScream);
// TODO delete scream
// TODO like scream
// TODO unlike scream
// TODO comment on scream

// user routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthenticatedUser);

exports.api = functions.region("europe-west1").https.onRequest(app);
