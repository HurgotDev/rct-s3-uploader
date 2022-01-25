import { TCreateCorsOptions, TDisposition, THeader, TMethod, TS3UploadOptions, TSignReturn } from "./types"
import * as mime from 'mime-types'

export default class S3Upload {

  server = ''
  signingUrl = '/sign-s3'
  signingUrlMethod = 'GET'
  successResponses = [200, 2001]
  fileElement: HTMLInputElement | null = null
  files: File[] | null = null
  s3path: string
  signingUrlWithCredentials = false
  contentDisposition = '';
  uploadRequestHeaders: any;
  httpRequest: XMLHttpRequest | null = null;
  signingUrlQueryParams: (() => object) | object = {}
  signingUrlHeaders: (() => object) | object = {}
  getSignedUrl: ((file: File, cb: (...args: any[]) => any) => any) | undefined;

  constructor(options: TS3UploadOptions) {
    this.s3path = options.s3path

    if (options.server) this.server = options.server
    if (options.signingUrl) this.signingUrl = options.signingUrl
    if (options.signingUrlMethod) this.signingUrlMethod = options.signingUrlMethod
    if (options.successResponses) this.successResponses = options.successResponses
    if (options.files) this.files = options.files
    if (options.fileElement) this.fileElement = options.fileElement
    if (options.signingUrlWithCredentials) this.signingUrlWithCredentials = options.signingUrlWithCredentials
    if (options.contentDisposition) this.contentDisposition = options.contentDisposition
    if (options.uploadRequestHeaders) this.uploadRequestHeaders = options.uploadRequestHeaders
    if (options.preprocess) this.preprocess = options.preprocess
    if (options.onProgress) this.onProgress = options.onProgress
    if (options.onFinishS3Put) this.onFinishS3Put = options.onFinishS3Put
    if (options.onError) this.onError = options.onError
    if (options.scrubFilename) this.scrubFilename = options.scrubFilename
    if (options.signingUrlQueryParams) this.signingUrlQueryParams = options.signingUrlQueryParams
    if (options.signingUrlHeaders) this.signingUrlHeaders = options.signingUrlHeaders
    if (options.getSignedUrl) this.getSignedUrl = options.getSignedUrl

    const files = this.fileElement ? (this.fileElement.files as unknown as File[]) : this.files || []
    this.handleFileSelect(files)
  }

  onFinishS3Put(signResult: TSignReturn, file: File) {
    return console.log('base.onFinishS3Put()', signResult.publicUrl);
  };

  preprocess(file: File, next: (f: File) => any) {
    console.log('base.preprocess()', file);
    return next(file);
  };


  onProgress(percent: number, status: string, file: File) {
    return console.log('base.onProgress()', percent, status);
  };

  onError(status: string, file: File, other?: any) {
    return console.log('base.onError()', status);
  }

  onSignedUrl(result: any) {

  }

  scrubFilename(filename: string) {
    return filename.replace(/[^\w\d_\-\.]+/ig, '');
  };


  private createCORSRequest(method: string, url: string, opts: TCreateCorsOptions = {}) {
    let xhr = new XMLHttpRequest();

    xhr.open(method, url, true)
    xhr.withCredentials = !!opts.withCredentials

    return xhr
  }

  private getFileMimeType(f: File) {
    return f.type || mime.lookup(f.name);
  }

  private handleFileSelect(files: File[]) {
    const result: any = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.preprocess(file, (processedFile: any) => {
        this.onProgress(0, 'Waiting', processedFile);
        result.push(this.uploadFile(processedFile));
        return result;
      });
    }
  };

  private getErrorRequestContext(xhr: XMLHttpRequest) {
    return {
      response: xhr.responseText,
      status: xhr.status,
      statusText: xhr.statusText,
      readyState: xhr.readyState
    };
  }


  private executeOnSignedUrl(file: File, callback: (...args: any[]) => void) {
    const fileName = this.scrubFilename(file.name);
    let queryString = `?objectName=${fileName}&contentType=${encodeURIComponent(this.getFileMimeType(file))}`;

    if (this.s3path) queryString += `&path=${encodeURIComponent(this.s3path)}`;
    if (this.signingUrlQueryParams) {
      let signingUrlQueryParams = typeof this.signingUrlQueryParams === 'function'
        ? this.signingUrlQueryParams()
        : this.signingUrlQueryParams;
      Object.keys(signingUrlQueryParams).forEach(key => {
        const val = signingUrlQueryParams[key];
        queryString += '&' + key + '=' + val;
      });
    }
    const xhr = this.createCORSRequest(
      this.signingUrlMethod,
      this.server + this.signingUrl + queryString,
      { withCredentials: this.signingUrlWithCredentials }
    );

    if (this.signingUrlHeaders) {
      const signingUrlHeaders = typeof this.signingUrlHeaders === 'function'
        ? this.signingUrlHeaders()
        : this.signingUrlHeaders;
      Object.keys(signingUrlHeaders).forEach(function (key) {
        const val = signingUrlHeaders[key];
        xhr.setRequestHeader(key, val);
      });
    }
    xhr.overrideMimeType && xhr.overrideMimeType('text/plain; charset=x-user-defined');
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && this.successResponses.indexOf(xhr.status) >= 0) {
        let result;
        try {
          result = JSON.parse(xhr.responseText);
          this.onSignedUrl(result);
        } catch (error) {
          this.onError(
            'Invalid response from server',
            file,
            this.getErrorRequestContext(xhr)
          );
          return false;
        }
        return callback(result);
      } else if (xhr.readyState === 4 && this.successResponses.indexOf(xhr.status) < 0) {
        return this.onError(
          'Could not contact request signing server. Status = ' + xhr.status,
          file,
          this.getErrorRequestContext(xhr)
        );
      }
    }
    return xhr.send();
  }

  uploadToS3(file: File, signResult: TSignReturn) {
    const xhr = this.createCORSRequest('PUT', signResult.signedUrl)

    if (!xhr) this.onError('CORS not supported', file)
    else {
      xhr.onload = () => {
        if (this.successResponses.indexOf(xhr.status) >= 0) {
          this.onProgress(100, 'Upload completed', file)
          return this.onFinishS3Put(signResult, file)
        } else return this.onError(
          `Upload error: ${xhr.status}`,
          file,
          this.getErrorRequestContext(xhr)
        )
      }

      xhr.onerror = () => {
        return this.onError(
          'XHR error',
          file,
          this.getErrorRequestContext(xhr)
        )
      }

      xhr.upload.onprogress = (e: ProgressEvent<EventTarget>) => {
        let percentLoaded
        if (e.lengthComputable) {
          percentLoaded = Math.round((e.loaded / e.total) * 100)
          return this.onProgress(
            percentLoaded, percentLoaded === 100
            ? 'Finalizing'
            : 'Uploading',
            file
          )
        }
      }
    }

    const fileType = this.getFileMimeType(file)
    const headers: THeader = {
      'content-type': fileType
    }

    if (this.contentDisposition) {
      let disposition = this.contentDisposition
      if (disposition === 'auto') {
        if (typeof fileType === 'string' && fileType.substring(0, 6) === 'image/') disposition = 'inline'
        else disposition = 'attachment'
      }

      const fileName = this.scrubFilename(file.name)
      headers['content-disposition'] = `${disposition}; filename="${fileName}"`
    }

    if (!this.uploadRequestHeaders) xhr?.setRequestHeader('x-amz-acl', 'public-read');

    [signResult.headers, this.uploadRequestHeaders].filter(Boolean).forEach(hdrs => {
      Object.entries(hdrs).forEach(pair => {
        headers[pair[0].toLocaleLowerCase()] = pair[1]
      })
    })
    Object.entries(headers).forEach(pair => {
      xhr.setRequestHeader(pair[0], pair[1] as string)
    })
    this.httpRequest = xhr
    return xhr?.send(file)
  }

  private uploadFile(file: File) {
    const uploadToS3Callback = this.uploadToS3.bind(this, file)

    if (this.getSignedUrl) return this.getSignedUrl(file, uploadToS3Callback)
    return this.executeOnSignedUrl(file, uploadToS3Callback)
  }

  abortUpload() {
    this.httpRequest && this.httpRequest.abort()
  }
}