import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";

// Max file size: 3 GB
const MAX_SIZE = 3 * 1024 * 1024 * 1024; // 3 GB in bytes

// Upload destination base path
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure directory exists
const ensureUploadPath = () => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
};

// Multer storage config for disk
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    ensureUploadPath();
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, uniqueName);
  },
});

// Validate only PNG/JPG
const fileFilter = (req, file, cb) => {
  const allowedExts = [".png", ".jpg", ".jpeg"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only .png, .jpg and .jpeg formats are allowed."));
  }
};


const CreateUploadMiddleware = (fields) => {
  // Map field configs so we can check later
  const fieldConfigs = {};
  fields.forEach((field) => {
    fieldConfigs[field.name] = {
      allowedMimeTypes: field.allowedMimeTypes || [],
      maxSize: field.fieldConfig?.maxSize || MAX_SIZE,
      size: field.fieldConfig?.size || null, // ✅ default to null
      isMultiple: field.isMultiple || false,
    };
  });

  const fileFilter = (req, file, cb) => {
    const config = fieldConfigs[file.fieldname];

    if (config?.allowedMimeTypes?.length > 0) {
      if (!config.allowedMimeTypes.includes(file.mimetype)) {
        return cb(
          new Error(
            `Invalid file type for "${
              file.fieldname
            }". Allowed types: ${config.allowedMimeTypes.join(", ")}`
          )
        );
      }
    }
    cb(null, true);
  };

  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_SIZE,
      files: 5,
    },
    fileFilter,
  });

  const formattedFields = fields.map((field) => ({
    name: field.name,
    maxCount: field.isMultiple ? 5 : 1,
  }));

  return (req, res, next) => {
    upload.fields(formattedFields)(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: `File too large. Max size is ${MAX_SIZE / (1024 * 1024)}MB.`,
          });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({ error: "Too many files uploaded." });
        }
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }

      try {
        // ✅ Process resizing immediately
        for (const field in req.files) {
          const config = fieldConfigs[field];
          if (config?.size) {
            await Promise.all(
              req.files[field].map(async (file) => {
                const ext = path.extname(file.filename).toLowerCase();
                const baseName = path.basename(file.filename, ext);
                const resizedPath = path.join(
                  UPLOAD_DIR,
                  `${baseName}-resized${ext}`
                );

                await sharp(file.path)
                  .resize({
                    width: parseInt(config.size.w, 10),
                    height: parseInt(config.size.h, 10),
                    fit: "cover",
                  })
                  .toFile(resizedPath);

                // Replace original file info with resized version
                file.originalPath = file.path; // keep original reference
                file.path = resizedPath;
                file.filename = `${baseName}-resized${ext}`;
                file.resized = true;
              })
            );
          }
        }
      } catch (resizeErr) {
        console.log(resizeErr);
        return res
          .status(500)
          .json({ error: "Error processing image resize." });
      }

      next();
    });
  };
};

export { CreateUploadMiddleware };