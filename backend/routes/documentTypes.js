const express = require('express');
const router = express.Router();
const documentTypeController = require('../controllers/documentTypeController');

router.get('/', documentTypeController.getAllTypes);

module.exports = router; 