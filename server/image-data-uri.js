/*
    From https://github.com/DiegoZoracKy/image-data-uri/blob/master/lib/image-data-uri.js
    Modified with 0 dependencies
 */
let fs = require("fs");

let ImageDataURI = (() => {

    function decode(dataURI) {
        if (!/data:image\//.test(dataURI)) {
            console.log("ImageDataURI :: Error :: It seems that it is not an Image Data URI. Couldn't match \"data:image/\"");
            return null;
        }

        let regExMatches = dataURI.match("data:(image/.*);base64,(.*)");
        return {
            imageType: regExMatches[1],
            dataBase64: regExMatches[2],
            dataBuffer: new Buffer(regExMatches[2], "base64")
        };
    }

    function encode(data, mediaType) {
        if (!data || !mediaType) {
            console.log("ImageDataURI :: Error :: Missing some of the required params: data, mediaType ");
            return null;
        }

        mediaType = (/\//.test(mediaType)) ? mediaType : "image/" + mediaType;
        let dataBase64 = (Buffer.isBuffer(data)) ? data.toString("base64") : new Buffer(data).toString("base64");
        let dataImgBase64 = "data:" + mediaType + ";base64," + dataBase64;

        return dataImgBase64;
    }

    function outputFile(dataURI, filePath) {
        filePath = filePath || "./";
        return new Promise((resolve, reject) => {
            let imageDecoded = decode(dataURI);

            fs.writeFile(filePath, imageDecoded.dataBuffer, err => {
                if (err) {
                    return reject("ImageDataURI :: Error :: " + JSON.stringify(err, null, 4));
                }
                resolve(filePath);
            });
        });
    }

    return {
        decode: decode,
        encode: encode,
        outputFile: outputFile,
    };
})();

module.exports = ImageDataURI;
