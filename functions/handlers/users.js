const firebase = require("firebase");
const { db } = require("../util/admin");
const config = require("../util/config");
const { validateSignupData, validateLoginData } = require("../util/validators");

firebase.initializeApp(config);

const AUTH_WRONG_PASSWORD = "auth/wrong-password";
const AUTH_EMAIL_IN_USE = "auth/email-already-in-use";

exports.signup = (req, res) => {
  const {
    body: { email, password, confirmPassword, handle }
  } = req;
  let token;

  const { valid, errors } = validateSignupData({
    email,
    password,
    confirmPassword,
    handle
  });

  if (!valid) return res.status(400).json(errors);

  db.doc(`/users/${handle}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        return res.status(400).json({ handle: "This handle is already taken" });
      } else {
        return firebase.auth().createUserWithEmailAndPassword(email, password);
      }
    })
    .then(data => {
      const userCredentials = {
        handle,
        email,
        userId: data.user.uid,
        createdAt: new Date().toISOString()
      };
      token = data.user.getIdToken();

      return db.doc(`users/${handle}`).set(userCredentials);
    })
    .then(() => res.status(201).json({ token }))
    .catch(err => {
      console.log(err);
      if (err.code === AUTH_EMAIL_IN_USE) {
        return res.status(400).json({ email: "Email is already in use" });
      }
      return res.status(500).json({ error: err.code });
    });
};

exports.login = (req, res) => {
  const {
    body: { password, email }
  } = req;

  const { valid, errors } = validateLoginData({ password, email });

  if (!valid) return res.status(400).json(errors);

  firebase
    .auth()
    .signInWithEmailAndPassword(email, password)
    .then(data => data.user.getIdToken())
    .then(token => res.json({ token }))
    .catch(err => {
      console.log(err);
      if (err.code === AUTH_WRONG_PASSWORD) {
        return res
          .status(403)
          .json({ general: "Wrong credentials. Please try again" });
      }
      return res.status(500).json({ error: err.code });
    });
};
