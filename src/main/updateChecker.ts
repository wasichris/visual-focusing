import { net } from 'electron';
import { logger } from './logger';

interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseUrl: string;
}

const GITHUB_REPO = 'wasichris/visual-focusing';
const RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const RELEASE_URL = `https://github.com/${GITHUB_REPO}/releases`;
const TIMEOUT_MS = 8000;

export async function checkForUpdates(
  currentVersion: string
): Promise<UpdateInfo> {
  const result: UpdateInfo = {
    hasUpdate: false,
    latestVersion: currentVersion,
    currentVersion,
    releaseUrl: RELEASE_URL,
  };

  try {
    const data = await fetchWithTimeout(RELEASE_API, TIMEOUT_MS);
    const json = JSON.parse(data);
    const latestTag = (json.tag_name || '').replace(/^v/, '');

    if (latestTag && isNewerVersion(latestTag, currentVersion)) {
      result.hasUpdate = true;
      result.latestVersion = latestTag;
      result.releaseUrl = json.html_url || RELEASE_URL;
      logger.info(`發現新版本: v${latestTag}（目前: v${currentVersion}）`);
    }
  } catch {
    // 無網路或 API 失敗，靜默跳過
    logger.debug('更新檢查跳過（無網路或 API 錯誤）');
  }

  return result;
}

function isNewerVersion(latest: string, current: string): boolean {
  const l = latest.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

function fetchWithTimeout(url: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);

    const request = net.request(url);
    let body = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        body += chunk.toString();
      });
      response.on('end', () => {
        clearTimeout(timer);
        resolve(body);
      });
    });

    request.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    request.end();
  });
}
