const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('./cloudinary');

function getCloudinaryStorage({ folder, resourceType }) {
  return new CloudinaryStorage({
    cloudinary,
    params: async () => {
      return {
        folder: folder || process.env.CLOUDINARY_FOLDER || 'tdp-party',
        resource_type: resourceType || 'auto',
      };
    },
  });
}

function makeUploader({ folder, resourceType, maxFileSizeMb = 25 }) {
  return multer({
    storage: getCloudinaryStorage({ folder, resourceType }),
    limits: {
      fileSize: maxFileSizeMb * 1024 * 1024,
    },
  });
}

module.exports = { makeUploader };
