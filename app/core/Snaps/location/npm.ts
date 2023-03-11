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

import { DetectSnapLocationOptions, SnapLocation } from './location';
import { zip, unzip, unzipAssets, subscribe } from 'react-native-zip-archive';
import { NativeModules } from 'react-native';
const { RNTar } = NativeModules;

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

const SNAPS_NPM_LOG_TAG = 'snaps/ NPM';

/**
 * Reads and parses file from ReactNativeBlobUtil response
 * @param path The path to the file to read and parse.
 * @returns The parsed file data.
 */

const decompressFile = async (
  path: string,
  targetPath: string,
): Promise<string> => {
  try {
    console.log(
      SNAPS_NPM_LOG_TAG,
      'decompressFile called with',
      path,
      targetPath,
    );
    const unzippedPath = await unzip(
      '/Users/owencraston/Documents/package.zip',
      targetPath,
    );
    console.log(SNAPS_NPM_LOG_TAG, 'decompressFile unzippedPath', unzippedPath);
    return unzippedPath;
  } catch (error) {
    Logger.log(SNAPS_NPM_LOG_TAG, 'decompressFile error', error);
    throw new Error(`decompressFile error: ${error}`);
  }
};

const baseFilePath = '/Users/owencraston/Documents/package 2';
const readAndParseSourceCode = async (path: string) => {
  try {
    console.log(
      SNAPS_NPM_LOG_TAG,
      'readAndParseSourceCode called with path',
      path,
    );
    const sourceCodePath = '/package/dist/bundle.js';

    const targetPath = ReactNativeBlobUtil.fs.dirs.DocumentDir;
    const unzippedPath = await decompressFile(path, targetPath);
    const data = await ReactNativeBlobUtil.fs.readFile(
      `${unzippedPath}${sourceCodePath}`,
      'utf8',
    );
    console.log(SNAPS_NPM_LOG_TAG, 'readAndParseSourceCode data', data);
    return data;
  } catch (error) {
    Logger.log(SNAPS_NPM_LOG_TAG, 'readAndParseFile error', error);
  }
};

const readAndParseManifest = async (path: string) => {
  try {
    console.log(SNAPS_NPM_LOG_TAG, 'readAndParseManifest path', path);
    const goodFilePath = `${baseFilePath}/snap.manifest.json`;
    const data = await ReactNativeBlobUtil.fs.readFile(goodFilePath, 'utf8');
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
  const data = await readAndParseSourceCode(dataPath);
  const response = new Response(data, { headers, status });
  return response;
};

const fetchNPMFunction = async (
  inputRequest: RequestInfo,
): Promise<Response> => {
  const val = await RNTar.unTar('test/path');
  console.log(SNAPS_NPM_LOG_TAG, 'native module call', val);
  console.log(SNAPS_NPM_LOG_TAG, 'custom fetchNPMFunction', inputRequest);
  const { config } = ReactNativeBlobUtil;
  const filePath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/archive.zip`;
  const urlToFetch: string =
    typeof inputRequest === 'string' ? inputRequest : inputRequest.url;
  const response: FetchBlobResponse = await config({
    fileCache: true,
    path: filePath,
  }).fetch('GET', urlToFetch);
  const rsp = await convertFetchBlobResponseToResponse(response);
  return rsp;
};

/**
 * The paths of files within npm tarballs appear to always be prefixed with
 * "package/".
 */

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
      registry: registry.toString(),
      packageName,
      fetch: fetchFunction,
    };
  }

  async manifest(): Promise<VirtualFile<SnapManifest>> {
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
      console.log(SNAPS_NPM_LOG_TAG, 'setting files');
      await this.#lazyInit();
      assert(this.files !== undefined);
      console.log(SNAPS_NPM_LOG_TAG, 'files set with sourceCode');
    }
    console.log(SNAPS_NPM_LOG_TAG, 'files set');
    const vfile = this.files.get(relativePath);
    assert(
      vfile !== undefined,
      new TypeError(`File "${path}" not found in package.`),
    );
    console.log(SNAPS_NPM_LOG_TAG, 'init done', this.files);
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
    const [sourceCode, actualVersion] = await fetchNpmTarball(
      this.meta.packageName,
      this.meta.requestedRange,
      this.meta.registry,
      this.meta.fetch,
    );
    this.meta.version = actualVersion;

    let canonicalBase = 'npm://';
    if (this.meta.registry.username !== '') {
      canonicalBase += this.meta.registry.username;
      if (this.meta.registry.password !== '') {
        canonicalBase += `:${this.meta.registry.password}`;
      }
      canonicalBase += '@';
    }
    canonicalBase += this.meta.registry.host;

    console.log(SNAPS_NPM_LOG_TAG, 'canonicalBase', canonicalBase);

    const manifestContent = await readAndParseManifest('snap.manifest.json');
    const manifest = JSON.parse(manifestContent);
    const manifestVFile = new VirtualFile<SnapManifest>({
      value: manifestContent.toString(),
      result: createSnapManifest(manifest),
      path: 'snap.manifest.json',
      data: {
        canonicalPath: `${canonicalBase}snap.manifest.json`,
      },
    });

    console.log(SNAPS_NPM_LOG_TAG, 'lazyint manifest good');

    const sourceCodeVFile = new VirtualFile({
      value: sourceCode,
      path: 'dist/bundle.js',
      data: { canonicalPath: canonicalBase },
    });

    this.files = new Map<string, VirtualFile>();
    this.files.set('snap.manifest.json', manifestVFile);
    this.files.set('dist/bundle.js', sourceCodeVFile);
    console.log(SNAPS_NPM_LOG_TAG, 'lazyint manifest good');
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
): Promise<[string, SemVerVersion]> {
  console.log(
    SNAPS_NPM_LOG_TAG,
    'fetchNpmTarball called with packageName: ',
    packageName,
    registryUrl,
    versionRange,
  );
  const urlToFetch = new URL(packageName, registryUrl).toString();
  const packageMetadata = await (await fetchFunction(urlToFetch)).json();

  if (!isObject(packageMetadata)) {
    console.log(
      SNAPS_NPM_LOG_TAG,
      'fetchNpmTarball packageMetadata check failed',
    );
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
  const sourceCode = await tarballResponse.text();
  if (!tarballResponse.ok || !sourceCode) {
    console.log(SNAPS_NPM_LOG_TAG, 'fetchNpmTarball error');
    throw new Error(`Failed to fetch tarball for package "${packageName}".`);
  }
  console.log(SNAPS_NPM_LOG_TAG, 'fetchNpmTarball return');
  return [sourceCode, targetVersion];
}
