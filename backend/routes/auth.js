const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { lawyerUpload } = require('../config/lawyerMulter');

router.post('/register', authController.register);
router.post('/register-lawyer', lawyerUpload, authController.registerLawyer);
router.post('/login', authController.login);
router.get('/me', authController.getMe);

module.exports = router; 