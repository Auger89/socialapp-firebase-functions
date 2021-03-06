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

const AUTH_EMAIL_IN_USE = 'auth/email-already-in-use';
const AUTH_WEAK_PASSWORD = 'auth/weak-password';
const NO_IMG = 'no-img.png';

exports.signup = (req, res) => {
  const {
    body: { email, password, confirmPassword, handle }
  } = req;
  let token;
  let userId;

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
      }
      return firebase.auth().createUserWithEmailAndPassword(email, password);
    })
    .then(data => {
      userId = data.user.uid;
      return data.user.getIdToken();
    })
    .then(idToken => {
      token = idToken;
      const userCredentials = {
        handle,
        email,
        userId,
        createdAt: new Date().toISOString(),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${NO_IMG}?alt=media`
      };

      return db.doc(`users/${handle}`).set(userCredentials);
    })
    .then(() => res.status(201).json({ token }))
    .catch(err => {
      console.log(err);
      if (err.code === AUTH_EMAIL_IN_USE) {
        return res.status(400).json({ email: 'Email is already in use' });
      }
      if (err.code === AUTH_WEAK_PASSWORD) {
        return res
          .status(400)
          .json({ password: 'Password should be at least 6 characters' });
      }
      return res
        .status(500)
        .json({ general: 'Something went wrong, please try again' });
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
      return res
        .status(403)
        .json({ general: 'Wrong credentials. Please try again' });
    });
};

exports.addUserDetails = (req, res) => {
  const { body, user } = req;
  const userDetails = reduceUserDetails(body);

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
  const userData = { credentials: {}, likes: [], notifications: [] };

  db.doc(`/users/${user.handle}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        userData.credentials = doc.data();
        return db
          .collection('likes')
          .where('userHandle', '==', user.handle)
          .get(0);
      }
      return [];
    })
    .then(data => {
      data.forEach(doc => userData.likes.push(doc.data()));
      return db
        .collection('notifications')
        .where('recipient', '==', user.handle)
        .orderBy('createdAt', 'desc')
        .get();
    })
    .then(querySnapshot => {
      querySnapshot.forEach(docSnapshot =>
        userData.notifications.push({
          ...docSnapshot.data(),
          id: docSnapshot.id
        })
      );
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
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFilename}?alt=media`;
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

exports.getUserDetails = (req, res) => {
  const { params } = req;
  let userData;
  db.doc(`users/${params.handle}`)
    .get()
    .then(docSnapshot => {
      if (docSnapshot.exists) {
        userData = { user: docSnapshot.data(), screams: [] };
        return db
          .collection('screams')
          .where('userHandle', '==', params.handle)
          .orderBy('createdAt', 'desc')
          .get();
      }
      return res.status(404).json({ error: 'User not found' });
    })
    .then(querySnapshot => {
      querySnapshot.forEach(doc =>
        userData.screams.push({ ...doc.data(), id: doc.id })
      );
      return res.json(userData);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.markNotificationsRead = (req, res) => {
  const { body } = req;
  const batch = db.batch();

  body.forEach(notificationId => {
    const notificationRef = db.doc(`/notifications/${notificationId}`);
    batch.update(notificationRef, { read: true });
  });

  batch
    .commit()
    .then(() => res.json({ message: 'Notificacions marked read' }))
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
