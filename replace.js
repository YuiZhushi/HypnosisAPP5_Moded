const fs = require('fs');
const path = require('path');

const replacements = [
  [/px-3 md:px-5/g, 'px-[clamp(12px,4.8cqw,20px)]'],
  [/px-3 md:px-4/g, 'px-[clamp(12px,3.8cqw,16px)]'],
  [/px-3 md:px-3\.5/g, 'px-[clamp(12px,3.3cqw,14px)]'],
  [/px-2\.5 md:px-3\.5/g, 'px-[clamp(10px,3.3cqw,14px)]'],
  [/px-2\.5 md:px-3/g, 'px-[clamp(10px,2.9cqw,12px)]'],
  [/px-2 md:px-2\.5/g, 'px-[clamp(8px,2.4cqw,10px)]'],
  [/px-1\.5 md:px-2\.5/g, 'px-[clamp(6px,2.4cqw,10px)]'],
  [/px-1\.5 md:px-2/g, 'px-[clamp(6px,1.9cqw,8px)]'],

  [/py-3 md:py-4/g, 'py-[clamp(12px,3.8cqw,16px)]'],
  [/py-2 md:py-3/g, 'py-[clamp(8px,2.9cqw,12px)]'],
  [/py-2 md:py-2\.5/g, 'py-[clamp(8px,2.4cqw,10px)]'],
  [/py-1\.5 md:py-2/g, 'py-[clamp(6px,1.9cqw,8px)]'],
  [/py-1 md:py-1\.5/g, 'py-[clamp(4px,1.4cqw,6px)]'],
  [/py-0\.5 md:py-1/g, 'py-[clamp(2px,1cqw,4px)]'],
  [/py-6 md:py-8/g, 'py-[clamp(24px,7.6cqw,32px)]'],

  [/pt-3 md:pt-4/g, 'pt-[clamp(12px,3.8cqw,16px)]'],
  [/pt-2 md:pt-2\.5/g, 'pt-[clamp(8px,2.4cqw,10px)]'],
  [/pt-1\.5 md:pt-2/g, 'pt-[clamp(6px,1.9cqw,8px)]'],

  [/pb-20 md:pb-24/g, 'pb-[clamp(80px,22.8cqw,96px)]'],
  [/pb-3 md:pb-5\.5/g, 'pb-[clamp(12px,5.2cqw,22px)]'],
  [/pb-3 md:pb-4/g, 'pb-[clamp(12px,3.8cqw,16px)]'],
  [/pb-2\.5 md:pb-3/g, 'pb-[clamp(10px,2.9cqw,12px)]'],

  [/mb-3 md:mb-4/g, 'mb-[clamp(12px,3.8cqw,16px)]'],
  [/mb-2\.5 md:mb-3/g, 'mb-[clamp(10px,2.9cqw,12px)]'],
  [/mb-2 md:mb-2\.5/g, 'mb-[clamp(8px,2.4cqw,10px)]'],
  [/mb-1\.5 md:mb-2/g, 'mb-[clamp(6px,1.9cqw,8px)]'],
  [/mb-1 md:mb-1\.5/g, 'mb-[clamp(4px,1.4cqw,6px)]'],

  [/mt-2 md:mt-2\.5/g, 'mt-[clamp(8px,2.4cqw,10px)]'],
  [/mt-1\.5 md:mt-2/g, 'mt-[clamp(6px,1.9cqw,8px)]'],
  [/mt-1 md:mt-1\.5/g, 'mt-[clamp(4px,1.4cqw,6px)]'],

  [/gap-3 md:gap-4/g, 'gap-[clamp(12px,3.8cqw,16px)]'],
  [/gap-2\.5 md:gap-3/g, 'gap-[clamp(10px,2.9cqw,12px)]'],
  [/gap-2 md:gap-2\.5/g, 'gap-[clamp(8px,2.4cqw,10px)]'],
  [/gap-1\.5 md:gap-2/g, 'gap-[clamp(6px,1.9cqw,8px)]'],
  [/gap-1 md:gap-1\.5/g, 'gap-[clamp(4px,1.4cqw,6px)]'],
  [/gap-x-3 md:gap-x-4/g, 'gap-x-[clamp(12px,3.8cqw,16px)]'],

  [/pl-4 md:pl-5/g, 'pl-[clamp(16px,4.8cqw,20px)]'],

  [/text-\[14px\] md:text-base/g, 'text-[clamp(14px,3.8cqw,16px)]'],
  [/text-\[14px\] md:text-\[16px\]/g, 'text-[clamp(14px,3.8cqw,16px)]'],
  [/text-\[14px\] md:text-\[15px\]/g, 'text-[clamp(14px,3.8cqw,15px)]'],
  [/text-xs md:text-sm/g, 'text-[clamp(12px,3.3cqw,14px)]'],
  [/text-\[11px\] md:text-\[13px\]/g, 'text-[clamp(11px,3.1cqw,13px)]'],
  [/text-\[11px\] md:text-xs/g, 'text-[clamp(11px,2.9cqw,12px)]'],
  [/text-\[10px\] md:text-\[11px\]/g, 'text-[clamp(10px,2.6cqw,11px)]'],
  [/text-\[9px\] md:text-\[10px\]/g, 'text-[clamp(9px,2.4cqw,10px)]'],

  [/w-10 md:w-11/g, 'w-[clamp(40px,10.5cqw,44px)]'],
  [/h-5 md:h-6/g, 'h-[clamp(20px,5.7cqw,24px)]'],
  [/w-7 md:w-8/g, 'w-[clamp(28px,7.6cqw,32px)]'],
  [/h-\[26px\] md:h-\[32px\]/g, 'h-[clamp(26px,7.6cqw,32px)]'],
  [/w-\[16px\] h-\[16px\] md:w-\[18px\] md:h-\[18px\]/g, 'w-[clamp(16px,4.3cqw,18px)] h-[clamp(16px,4.3cqw,18px)]'],
  [/w-\[10px\] h-\[10px\] md:w-\[12px\] md:h-\[12px\]/g, 'w-[clamp(10px,2.9cqw,12px)] h-[clamp(10px,2.9cqw,12px)]'],
  [/w-4 h-4 md:w-5 md:h-5/g, 'w-[clamp(16px,4.8cqw,20px)] h-[clamp(16px,4.8cqw,20px)]'],
];

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

const files = [
  ...getFiles('src/催眠APP前端/ui/hypnosis'),
  ...getFiles('src/催眠APP前端/ui/home'),
  ...getFiles('src/催眠APP前端/ui/shared')
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
