const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const User = require('../models/User');

function initPassport(app) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = process.env;

  app.use(passport.initialize());

  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_CALLBACK_URL) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails && profile.emails[0] && profile.emails[0].value;
            if (!email) return done(null, false);

            const normalizedEmail = String(email).toLowerCase();

            let user = await User.findOne({ email: normalizedEmail });
            if (!user) {
              user = await User.create({
                name: profile.displayName || 'User',
                email: normalizedEmail,
                phone: '',
                profilePicture: (profile.photos && profile.photos[0] && profile.photos[0].value) || '',
                authProvider: 'google',
                googleId: profile.id,
                role: 'user',
                status: 'active',
              });
            } else {
              if (!user.googleId) user.googleId = profile.id;
              if (!user.profilePicture && profile.photos && profile.photos[0]) {
                user.profilePicture = profile.photos[0].value;
              }
              if (user.status === 'blocked') return done(null, false);
              await user.save();
            }

            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  }
}

module.exports = { initPassport, passport };
