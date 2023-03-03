import {
  SemVerRange,
  SnapManifest,
  VirtualFile,
  NpmSnapFileNames,
  LOCALHOST_HOSTNAMES,
  assertIsSnapManifest,
  validateSnapShasum,
} from '@metamask/snaps-utils';
import RNFetchBlob, { FetchBlobResponse } from 'rn-fetch-blob';

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

type DetectSnapLocationOptions = NpmOptions & {
  /**
   * The function used to fetch data.
   *
   * @default globalThis.fetch
   */
  fetch?: typeof fetch;
  /**
   * @default false
   */
  allowHttp?: boolean;
};

export interface SnapLocation {
  /**
   * All files are relative to the manifest, except the manifest itself.
   */
  manifest(): Promise<VirtualFile<SnapManifest>>;
  fetch(path: string): Promise<VirtualFile>;

  readonly shouldAlwaysReload?: boolean;
}

interface FetchSnapResult {
  /**
   * The manifest of the fetched Snap.
   */
  manifest: SnapManifest;

  /**
   * The source code of the fetched Snap.
   */
  sourceCode: string;

  /**
   * The raw XML content of the Snap's SVG icon, if any.
   */
  svgIcon?: string;
}

const SNAPS_LOCATION_LOG_TAG = 'snaps/ location';

/**
 * Converts a FetchBlobResponse object to a React Native Response object.
 * @param response The FetchBlobResponse object to convert.
 * @returns A new Response object with the same data as the input object.
 */
const convertFetchBlobResponseToResponse = (
  response: FetchBlobResponse,
): Response => {
  const headers = new Headers(response.respInfo.headers);
  const status = response.respInfo.status;
  const body = response.data;

  return new Response(body, { headers, status });
};

export const fetchFunction = async (inputURL: URL): Promise<Response> => {
  console.log(SNAPS_LOCATION_LOG_TAG, 'fetchFunction called with ', inputURL);
  const { config } = RNFetchBlob;
  const response: FetchBlobResponse = await config({ fileCache: true }).fetch(
    'GET',
    inputURL.href,
  );
  console.log(
    SNAPS_LOCATION_LOG_TAG,
    'fetchFunction fetched response ',
    response,
  );

  return convertFetchBlobResponseToResponse(response);
};

/**
 * Fetches the manifest and source code of a local snap.
 *
 * @param localhostUrl - The localhost URL to download from.
 * @returns The validated manifest and the source code.
 */
const fetchLocalSnap = async (
  localhostUrl: string,
): Promise<FetchSnapResult> => {
  // Local snaps are mostly used for development purposes. Fetches were cached in the browser and were not requested
  // afterwards which lead to confusing development where old versions of snaps were installed.
  // Thus we disable caching
  //   const fetchOptions: RequestInit = { cache: 'no-cache' };
  const manifestUrl = new URL(NpmSnapFileNames.Manifest, localhostUrl);
  //   if (!LOCALHOST_HOSTNAMES.has(manifestUrl.hostname)) {
  //     throw new Error(
  //       `Invalid URL: Locally hosted Snaps must be hosted on localhost. Received URL: "${manifestUrl.toString()}"`,
  //     );
  //   }

  const manifest = await (await fetchFunction(manifestUrl)).json();
  assertIsSnapManifest(manifest);

  const {
    source: {
      location: {
        npm: { filePath, iconPath },
      },
    },
  } = manifest;

  const [sourceCode, svgIcon] = await Promise.all([
    (await fetchFunction(new URL(filePath, localhostUrl))).text(),
    iconPath
      ? (await fetchFunction(new URL(iconPath, localhostUrl))).text()
      : undefined,
  ]);

  validateSnapShasum(manifest, sourceCode);
  return { manifest, sourceCode, svgIcon };
};

// export async function detectSnapLocation(
//   location: string | URL,
//   opts?: DetectSnapLocationOptions,
// ): SnapLocation {
//   const location = await fetchLocalSnap(location);
//   return location;
// }
