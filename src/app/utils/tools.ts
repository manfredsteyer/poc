import {
  FederationInfo,
  ImportMap,
  SharedInfo,
} from '@angular-architects/native-federation';

export function appendImportMap(importMap: ImportMap) {
  document.head.appendChild(
    Object.assign(document.createElement('script'), {
      type: 'importmap-shim',
      innerHTML: JSON.stringify(importMap),
    })
  );
}

export type Remote = FederationInfo & {
  baseUrl: string;
};

export const nfNamespace = '__NATIVE_FEDERATION__';

export type NfCache = {
  externals: Map<string, string>;
  remoteNamesToRemote: Map<string, Remote>;
  baseUrlToRemoteNames: Map<string, string>;
};

export type Global = {
  [nfNamespace]: NfCache;
};

const global = globalThis as unknown as Global;

global[nfNamespace] ??= {
  externals: new Map<string, string>(),
  remoteNamesToRemote: new Map<string, Remote>(),
  baseUrlToRemoteNames: new Map<string, string>(),
};

export const globalCache = global[nfNamespace];

const externals = globalCache.externals;

function getExternalKey(shared: SharedInfo) {
  return `${shared.packageName}@${shared.version}`;
}

export function getExternalUrl(shared: SharedInfo): string | undefined {
  const packageKey = getExternalKey(shared);
  return externals.get(packageKey);
}

export function setExternalUrl(shared: SharedInfo, url: string): void {
  const packageKey = getExternalKey(shared);
  externals.set(packageKey, url);
}

export function getDirectory(url: string) {
  const parts = url.split('/');
  parts.pop();
  return parts.join('/');
}

export function joinPaths(path1: string, path2: string): string {
  while (path1.endsWith('/')) {
    path1 = path1.substring(0, path1.length - 1);
  }
  if (path2.startsWith('./')) {
    path2 = path2.substring(2, path2.length);
  }

  return `${path1}/${path2}`;
}

const remoteNamesToRemote = globalCache.remoteNamesToRemote;
const baseUrlToRemoteNames = globalCache.baseUrlToRemoteNames;

export function addRemote(remoteName: string, remote: Remote): void {
  remoteNamesToRemote.set(remoteName, remote);
  baseUrlToRemoteNames.set(remote.baseUrl, remoteName);
}

export function getRemoteNameByBaseUrl(baseUrl: string): string | undefined {
  return baseUrlToRemoteNames.get(baseUrl);
}

export function isRemoteInitialized(baseUrl: string): boolean {
  return baseUrlToRemoteNames.has(baseUrl);
}

export function getRemote(remoteName: string): Remote | undefined {
  return remoteNamesToRemote.get(remoteName);
}

export function hasRemote(remoteName: string): boolean {
  return remoteNamesToRemote.has(remoteName);
}
