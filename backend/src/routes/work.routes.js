const express = require("express");
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const controller = require("../controllers/work.controller");
const validator = require("../validators/work.validator");

const router = express.Router();

router.use(auth);

router.post("/", validate(validator.createWorkSchema), controller.createWorkEntry);
router.put("/:id", validate(validator.updateWorkSchema), controller.updateWorkEntry);
router.delete("/:id", validate(validator.deleteWorkSchema), controller.deleteWorkEntry);
router.get("/", validate(validator.listWorkSchema), controller.listWorkEntries);

module.exports = router;
