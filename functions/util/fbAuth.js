const { db, admin } = require('./admin');

module.exports = (req, res, next) => {
  const {
    headers: { authorization }
  } = req;
  let idToken;

  if (authorization && authorization.startsWith('Bearer ')) {
    const [, token] = authorization.split('Bearer ');
    idToken = token;
  } else {
    console.error('No token found');
    return res.status(403).json({ error: 'Unauthorized' });
  }

  admin
    .auth()
    .verifyIdToken(idToken)
    .then(async decodedToken => {
      req.user = decodedToken;
      return db
        .collection('users')
        .where('userId', '==', req.user.uid)
        .limit(1)
        .get()
        .catch(err => console.error('error while retrieving user', err));
    })
    .then(data => {
      // console.log("-data-", data);
      req.user.handle = data.docs[0].data().handle;
      req.user.imageUrl = data.docs[0].data().imageUrl;
      return next();
    })
    .catch(err => {
      console.error('Error while verifying token', err);
      return res.status(403).json(err);
    });
};
