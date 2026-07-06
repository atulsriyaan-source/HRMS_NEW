const express = require('express');
const router = express.Router();
const multer = require('multer')
const hrController = require('../controllers/hrController');

router.get("/requests", hrController.getAllRequestsForHR);
router.put("/requests/:requestId", hrController.updateRequestStatus);

module.exports = router;

