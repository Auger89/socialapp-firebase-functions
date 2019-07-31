const firebase = require('firebase');
const BusBoy = require('busboy');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { db, admin } = require('../util/admin');
const config = require('../util/config');
const {
  validateSignupData,
  validateLoginData,
  reduceUserDetails
} = require('../util/validators');

firebase.initializeApp(config);

const AUTH_WRONG_PASSWORD = 'auth/wrong-password';
const AUTH_EMAIL_IN_USE = 'auth/email-already-in-use';
const NO_IMG = 'no-img.png';

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
        return res.status(400).json({ handle: 'This handle is already taken' });
      } else {
        return firebase.auth().createUserWithEmailAndPassword(email, password);
      }
    })
    .then(data => {
      const userCredentials = {
        handle,
        email,
        userId: data.user.uid,
        createdAt: new Date().toISOString(),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${
          config.storageBucket
        }/o/${NO_IMG}?alt=media`
      };
      token = data.user.getIdToken();

      return db.doc(`users/${handle}`).set(userCredentials);
    })
    .then(() => res.status(201).json({ token }))
    .catch(err => {
      console.log(err);
      if (err.code === AUTH_EMAIL_IN_USE) {
        return res.status(400).json({ email: 'Email is already in use' });
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
          .json({ general: 'Wrong credentials. Please try again' });
      }
      return res.status(500).json({ error: err.code });
    });
};

exports.addUserDetails = (req, res) => {
  const { body, user } = req;
  let userDetails = reduceUserDetails(body);

  db.doc(`/users/${user.handle}`)
    .update(userDetails)
    .then(() => res.json({ message: 'Details updated successfully' }))
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.getAuthenticatedUser = (req, res) => {
  const { user } = req;
  let userData = { credentials: {}, likes: [] };

  db.doc(`/users/${user.handle}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        userData.credentials = doc.data();
        return db
          .collection('likes')
          .where('userhandle', '==', user.handle)
          .get(0);
      }
    })
    .then(data => {
      data.forEach(doc => userData.likes.push(doc.data()));
      return res.json(userData);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.uploadImage = (req, res) => {
  const { headers, user, rawBody } = req;
  const busboy = new BusBoy({ headers });

  let imageToUpload = {};
  let imageFilename;

  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
    // console.log(fieldname, file, filename, encoding, mimetype);
    if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
      return res.status(400).json({ message: 'Wrong file type submitted' });
    }

    const imageExtension = filename.split('.')[filename.split('.').length - 1];
    imageFilename = `${Math.round(
      Math.random() * 10000000000
    )}.${imageExtension}`;
    const filePath = path.join(os.tmpdir(), imageFilename);
    imageToUpload = { filePath, mimetype };

    file.pipe(fs.createWriteStream(filePath));
  });

  busboy.on('finish', () => {
    admin
      .storage()
      .bucket()
      .upload(imageToUpload.filePath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToUpload.mimetype
          }
        }
      })
      .then(() => {
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${
          config.storageBucket
        }/o/${imageFilename}?alt=media`;
        return db.doc(`/users/${user.handle}`).update({ imageUrl });
      })
      .then(() => {
        return res.json({ message: 'Image uploaded successfully' });
      })
      .catch(err => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  });

  busboy.on('error', err => {
    console.log('Busboy error: ', err);
  });

  busboy.end(rawBody);
};
