const { db } = require('../util/admin');

exports.getAllScreams = (req, res) => {
  db.collection('screams')
    .orderBy('createdAt', 'desc')
    .get()
    .then(data => {
      let screams = [];
      data.forEach(doc =>
        screams.push({
          id: doc.id,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt
        })
      );
      return res.json(screams);
    })
    .catch(err => console.error(err));
};

exports.createScream = (req, res) => {
  const {
    user: { handle, imageUrl },
    body: { body }
  } = req;

  if (body.trim() === '') {
    return res.status(400).json({ body: 'Body must not be empty' });
  }

  const newScream = {
    body,
    userHandle: handle,
    userImage: imageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0
  };

  db.collection('screams')
    .add(newScream)
    .then(doc => res.json({ ...newScream, screamId: doc.id }))
    .catch(err => {
      res.status(500).json({ error: 'something went wrong' });
      console.log(err);
    });
};

exports.getScream = (req, res) => {
  const { params } = req;
  let screamData;
  db.doc(`/screams/${params.screamId}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Scream not found' });
      }
      /* screamData = doc.data();
      screamData.screamId = doc.id; */
      screamData = doc.data();
      screamData.screamId = doc.id;
      return db
        .collection('comments')
        .orderBy('createdAt', 'desc')
        .where('screamId', '==', params.screamId)
        .get();
    })
    .then(data => {
      screamData.comments = [];
      data.forEach(doc => screamData.comments.push(doc.data()));
      return res.json(screamData);
    })
    .catch(err => {
      res.status(500).json({ error: 'something went wrong' });
      console.log(err);
    });
};

exports.commentOnScream = (req, res) => {
  const { body, user, params } = req;
  if (!body.body.trim()) {
    return res.status(400).json({ error: 'Must not be empty' });
  }

  const newComment = {
    body: body.body,
    createdAt: new Date().toISOString(),
    screamId: params.screamId,
    userHandle: user.handle,
    userImage: user.imageUrl
  };

  db.doc(`/screams/${params.screamId}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Scream not found' });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => db.collection('comments').add(newComment))
    .then(() => res.json(newComment))
    .catch(err => {
      console.log(err);
      res.status(500).json({ error: 'something went wrong' });
    });
};

exports.likeScream = (req, res) => {
  const { params, user } = req;
  let screamData;
  const likeDocument = db
    .collection('likes')
    .where('screamId', '==', params.screamId)
    .where('userHandle', '==', user.handle)
    .limit(1);
  const screamDocument = db.doc(`/screams/${params.screamId}`);

  screamDocument
    .get()
    .then(doc => {
      if (doc.exists) {
        screamData = { ...doc.data(), screamId: doc.id };
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: 'Scream not found' });
      }
    })
    .then(data => {
      if (data.empty) {
        return db
          .collection('likes')
          .add({
            screamId: params.screamId,
            userHandle: user.handle
          })
          .then(() => {
            screamData.likeCount++;
            return screamDocument.update({ likeCount: screamData.likeCount });
          })
          .then(() => res.json(screamData));
      }

      return res.status(400).json({ error: 'Scream already liked' });
    })
    .catch(err => {
      res.status(500).json({ error: 'something went wrong' });
      console.log(err);
    });
};

exports.unlikeScream = (req, res) => {
  const { params, user } = req;
  let screamData;
  const likeDocument = db
    .collection('likes')
    .where('screamId', '==', params.screamId)
    .where('userHandle', '==', user.handle)
    .limit(1);
  const screamDocument = db.doc(`/screams/${params.screamId}`);

  screamDocument
    .get()
    .then(doc => {
      if (doc.exists) {
        screamData = { ...doc.data(), screamId: doc.id };
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: 'Scream not found' });
      }
    })
    .then(data => {
      if (data.empty) {
        return res.status(400).json({ error: 'Scream not liked' });
      }
      return db
        .doc(`/likes/${data.docs[0].id}`)
        .delete()
        .then(() => {
          screamData.likeCount--;
          return screamDocument.update({ likeCount: screamData.likeCount });
        })
        .then(() => res.json(screamData));
    })
    .catch(err => {
      res.status(500).json({ error: 'something went wrong' });
      console.log(err);
    });
};
