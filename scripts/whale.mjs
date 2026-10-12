#!/usr/bin/env node
// Portable commands for this fork; no maintainer-specific paths or secrets.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DATA_HOME, readJson } from '../runtime/paths.mjs';
import { launchDesktop, runningService, serviceRequest } from '../runtime/process.mjs';

export function manageLaunchAgent(command, { config, exists = fs.existsSync, run = spawnSync, uid = process.getuid?.() } = {}) {
  if (!config?.enabled || config.platform !== 'darwin') return false;
  if (!/^com\.api-balance-whale\.codex(?:\.[a-z0-9-]+)*$/.test(config.label || '')) throw Error('Invalid whale LaunchAgent label.');
  const domain = 'gui/' + uid, service = domain + '/' + config.label;
  const call = args => run('/bin/launchctl', args, { encoding: 'utf8' });
  const loaded = () => call(['print', service]).status === 0;
  if (command === 'start') {
    if (!loaded()) {
      if (!config.launchAgentPath || !exists(config.launchAgentPath)) throw Error('Whale LaunchAgent is missing; run npm run install:mac first.');
      const result = call(['bootstrap', domain, config.launchAgentPath]);
      if (result.status !== 0 && !loaded()) throw Error('Unable to load the whale LaunchAgent.');
    }
    if (call(['kickstart', service]).status !== 0) throw Error('Unable to start the whale LaunchAgent.');
  } else if (command === 'stop' && loaded()) {
    const result = call(['bootout', service]);
    if (result.status !== 0 && loaded()) throw Error('Unable to stop the whale LaunchAgent.');
  }
  return true;
}

export async function main(command = 'start') {
  if (!['start', 'open', 'stop', 'status'].includes(command)) throw Error('Usage: codex-whale [start|stop|status]');
  if (command === 'open') command = 'start';
  const config = readJson(path.join(DATA_HOME, 'follow-config.json'), {});
  if (process.platform === 'darwin' && command !== 'status') manageLaunchAgent(command, { config });
  if (command === 'start') {
    // An installed supervisor owns startup; never race it with a second process.
    if (process.platform === 'darwin' && config.enabled && config.platform === 'darwin') {
      for (let attempt = 0; attempt < 40; attempt++) {
        if (await runningService(DATA_HOME)) return serviceRequest('/api/show', { method: 'POST', body: {} });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      throw Error('Whale supervisor did not become ready; inspect local logs privately.');
    }
    return launchDesktop();
  }
  if (command === 'stop') {
    if (await runningService(DATA_HOME)) await serviceRequest('/api/stop', { method: 'POST', body: {} });
    return { ok: true, stopped: true };
  }
  if (!await runningService(DATA_HOME)) return { ok: true, running: false };
  const status = await serviceRequest('/api/status');
  return { ok: status.ok !== false, running: true, version: status.version, visible: status.visible, rendererReady: status.rendererReady, desktopMode: status.desktopMode };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2]).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
