import { Request, Response, NextFunction, response } from "express";
import * as mongoose from "mongoose";
import config from "../config";
import axios from "axios";
import { strict } from "assert";

const CryptoJS = require("crypto-js");
const ejs = require("ejs");
const nodemailer = require("nodemailer");
const path = require("path");
const LuckyExcel = require("luckyexcel");
const fs = require("fs");
const base64toFile = require("node-base64-to-file");

const Schema = mongoose.Schema;
const defaultSchema = new Schema({}, { strict: false });

import parseXlsx from "excel";

var xlsxtojson = require("xlsx-to-json");
var xlstojson = require("xls-to-json");

export class excelController {
  fetchExcelJson = async (req: Request, res: Response, next: NextFunction) => {
    const db = await config.connectdb("global");
    const luckysheetDB = db.model("luckysheet", defaultSchema, "luckysheet");
    var appname = new RegExp(["^", req.params.appname, "$"].join(""), "i");
    var workspace = new RegExp(["^", req.headers.workspace, "$"].join(""), "i");

    let luckysheet = await luckysheetDB
      .findOne({ appname: appname, workspace: workspace })
      .exec();
    return res.status(200).send({ status: "success", luckysheet });
  };

  createApp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // console.log("body", JSON.stringify(req.body));
      // console.log(req.body.requestModel.excelContent);

      const db = await config.connectdb("global");

      let base64Image = req.body.requestModel.excelContent
        .split(";base64,")
        .pop();
      fs.writeFile(
        "./uploads/application.xlsx",
        base64Image,
        { encoding: "base64" },
        function (err) {
          fs.readFile("./uploads/application.xlsx", (err, data) => {
            if (err) {
            }

            LuckyExcel.transformExcelToLucky(
              data,
              async (exportJson, luckysheetfile) => {
                //Iterate through each sheet
				var workspace1 = req.headers.workspace;
                var formulas = [];
                const workspaceConfigCollection =
                  db.collection("workspace_config");
                const document = await workspaceConfigCollection.findOne({
                  workspace_name: workspace1,
                });
                var noOfTabsinSpreadSheet =
                  document?.workspace_config?.noOfTabsinSpreadSheet;
                var numSheets = exportJson.sheets.length;
                if (numSheets <= noOfTabsinSpreadSheet) {
                  exportJson.sheets.forEach((sheet) => {
                    var name =
                      sheet.name.charAt(0).toLowerCase() + sheet.name.slice(1);

                    //first column that contains all headers
                    var firstRow = sheet.celldata.filter(function (el) {
                      return el.r == 0;
                    });
                    var fieldNames = [];
                    firstRow.forEach((data) => {
                      fieldNames.push({
                        code: String.fromCharCode(data.c + 65) + "2",
                        field:
                          name +
                          "." +
                          (data.v.v.charAt(0).toLowerCase() +
                            data.v.v.slice(1)),
                      });
                    });

                    //Second column that has formulas
                    var rowsWithFormula = sheet.celldata.filter(function (el) {
                      return el.r == 1 && el.v.f != null;
                    });

                    rowsWithFormula.forEach((el) => {
                      var formula = el.v.f.substring(1);
                      var input = [];
                      var outputname = firstRow.filter(function (firstel) {
                        return firstel.c == el.c;
                      })[0].v.v;
                      outputname =
                        outputname.charAt(0).toLowerCase() +
                        outputname.slice(1);

                      var output = name + "." + outputname;
                      console.log("output", output);

                      fieldNames.forEach((k) => {
                        if (formula.includes(k.code)) {
                          formula = formula.replaceAll(k.code, k.field);
                          input.push(k.field);
                        }
                      });
                      formulas.push({
                        formula: formula,
                        input: input,
                        output: output,
                      });
                      console.log(firstRow);

                      console.log(formulas);
                    });
                  });

                  const luckysheetDB = db.model(
                    "luckysheet",
                    defaultSchema,
                    "luckysheet"
                  );
                  var appname = new RegExp(
                    ["^", req.params.appname, "$"].join(""),
                    "i"
                  );
                  var workspace = new RegExp(
                    ["^", req.headers.workspace, "$"].join(""),
                    "i"
                  );

                  let luckysheet = await luckysheetDB
                    .update(
                      { appname: appname, workspace: workspace },
                      {
                        formula: formulas,
                        appname: req.params.appname,
                        workspace: req.headers.workspace,
                        luckyJson: exportJson,
                      },
                      { upsert: true }
                    )
                    .exec();

                  axios
                    .post(
                      "http://" +
                        process.env.GENESIS_APP +
                        "/automatedFlow",
                      req.body,
                      {
                        headers: {
                          "Content-Type": "application/json",
                          authorization: req.headers["authorization"],
                          workspace: req.headers.workspace as string,
                        },
                      }
                    )
                    .then(function (response) {
                      return res.status(200).send(response.data);
                    }).catch(function(err) {
                      console.log("Error connecting to Genesis");
                      console.log("Error ::" + err);
                      return res.status(500).send("Error connecting to genesis");
                    });

                } else {
                  return res
                    .status(500)
                    .send("Maximum number of tabs in spreadsheet exceeded");
                }
              }
            );
          });
        }
      );
    } catch (error) {
      return res.status(500).send({ error: "Error occurred: " + error });
    }
  };
}
