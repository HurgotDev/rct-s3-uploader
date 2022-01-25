import { S3 } from 'aws-sdk'

export type TOptions = {
	bucket: string;
	region?: string;
	signatureVersion?: string;
	signatureExpires?: number;
	uniquePrefix?: boolean;
	headers?: { [k: string]: string };
	ACL?: string;
	getFileKeyDir?: (req: Request) => string;
	getS3?: () => S3;
}

export type Ts3Options = {
	region?: string;
	signatureVersion?: string;
}

export type THeader = { [k: string]: any };

export type TSignReturn = {
	signedUrl: string;
	headers: THeader;
	publicUrl: string;
}

export type TMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type TCreateCorsOptions = {
	withCredentials?: boolean
}


export type TDisposition = 'auto' | string

export type TS3UploadOptions = {
	server?: string;
	signingUrl?: string;
	signingUrlMethod?: TMethod;
	successResponses?: number[];
	fileElement?: HTMLInputElement;
	files?: File[] | null;
	s3path: string;
	signingUrlWithCredentials?: boolean;
	contentDisposition?: TDisposition;
	uploadRequestHeaders?: THeader;
	preprocess?: (file: File, cb: (f: File) => void) => any;
	onProgress?: (percent: number, status: string, file: File) => void;
	onFinishS3Put?: (signResult: TSignReturn, file: File) => void;
	onError?: (status: string, file: File, other?: any) => any;
	signingUrlQueryParams?: (() => object) | object;
	signingUrlHeaders?: (() => object) | object = {};
	getSignedUrl?: ((file: File, cb: (...args: any[]) => any) => any) | undefined;
	scrubFilename?: (filename: string) => string
}