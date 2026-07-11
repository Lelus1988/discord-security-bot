const RESET  = '\x1b[0m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const CYAN   = '\x1b[36m';
const GRAY   = '\x1b[90m';

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

export const logger = {
  info:  (msg: string) => console.log(`${GRAY}[${timestamp()}]${RESET} ${GREEN}[INFO]${RESET}  ${msg}`),
  warn:  (msg: string) => console.warn(`${GRAY}[${timestamp()}]${RESET} ${YELLOW}[WARN]${RESET}  ${msg}`),
  error: (msg: string) => console.error(`${GRAY}[${timestamp()}]${RESET} ${RED}[ERROR]${RESET} ${msg}`),
  debug: (msg: string) => console.log(`${GRAY}[${timestamp()}]${RESET} ${CYAN}[DEBUG]${RESET} ${msg}`),
  security: (msg: string) => console.log(`${GRAY}[${timestamp()}]${RESET} ${RED}[SEC]${RESET}   ${msg}`),
};
