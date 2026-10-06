import fs from "fs";
import path from "path";

// Use ephemeral /tmp folder for serverless
const logDirectory = path.resolve("/tmp/logs");

let errorLogStream;

try {
   // Ensure logs directory exists
   if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
   }

   // Create write stream
   errorLogStream = fs.createWriteStream(path.join(logDirectory, "errors.log"), { flags: "a" });
   console.log("✅ ErrorLogger initialized successfully");
} catch (err) {
   console.error("⚠️ ErrorLogger initialization failed:", err);

   // Fallback dummy logger to avoid crash
   errorLogStream = {
      write: () => {},
   };
}

// Middleware function
const errorLogger = (err, req, res, next) => {
   const log = `
[${new Date().toISOString()}]
${req.method} ${req.originalUrl}
Status: ${err.status || 500}
Message: ${err.message}
Stack: ${err.stack}

`;

   try {
      errorLogStream.write(log);
   } catch (writeErr) {
      console.error("⚠️ Failed to write error log:", writeErr);
   }

   // Forward to next error handler
   next(err);
};

export default errorLogger;
