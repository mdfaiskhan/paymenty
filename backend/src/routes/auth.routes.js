const express = require("express");
const validate = require("../middlewares/validate.middleware");
const { loginSchema, signupSchema } = require("../validators/auth.validator");
const { login, signup } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/signup", validate(signupSchema), signup);
router.post("/login", validate(loginSchema), login);

module.exports = router;
