const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else {
      if (file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

// Helper to calculate fluid clamp
function makeClamp(pxValue, isText = false) {
  if (pxValue <= 1) return `${pxValue}px`; // Don't scale 1px borders or 0

  let minPx;
  if (isText) {
    // For text, don't go below 9px
    minPx = Math.max(9, Math.floor(pxValue * 0.75));
  } else {
    minPx = Math.floor(pxValue * 0.75);
  }

  const cqw = (pxValue / 4.2).toFixed(2).replace(/\.?0+$/, '');
  return `clamp(${minPx}px,${cqw}cqw,${pxValue}px)`;
}

const prefixes = ['w', 'h', 'p', 'px', 'py', 'pt', 'pb', 'pl', 'pr', 'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr', 'gap', 'gap-x', 'gap-y', 'rounded', 'border'];

function processToken(token) {
  // Strip responsive variants
  const parts = token.split(':');
  const baseToken = parts[parts.length - 1];
  const prefixVariants = parts.slice(0, -1).join(':');
  const prefixStr = prefixVariants ? `${prefixVariants}:` : '';

  // 1. Check for arbitrary px values e.g., w-[18px], text-[11px]
  const arbMatch = baseToken.match(/^([a-z-]+)-\[(\d+)px\]$/);
  if (arbMatch) {
    const prop = arbMatch[1];
    const px = parseInt(arbMatch[2], 10);
    if (px <= 1) return token; // Don't scale 1px

    if (prop === 'text') {
      return `${prefixStr}text-[${makeClamp(px, true)}]`;
    } else if (prefixes.includes(prop)) {
      return `${prefixStr}${prop}-[${makeClamp(px)}]`;
    }
  }

  return token;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Find all className="..." or className={`...`}
  const classRegex = /className=(["'])(.*?)\1|className=\{`(.*?)`\}/gs;

  content = content.replace(classRegex, (match, quote, str1, str2) => {
    const isTemplate = !quote;
    const str = isTemplate ? str2 : str1;

    let resultStr = '';
    let currentToken = '';
    let depthBracket = 0;
    let depthBrace = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '[') depthBracket++;
      else if (char === ']') depthBracket--;
      else if (char === '{') depthBrace++;
      else if (char === '}') depthBrace--;

      if (char.match(/\s/) && depthBracket === 0 && depthBrace === 0) {
        if (currentToken) {
          resultStr += processToken(currentToken);
          currentToken = '';
        }
        resultStr += char;
      } else {
        currentToken += char;
      }
    }
    if (currentToken) {
      resultStr += processToken(currentToken);
    }

    if (isTemplate) {
      return `className={\`${resultStr}\`}`;
    } else {
      return `className=${quote}${resultStr}${quote}`;
    }
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

const files = [
  ...getFiles('src/催眠APP前端/ui/hypnosis'),
  ...getFiles('src/催眠APP前端/ui/home'),
  ...getFiles('src/催眠APP前端/ui/shared'),
  'src/催眠APP前端/App.tsx'
];

for (const file of files) {
  processFile(file);
}