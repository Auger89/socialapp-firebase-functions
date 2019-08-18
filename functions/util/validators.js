const EMAIL_REGEX = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const isEmpty = string => string.trim() === '';
const isEmail = email => email.match(EMAIL_REGEX);

exports.validateSignupData = data => {
  const { email, password, confirmPassword, handle } = data;
  const errors = {};

  if (isEmpty(email)) {
    errors.email = 'Must not be empty';
  } else if (!isEmail(email)) {
    errors.email = 'Must be a valid email adress';
  }
  if (isEmpty(password)) {
    errors.password = 'Must not be empty';
  }
  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords must match';
  }
  if (isEmpty(handle)) {
    errors.handle = 'Must not be empty';
  }

  return { errors, valid: Object.keys(errors).length === 0 };
};

exports.validateLoginData = data => {
  const { email, password } = data;
  const errors = {};

  if (isEmpty(email)) errors.email = 'Must not be empty';
  if (isEmpty(password)) errors.password = 'Must not be empty';

  return { errors, valid: Object.keys(errors).length === 0 };
};

exports.reduceUserDetails = ({ bio, website, location }) => {
  const userDetails = {};

  if (!isEmpty(bio.trim())) {
    userDetails.bio = bio.trim();
  }
  if (!isEmpty(website.trim())) {
    userDetails.website =
      website.trim().substring(0, 4) !== 'http'
        ? `http://${website.trim()}`
        : website.trim();
  }
  if (!isEmpty(location.trim())) {
    userDetails.location = location.trim();
  }

  return userDetails;
};
