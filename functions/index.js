const functions = require("firebase-functions");
const express = require("express");
const { getAllScreams, createScream } = require("./handlers/screams");
const {
  signup,
  login,
  uploadImage,
  addUserDetails
} = require("./handlers/users");
const FBAuth = require("./util/fbAuth");
// Warning!! Google Cloud Functions only supports Node v6, so: Do not use ES6 syntax!

const app = express();

// scream routes
app.get("/screams", getAllScreams);
app.post("/scream", FBAuth, createScream);

// user routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);

exports.api = functions.region("europe-west1").https.onRequest(app);
