const jwt = require('jsonwebtoken')


// Replace this with your actual secret key




const verifyToken = (req, res, next) => {
    try {
        // Get the token from the cookie (assuming the token is stored in a cookie named 'authToken')
        const token = req.headers.authorization;
        //const token = req.cookies.token;
    
        if (!token) {
          return res.status(401).json({ message: "Access token is missing or invalid" });
        }
    
        // Verify the token
        const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    
        // Attach the decoded token data to the request object for use in routes
        req.user = decoded;
    
        // Proceed to the next middleware or route
        next();
      } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
};

module.exports = verifyToken;