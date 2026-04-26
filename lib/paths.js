import os from 'node:os';
import path from 'node:path';

export const HOME = os.homedir();
export const CLAUDE_DIR = path.join(HOME, '.claude');
export const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
export const AGENTLIGHTS_DIR = path.join(CLAUDE_DIR, 'agentlights');
export const SCRIPT_PATH = path.join(AGENTLIGHTS_DIR, 'colorize.sh');
