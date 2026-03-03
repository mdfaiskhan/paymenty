const express = require("express");
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const controller = require("../controllers/employee.controller");
const validator = require("../validators/employee.validator");

const router = express.Router();

router.use(auth);

router.post("/", validate(validator.createEmployeeSchema), controller.createEmployee);
router.get("/", validate(validator.listEmployeesSchema), controller.listEmployees);
router.put("/:id", validate(validator.updateEmployeeSchema), controller.updateEmployee);
router.delete("/:id", validate(validator.deleteEmployeeSchema), controller.deleteEmployee);

module.exports = router;
