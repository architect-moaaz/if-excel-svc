import * as express from "express";
import * as excelAPI from "../api/excelAPI"

let router = express.Router();
router.use('/excel',excelAPI)

export = router;
