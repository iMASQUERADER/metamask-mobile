import {
  assertIsSemVerVersion,
  createSnapManifest,
  DEFAULT_REQUESTED_SNAP_VERSION,
  getTargetVersion,
  isValidUrl,
  NpmSnapIdStruct,
  SemVerRange,
  SemVerVersion,
  SnapManifest,
  VirtualFile,
  normalizeRelative,
} from '@metamask/snaps-utils';
import { assert, assertStruct, isObject } from '@metamask/utils';
import concat from 'concat-stream';
import createGunzipStream from 'gunzip-maybe';
import pump from 'pump';
import { ReadableWebToNodeStream } from 'readable-web-to-node-stream';
// eslint-disable-next-line import/no-nodejs-modules
import { Readable, Writable } from 'stream';
import { extract as tarExtract } from 'tar-stream';
import ReadableStream from 'readable-stream';

import { DetectSnapLocationOptions, SnapLocation } from './location';

const DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org';

export interface NpmOptions {
  /**
   * @default DEFAULT_REQUESTED_SNAP_VERSION
   */
  versionRange?: SemVerRange;
  /**
   * Whether to allow custom NPM registries outside of {@link DEFAULT_NPM_REGISTRY}.
   *
   * @default false
   */
  allowCustomRegistries?: boolean;
}

interface NpmMeta {
  registry: string;
  packageName: string;
  requestedRange: SemVerRange;
  version?: string;
  fetch: typeof fetch;
}
export interface NpmOptions {
  /**
   * @default DEFAULT_REQUESTED_SNAP_VERSION
   */
  versionRange?: SemVerRange;
  /**
   * Whether to allow custom NPM registries outside of {@link DEFAULT_NPM_REGISTRY}.
   *
   * @default false
   */
  allowCustomRegistries?: boolean;
}

/* eslint-disable import/prefer-default-export */
import ReactNativeBlobUtil, { FetchBlobResponse } from 'react-native-blob-util';
import Logger from '../../../util/Logger';

const SNAPS_NPM_LOG_TAG = 'Snaps/ NPM';

/**
 * Reads and parses file from ReactNativeBlobUtil response
 * @param path The path to the file to read and parse.
 * @returns The parsed file data.
 */
const readAndParseFile = async (path: string) => {
  try {
    console.log(SNAPS_NPM_LOG_TAG, 'readAndParseFile path', path);
    const data = await ReactNativeBlobUtil.fs.readFile(path, 'base64');
    return data;
  } catch (error) {
    Logger.log(SNAPS_NPM_LOG_TAG, 'readAndParseFile error', error);
  }
};

/**
 * Converts a FetchBlobResponse object to a React Native Response object.
 * @param response The FetchBlobResponse object to convert.
 * @returns A new Response object with the same data as the input object.
 */
const convertFetchBlobResponseToResponse = async (
  fetchBlobResponse: FetchBlobResponse,
): Promise<Response> => {
  const headers = new Headers(fetchBlobResponse.respInfo.headers);
  const status = fetchBlobResponse.respInfo.status;
  const dataPath = fetchBlobResponse.data;
  console.log(
    SNAPS_NPM_LOG_TAG,
    'convertFetchBlobResponseToResponse input',
    fetchBlobResponse,
  );
  const data = await readAndParseFile(dataPath);
  const response = new Response(data, { headers, status });
  return response;
};

const fetchNPMFunction = async (
  inputRequest: RequestInfo,
): Promise<Response> => {
  console.log(SNAPS_NPM_LOG_TAG, 'custom fetchNPMFunction', inputRequest);
  const { config } = ReactNativeBlobUtil;
  const filePath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/archive.tgz`;
  const urlToFetch: string =
    typeof inputRequest === 'string' ? inputRequest : inputRequest.url;
  const response: FetchBlobResponse = await config({
    fileCache: true,
    path: filePath,
  }).fetch('GET', urlToFetch);
  const rsp = await convertFetchBlobResponseToResponse(response);
  console.log(SNAPS_NPM_LOG_TAG, 'fetchFunction response', rsp);
  return rsp;
};

export class NpmLocation implements SnapLocation {
  private readonly meta: NpmMeta;

  private validatedManifest?: VirtualFile<SnapManifest>;

  private files?: Map<string, VirtualFile>;

  constructor(url: URL, opts: DetectSnapLocationOptions = {}) {
    const allowCustomRegistries = opts.allowCustomRegistries ?? false;
    const fetchFunction = opts.fetch ?? globalThis.fetch.bind(globalThis);
    const requestedRange = opts.versionRange ?? DEFAULT_REQUESTED_SNAP_VERSION;

    assertStruct(url.toString(), NpmSnapIdStruct, 'Invalid Snap Id: ');

    let registry: string | URL;
    if (
      url.host === '' &&
      url.port === '' &&
      url.username === '' &&
      url.password === ''
    ) {
      registry = new URL(DEFAULT_NPM_REGISTRY);
    } else {
      registry = 'https://';
      if (url.username) {
        registry += url.username;
        if (url.password) {
          registry += `:${url.password}`;
        }
        registry += '@';
      }
      registry += url.host;
      registry = new URL(registry);
      assert(
        allowCustomRegistries,
        new TypeError(
          `Custom NPM registries are disabled, tried to use "${registry.toString()}".`,
        ),
      );
    }

    assert(
      registry.pathname === '/' &&
        registry.search === '' &&
        registry.hash === '',
    );

    assert(
      url.pathname !== '' && url.pathname !== '/',
      new TypeError('The package name in NPM location is empty.'),
    );
    let packageName = url.pathname;
    if (packageName.startsWith('/')) {
      packageName = packageName.slice(1);
    }

    this.meta = {
      requestedRange,
      registry,
      packageName,
      fetch: fetchFunction,
    };
  }

  async manifest(): Promise<VirtualFile<SnapManifest>> {
    console.log(SNAPS_NPM_LOG_TAG, 'Fetching manifest');
    if (this.validatedManifest) {
      return this.validatedManifest.clone();
    }

    const vfile = await this.fetch('snap.manifest.json');
    const result = JSON.parse(vfile.toString());
    vfile.result = createSnapManifest(result);
    this.validatedManifest = vfile as VirtualFile<SnapManifest>;
    return this.manifest();
  }

  async fetch(path: string): Promise<VirtualFile> {
    console.log(SNAPS_NPM_LOG_TAG, 'fetch called with path: ', path);
    const relativePath = normalizeRelative(path);
    if (!this.files) {
      await this.#lazyInit();
      assert(this.files !== undefined);
    }
    const vfile = this.files.get(relativePath);
    assert(
      vfile !== undefined,
      new TypeError(`File "${path}" not found in package.`),
    );
    return vfile.clone();
  }

  get packageName(): string {
    return this.meta.packageName;
  }

  get version(): string {
    assert(
      this.meta.version !== undefined,
      'Tried to access version without first fetching NPM package.',
    );
    return this.meta.version;
  }

  get registry(): string {
    return this.meta.registry;
  }

  get versionRange(): SemVerRange {
    return this.meta.requestedRange;
  }

  async #lazyInit() {
    console.log(SNAPS_NPM_LOG_TAG, 'lazyInit');
    assert(this.files === undefined);
    const [tarballResponse, actualVersion] = await fetchNpmTarball(
      this.meta.packageName,
      this.meta.requestedRange,
      this.meta.registry,
      this.meta.fetch,
    );
    this.meta.version = actualVersion;

    console.log(SNAPS_NPM_LOG_TAG, 'lazyInit tarball', tarballResponse);

    let canonicalBase = 'npm://';
    if (this.meta.registry.username !== '') {
      canonicalBase += this.meta.registry.username;
      if (this.meta.registry.password !== '') {
        canonicalBase += `:${this.meta.registry.password}`;
      }
      canonicalBase += '@';
    }
    canonicalBase += this.meta.registry.host;

    // TODO(ritave): Lazily extract files instead of up-front extracting all of them
    //               We would need to replace tar-stream package because it requires immediate consumption of streams.
    await new Promise<void>((resolve, reject) => {
      console.log(SNAPS_NPM_LOG_TAG, 'lazyInit new promise');
      this.files = new Map();
      pump(
        getNodeStream(tarballResponse),
        // The "gz" in "tgz" stands for "gzip". The tarball needs to be decompressed
        // before we can actually grab any files from it.
        createGunzipStream(),
        createTarballStream(
          `${canonicalBase}/${this.meta.packageName}/`,
          this.files,
        ),
        (error) => {
          error ? reject(error) : resolve();
        },
      );
      console.log(SNAPS_NPM_LOG_TAG, 'lazyInit finished pump');
    });
  }
}

/**
 * Fetches the tarball (`.tgz` file) of the specified package and version from
 * the public npm registry. Throws an error if fetching fails.
 *
 * @param packageName - The name of the package whose tarball to fetch.
 * @param versionRange - The SemVer range of the package to fetch. The highest
 * version satisfying the range will be fetched.
 * @param registryUrl - The URL of the npm registry to fetch the tarball from.
 * @param fetchFunction - The fetch function to use. Defaults to the global
 * {@link fetch}. Useful for Node.js compatibility.
 * @returns A tuple of the {@link Response} for the package tarball and the
 * actual version of the package.
 */
async function fetchNpmTarball(
  packageName: string,
  versionRange: SemVerRange,
  registryUrl: string,
  fetchFunction: typeof fetch,
): Promise<[ReadableStream, SemVerVersion]> {
  console.log(
    SNAPS_NPM_LOG_TAG,
    'fetchNpmTarball called with packageName: ',
    packageName,
    registryUrl,
  );
  const urlToFetch = new URL(packageName, registryUrl).toString();
  const packageMetadata = await (await fetchFunction(urlToFetch)).json();

  if (!isObject(packageMetadata)) {
    throw new Error(
      `Failed to fetch package "${packageName}" metadata from npm.`,
    );
  }
  const versions = Object.keys((packageMetadata as any)?.versions ?? {}).map(
    (version) => {
      assertIsSemVerVersion(version);
      return version;
    },
  );

  console.log(SNAPS_NPM_LOG_TAG, 'fetchNpmTarball versions:', versions);

  const targetVersion = getTargetVersion(versions, versionRange);
  console.log(
    SNAPS_NPM_LOG_TAG,
    'fetchNpmTarball targetVersions:',
    targetVersion,
  );

  if (targetVersion === null) {
    throw new Error(
      `Failed to find a matching version in npm metadata for package "${packageName}" and requested semver range "${versionRange}".`,
    );
  }

  const tarballUrlString = (packageMetadata as any)?.versions?.[targetVersion]
    ?.dist?.tarball;

  console.log(
    SNAPS_NPM_LOG_TAG,
    'fetchNpmTarball tarballUrlString:',
    tarballUrlString,
  );

  if (
    !isValidUrl(tarballUrlString) ||
    !tarballUrlString.toString().endsWith('.tgz')
  ) {
    throw new Error(
      `Failed to find valid tarball URL in NPM metadata for package "${packageName}".`,
    );
  }

  // Override the tarball hostname/protocol with registryUrl hostname/protocol
  const newRegistryUrl = new URL(registryUrl);
  const newTarballUrl = new URL(tarballUrlString.toString());
  newTarballUrl.hostname = newRegistryUrl.hostname;
  newTarballUrl.protocol = newRegistryUrl.protocol;

  // Perform a raw fetch because we want the Response object itself.
  const tarballResponse = await fetchNPMFunction(newTarballUrl.toString());
  console.log(
    SNAPS_NPM_LOG_TAG,
    'fetchNpmTarball tarballResponse:',
    tarballResponse,
  );
  const tarBallBody = await tarballResponse;
  if (!tarballResponse.ok || !tarBallBody) {
    console.log(SNAPS_NPM_LOG_TAG, 'fetchNpmTarball error');
    throw new Error(`Failed to fetch tarball for package "${packageName}".`);
  }
  console.log(
    SNAPS_NPM_LOG_TAG,
    'fetchNpmTarball return with tarBallBody',
    tarBallBody,
    targetVersion,
  );
  return [tarBallBody, targetVersion];
}

/**
 * The paths of files within npm tarballs appear to always be prefixed with
 * "package/".
 */
const NPM_TARBALL_PATH_PREFIX = /^package\//u;

/**
 * Converts a {@link ReadableStream} to a Node.js {@link Readable}
 * stream. Returns the stream directly if it is already a Node.js stream.
 * We can't use the native Web {@link ReadableStream} directly because the
 * other stream libraries we use expect Node.js streams.
 *
 * @param stream - The stream to convert.
 * @returns The given stream as a Node.js Readable stream.
 */
function getNodeStream(stream: ReadableStream): Readable {
  console.log(SNAPS_NPM_LOG_TAG, 'getNodeStream called');
  if (typeof stream.getReader !== 'function') {
    return stream as unknown as Readable;
  }

  return new ReadableWebToNodeStream(stream);
}

/**
 * Creates a `tar-stream` that will get the necessary files from an npm Snap
 * package tarball (`.tgz` file).
 *
 * @param canonicalBase - A base URI as specified in {@link https://github.com/MetaMask/SIPs/blob/main/SIPS/sip-8.md SIP-8}. Starting with 'npm:'. Will be used for canonicalPath vfile argument.
 * @param files - An object to write target file contents to.
 * @returns The {@link Writable} tarball extraction stream.
 */
function createTarballStream(
  canonicalBase: string,
  files: Map<string, VirtualFile>,
): Writable {
  assert(
    canonicalBase.endsWith('/'),
    "Base needs to end with '/' for relative paths to be added as children instead of siblings.",
  );

  assert(
    canonicalBase.startsWith('npm:'),
    'Protocol mismatch, expected "npm:".',
  );
  // `tar-stream` is pretty old-school, so we create it first and then
  // instrument it by adding event listeners.
  const extractStream = tarExtract();

  console.log(
    SNAPS_NPM_LOG_TAG,
    'createTarballStream called with',
    canonicalBase,
    files,
  );

  // "entry" is fired for every discreet entity in the tarball. This includes
  // files and folders.
  extractStream.on('entry', (header, entryStream, next) => {
    const { name: headerName, type: headerType } = header;
    if (headerType === 'file') {
      // The name is a path if the header type is "file".
      const path = headerName.replace(NPM_TARBALL_PATH_PREFIX, '');
      return entryStream.pipe(
        concat((data) => {
          const vfile = new VirtualFile({
            value: data,
            path,
            data: {
              canonicalPath: new URL(path, canonicalBase).toString(),
            },
          });
          assert(
            !files.has(path),
            'Malformed tarball, multiple files with the same path.',
          );
          files.set(path, vfile);
          return next();
        }),
      );
    }

    // If we get here, the entry is not a file, and we want to ignore. The entry
    // stream must be drained, or the extractStream will stop reading. This is
    // effectively a no-op for the current entry.
    entryStream.on('end', () => next());
    return entryStream.resume();
  });
  return extractStream;
}
