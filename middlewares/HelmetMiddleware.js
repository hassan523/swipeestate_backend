import helmet from "helmet";

const SecurityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "http://localhost:5000", "http://localhost:5173", "http://31.97.141.173:5000/api/login", "http://www.justseniors.org", "https://www.justseniors.org", "http://justseniors.org", "https://justseniors.org", "https://api.justseniors.org"],
      connectSrc: ["'self'", "http://localhost:3000", "http://localhost:5000", "http://localhost:5173", "http://31.97.141.173:5000/api/login", "https://www.justseniors.org", "https://justseniors.org", "https://api.justseniors.org"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

export default SecurityHeaders;
