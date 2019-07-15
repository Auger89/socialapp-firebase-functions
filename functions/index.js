const functions = require("firebase-functions");
const express = require("express");
const { getAllScreams, createScream } = require("./handlers/screams");
const { signup, login } = require("./handlers/users");
const FBAuth = require("./util/fbAuth");
// Warning!! Google Cloud Functions only supports Node v6, so: Do not use ES6 syntax!

const app = express();

app.get("/screams", getAllScreams);
app.post("/scream", FBAuth, createScream);

app.post("/signup", signup);
app.post("/login", login);

exports.api = functions.region("europe-west1").https.onRequest(app);
