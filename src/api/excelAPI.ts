import * as express from "express";
import { excelController } from "../controllers/excelController";
var multer = require("multer");
const storage = multer.memoryStorage()
const upload = multer({ dest: 'uploads/' })
// const upload = multer({
//   storage: storage,
//  })

const Controller: excelController = new excelController();
let router = express.Router();
router.post("/:appname",upload.single('File'),Controller.createApp)
router.get("/:appname",Controller.fetchExcelJson)

export = router;
 