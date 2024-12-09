import {
  FederationInfo,
  ImportMap,
  Imports,
  mergeImportMaps,
  Scopes,
  SharedInfo,
} from '@angular-architects/native-federation';
import {
  addRemote,
  appendImportMap,
  getDirectory,
  getExternalUrl,
  joinPaths,
  setExternalUrl,
} from './tools';

export type InitFederationOptions = {
  cdnPattern?: string;
};

export async function initFederation(
  remotesOrManifestUrl: Record<string, string> | string = {},
  options?: InitFederationOptions
): Promise<ImportMap> {
  options = options ?? {};

  const remotes =
    typeof remotesOrManifestUrl === 'string'
      ? await loadManifest(remotesOrManifestUrl)
      : remotesOrManifestUrl;

  const hostInfo = await loadFederationInfo('./remoteEntry.json');
  const hostImportMap = await processHostInfo(hostInfo, './', options);
  const remotesImportMap = await processRemoteInfos(remotes, {
    ...options,
    throwIfRemoteNotFound: false,
  });

  const importMap = mergeImportMaps(hostImportMap, remotesImportMap);
  appendImportMap(importMap);

  return importMap;
}

async function loadManifest(remotes: string): Promise<Record<string, string>> {
  return (await fetch(remotes).then((r) => r.json())) as Record<string, string>;
}

export async function processRemoteInfos(
  remotes: Record<string, string>,
  options: InitFederationOptions & { throwIfRemoteNotFound: boolean } = {
    throwIfRemoteNotFound: false,
  }
): Promise<ImportMap> {
  const processRemoteInfoPromises = Object.keys(remotes).map(
    async (remoteName) => {
      try {
        const url = remotes[remoteName];
        return await processRemoteInfo(url, {
          ...options,
          remoteName,
        });
      } catch (e) {
        const error = `Error loading remote entry for ${remoteName} from file ${remotes[remoteName]}`;

        if (options.throwIfRemoteNotFound) {
          throw new Error(error);
        }

        console.error(error);
        return null;
      }
    }
  );

  const remoteImportMaps = await Promise.all(processRemoteInfoPromises);

  const importMap = remoteImportMaps.reduce<ImportMap>(
    (acc, remoteImportMap) =>
      remoteImportMap ? mergeImportMaps(acc, remoteImportMap) : acc,
    { imports: {}, scopes: {} }
  );

  return importMap;
}

export async function processRemoteInfo(
  federationInfoUrl: string,
  options?: InitFederationOptions & {
    remoteName?: string;
  }
): Promise<ImportMap> {
  const baseUrl = getDirectory(federationInfoUrl);
  const remoteInfo = await loadFederationInfo(federationInfoUrl);

  const remoteName = options?.remoteName ?? remoteInfo.name;

  const importMap = createRemoteImportMap(
    remoteInfo,
    remoteName,
    baseUrl,
    options
  );
  addRemote(remoteName, { ...remoteInfo, baseUrl });

  return importMap;
}

function createRemoteImportMap(
  remoteInfo: FederationInfo,
  remoteName: string,
  baseUrl: string,
  options?: InitFederationOptions
): ImportMap {
  const imports = processExposed(remoteInfo, remoteName, baseUrl);
  const scopes = processRemoteImports(remoteInfo, baseUrl, options);
  return { imports, scopes };
}

async function loadFederationInfo(url: string): Promise<FederationInfo> {
  const info = (await fetch(url).then((r) => r.json())) as FederationInfo;
  return info;
}

function processRemoteImports(
  remoteInfo: FederationInfo,
  baseUrl: string,
  options?: InitFederationOptions
): Scopes {
  const scopes: Scopes = {};
  const scopedImports: Imports = {};

  for (const shared of remoteInfo.shared) {
    let outFileName = '';

    if (options?.cdnPattern) {
      outFileName = applyCdnPattern(options.cdnPattern, shared)
    } else {
      outFileName =
        getExternalUrl(shared) ?? joinPaths(baseUrl, shared.outFileName);
      setExternalUrl(shared, outFileName);
    }

    scopedImports[shared.packageName] = outFileName;
  }

  scopes[baseUrl + '/'] = scopedImports;
  return scopes;
}

function processExposed(
  remoteInfo: FederationInfo,
  remoteName: string,
  baseUrl: string
): Imports {
  const imports: Imports = {};

  for (const exposed of remoteInfo.exposes) {
    const key = joinPaths(remoteName, exposed.key);
    const value = joinPaths(baseUrl, exposed.outFileName);
    imports[key] = value;
  }

  return imports;
}

export async function processHostInfo(
  hostInfo: FederationInfo,
  relBundlesPath = './',
  options: InitFederationOptions
): Promise<ImportMap> {
  const imports = hostInfo.shared.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.packageName]:
        options.cdnPattern && cur.version
          ? applyCdnPattern(options.cdnPattern, cur)
          : relBundlesPath + cur.outFileName,
    }),
    {}
  ) as Imports;

  for (const shared of hostInfo.shared) {
    setExternalUrl(shared, relBundlesPath + shared.outFileName);
  }
  return { imports, scopes: {} };
}

function applyCdnPattern(cdnPattern: string, shared: SharedInfo) {
  return cdnPattern
    .replace('{package}', shared.packageName)
    .replace('{version}', shared.version ?? '');
}
