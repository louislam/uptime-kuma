/*
    From https://github.com/DiegoZoracKy/image-data-uri/blob/master/lib/image-data-uri.js
    Modified with 0 dependencies
 */
let fs = require("fs");
const { log } = require("../src/util");

let ImageDataURI = (() => {

    /**
     * Decode the data:image/ URI
     * @param {string} dataURI data:image/ URI to decode
     * @returns {?object} An object with properties "imageType" and "dataBase64".
     * The former is the image type, e.g., "png", and the latter is a base64
     * encoded string of the image's binary data. If it fails to parse, returns
     * null instead of an object.
     */
    function decode(dataURI) {
        if (!/data:image\//.test(dataURI)) {
            log.error("image-data-uri", "It seems that it is not an Image Data URI. Couldn't match \"data:image/\"");
            return null;
        }

        let regExMatches = dataURI.match("data:(image/.*);base64,(.*)");
        return {
            imageType: regExMatches[1],
            dataBase64: regExMatches[2],
            dataBuffer: new Buffer(regExMatches[2], "base64")
        };
    }

    /**
     * Endcode an image into data:image/ URI
     * @param {(Buffer|string)} data Data to encode
     * @param {string} mediaType Media type of data
     * @returns {(string|null)} A string representing the base64-encoded
     * version of the given Buffer object or null if an error occurred.
     */
    function encode(data, mediaType) {
        if (!data || !mediaType) {
            log.error("image-data-uri", "Missing some of the required params: data, mediaType");
            return null;
        }

        mediaType = (/\//.test(mediaType)) ? mediaType : "image/" + mediaType;
        let dataBase64 = (Buffer.isBuffer(data)) ? data.toString("base64") : new Buffer(data).toString("base64");
        let dataImgBase64 = "data:" + mediaType + ";base64," + dataBase64;

        return dataImgBase64;
    }

    /**
     * Write data URI to file
     * @param {string} dataURI data:image/ URI
     * @param {string} filePath Path to write file to
     * @returns {Promise<string|void>} Write file error
     */
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
