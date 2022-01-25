"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const uuid_1 = require("uuid");
const checkTrailingSlash = (path) => !path.endsWith('/') ? path + '/' : path;
exports.default = (options, middleWare) => {
    const S3_BUCKET = options.bucket;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const getFileKeyDir = options.getFileKeyDir || ((req) => '');
    if (!S3_BUCKET)
        throw new Error('S3_BUCKET is required');
    let getS3 = options.getS3;
    if (!getS3) {
        const s3Options = {};
        if (options.region)
            s3Options.region = options.region;
        if (options.signatureVersion)
            s3Options.signatureVersion = options.signatureVersion;
        getS3 = () => new aws_sdk_1.default.S3(s3Options);
    }
    if (options.uniquePrefix === undefined)
        options.uniquePrefix = true;
    const router = express_1.default.Router();
    const tempRedirect = (req, res) => {
        const params = {
            Bucked: S3_BUCKET,
            Key: checkTrailingSlash(getFileKeyDir(req)) + req.params[0]
        };
        const s3 = (!!getS3 && getS3());
        s3.getSignedUrl('getObject', params, (err, url) => {
            res.redirect(url);
        });
    };
    router.get(/\/img\/(.*)/, ...(middleWare || []), (req, res) => tempRedirect(req, res));
    router.get(/\/uploads\/(.*)/, ...(middleWare || []), (req, res) => tempRedirect(req, res));
    router.get('/sign', ...(middleWare || []), (req, res) => {
        const filename = (req.query.path || '') + (options.uniquePrefix
            ? (0, uuid_1.v4)() + '_' : '') + req.query.objectName;
        const mimeType = req.query.contentType;
        const fileKey = checkTrailingSlash(getFileKeyDir(req)) + filename;
        if (options.headers)
            res.set(options.headers);
        const s3 = (!!getS3 && getS3());
        const params = {
            Bucked: S3_BUCKET,
            Key: fileKey,
            Expires: options.signatureExpires || 60,
            ContentType: mimeType,
            ACL: options.ACL || 'private',
        };
        s3.getSignedUrl('putObject', params, (err, data) => {
            if (err)
                return res.status(500).send('Cannot create S3 signed URL');
            res.json({
                signedUrl: data,
                publicUrl: '/s3/uploads/' + filename,
                filename,
                fileKey,
            });
        });
    });
    return router;
};
