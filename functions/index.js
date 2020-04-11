const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const {
  getAllScreams,
  createScream,
  getScream,
  commentOnScream,
  likeScream,
  unlikeScream,
  deleteScream
} = require('./handlers/screams');
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationsRead
} = require('./handlers/users');
const FBAuth = require('./util/fbAuth');
const { db } = require('./util/admin');

const app = express();

// Allow cross-origin requests
app.use(cors({ origin: true }));

// scream routes
app.get('/screams', getAllScreams);
app.post('/scream', FBAuth, createScream);
app.get('/scream/:screamId', getScream);
app.delete('/scream/:screamId', FBAuth, deleteScream);
app.get('/scream/:screamId/like', FBAuth, likeScream);
app.get('/scream/:screamId/unlike', FBAuth, unlikeScream);
app.post('/scream/:screamId/comment', FBAuth, commentOnScream);

// user routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);

exports.api = functions.region('europe-west1').https.onRequest(app);

exports.createNotificationsOnLike = functions
  .region('europe-west1')
  .firestore.document('likes/{id}')
  .onCreate(snapshot => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then(doc => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'like',
            read: false,
            screamId: doc.id
          });
        }
        throw new Error('Scream does not exist or belong to user');
      })
      .catch(err => console.error(err));
  });

exports.deleteNotificationOnUnlike = functions
  .region('europe-west1')
  .firestore.document('likes/{id}')
  .onDelete(snapshot => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch(err => console.error(err));
  });

exports.createNotificationsOnComment = functions
  .region('europe-west1')
  .firestore.document('comments/{id}')
  .onCreate(snapshot => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then(doc => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'comment',
            read: false,
            screamId: doc.id
          });
        }
        throw new Error('Comment does not exist or belong to user');
      })
      .catch(err => console.error(err));
  });

exports.onUserImageChange = functions
  .region('europe-west1')
  .firestore.document('users/{userId}')
  .onUpdate(change => {
    const oldDocument = change.before.data();
    const newDocument = change.after.data();
    console.log(oldDocument);
    console.log(newDocument);

    if (oldDocument.imageUrl !== newDocument.imageUrl) {
      const batch = db.batch();
      return db
        .collection('screams')
        .where('userHandle', '==', oldDocument.handle)
        .get()
        .then(data => {
          data.forEach(doc => {
            const screamRef = db.doc(`/screams/${doc.id}`);
            batch.update(screamRef, { userImage: newDocument.imageUrl });
          });
          return batch.commit();
        })
        .catch(err => console.error(err));
    }
    return true;
  });

exports.onScreamDelete = functions
  .region('europe-west1')
  .firestore.document('screams/{screamId}')
  .onDelete((snapshot, context) => {
    const {
      params: { screamId }
    } = context;
    const batch = db.batch();

    return db
      .collection('comments')
      .where('screamId', '==', screamId)
      .get()
      .then(data => {
        data.forEach(doc => {
          const commentRef = db.doc(`/comments/${doc.id}`);
          batch.delete(commentRef);
        });

        return db
          .collection('likes')
          .where('screamId', '==', screamId)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          const likeRef = db.doc(`/likes/${doc.id}`);
          batch.delete(likeRef);
        });

        return db
          .collection('notifications')
          .where('screamId', '==', screamId)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          const notificationRef = db.doc(`/notifications/${doc.id}`);
          batch.delete(notificationRef);
        });

        return batch.commit();
      })
      .catch(err => console.error(err));
  });
