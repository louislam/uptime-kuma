const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class GoogleSheets extends NotificationProvider {
    name = "GoogleSheets";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            // Prepare the data to be logged
            const timestamp = new Date().toISOString();
            let status = "N/A";
            let monitorName = "N/A";
            let monitorUrl = "N/A";
            let responseTime = "N/A";
            let statusCode = "N/A";

            if (monitorJSON) {
                monitorName = monitorJSON.name || "N/A";
                monitorUrl = this.extractAddress(monitorJSON) || "N/A";
            }

            if (heartbeatJSON) {
                status = heartbeatJSON.status === DOWN ? "DOWN" : heartbeatJSON.status === UP ? "UP" : "UNKNOWN";
                responseTime = heartbeatJSON.ping || "N/A";
                statusCode = heartbeatJSON.status || "N/A";
            }

            // Prepare row data based on user configuration
            let rowData = [];
            
            if (notification.googleSheetsCustomFormat) {
                // Custom format - user defines their own columns
                const customColumns = notification.googleSheetsColumns || "timestamp,status,monitor,message";
                const columns = customColumns.split(",").map(col => col.trim());
                
                columns.forEach(column => {
                    switch (column.toLowerCase()) {
                        case "timestamp":
                            rowData.push(timestamp);
                            break;
                        case "status":
                            rowData.push(status);
                            break;
                        case "monitor":
                        case "monitorname":
                            rowData.push(monitorName);
                            break;
                        case "url":
                        case "monitorurl":
                            rowData.push(monitorUrl);
                            break;
                        case "message":
                        case "msg":
                            rowData.push(msg);
                            break;
                        case "responsetime":
                        case "ping":
                            rowData.push(responseTime);
                            break;
                        case "statuscode":
                            rowData.push(statusCode);
                            break;
                        default:
                            rowData.push("");
                    }
                });
            } else {
                // Default format
                rowData = [
                    timestamp,
                    status,
                    monitorName,
                    monitorUrl,
                    msg,
                    responseTime,
                    statusCode
                ];
            }

            // Prepare the request to Google Sheets API
            const spreadsheetId = notification.googleSheetsSpreadsheetId;
            const sheetName = notification.googleSheetsSheetName || "Sheet1";
            const range = `${sheetName}!A:Z`;

            // Use Google Sheets API v4 to append data
            const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append`;
            
            const config = this.getAxiosConfigWithProxy({
                params: {
                    valueInputOption: "USER_ENTERED",
                    insertDataOption: "INSERT_ROWS"
                },
                headers: {
                    "Authorization": `Bearer ${notification.googleSheetsAccessToken}`,
                    "Content-Type": "application/json"
                }
            });

            const data = {
                values: [rowData]
            };

            await axios.post(apiUrl, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = GoogleSheets;
