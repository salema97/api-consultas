const express = require("express");
const ConsulteControllers = require("../controllers/consulte.controllers");

const router = express.Router();

router.get("/basic", ConsulteControllers.ConsultaAduna);
router.get("/advanced", ConsulteControllers.ConsultaCompania);
router.get("/predial", ConsulteControllers.ConsultaPredial);

module.exports = router;
