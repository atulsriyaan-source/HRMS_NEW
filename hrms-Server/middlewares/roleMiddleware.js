// middlewares/roleMiddleware.js
module.exports = function checkRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const userRole = req.user.role || 'employee';
    
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Access denied. Insufficient permissions."
    });
  };
};