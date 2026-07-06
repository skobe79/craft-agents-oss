const fs = require('fs');
const path = require('path');

const dir = '.';

function walk(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'bun.lock' || file === 'bun.lockb' || file === 'dist' || file === 'release' || file === '.next' || file === 'replace.js') continue;
    
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      walk(fullPath);
    } else {
      const ext = path.extname(fullPath);
      if (['.ts', '.tsx', '.json', '.yml', '.yaml', '.md', '.sh', '.cjs', '.mjs', '.ps1'].includes(ext)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let originalContent = content;
        
        // Apply replacements in order from most specific to least
        content = content.replace(/craftagents:\/\//g, 'archagentz://');
        content = content.replace(/@craft-agent\//g, '@arch-agentz/');
        content = content.replace(/craft-agent/g, 'arch-agentz');
        content = content.replace(/CRAFT_/g, 'ARCH_');
        content = content.replace(/Craft Agents/g, 'ARCH Agentz OS');
        
        if (content !== originalContent) {
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`Updated: ${fullPath}`);
        }
      }
    }
  }
}

walk(dir);
console.log('Replacement complete.');
