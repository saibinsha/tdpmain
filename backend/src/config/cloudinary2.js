let cloudinary2 = null;

function getCloudinary2() {
  if (cloudinary2) return cloudinary2;

  const { CLOUDINARY_CLOUD_NAME2, CLOUDINARY_API_KEY2, CLOUDINARY_API_SECRET2 } = process.env;
  if (!CLOUDINARY_CLOUD_NAME2 || !CLOUDINARY_API_KEY2 || !CLOUDINARY_API_SECRET2) {
    return null;
  }

  const pkg = require('cloudinary');
  if (pkg && pkg.Cloudinary) {
    cloudinary2 = new pkg.Cloudinary({
      cloud: { cloudName: CLOUDINARY_CLOUD_NAME2 },
      api: { apiKey: CLOUDINARY_API_KEY2, apiSecret: CLOUDINARY_API_SECRET2 },
      url: { secure: true },
    });
    return cloudinary2;
  }

  const v2 = pkg.v2;
  v2.config({
    cloud_name: CLOUDINARY_CLOUD_NAME2,
    api_key: CLOUDINARY_API_KEY2,
    api_secret: CLOUDINARY_API_SECRET2,
    secure: true,
  });
  cloudinary2 = v2;
  return cloudinary2;
}

module.exports = { getCloudinary2 };
