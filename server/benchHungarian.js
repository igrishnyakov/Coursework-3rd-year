const { performance } = require('perf_hooks');
const { hungarian }  = require('./utils/suggestBuilder');

// --- CLI: node benchHungarian.js 3000 500 200
const sizes = process.argv.slice(2).map(Number);
if (!sizes.length) sizes.push(3000, 500);          // по умолчанию два случая

function randomMatrix(n) {
  return Array.from({ length: n }, () =>
           Array.from({ length: n }, () => Math.floor(Math.random() * 100)));
}

for (const N of sizes) {
  global.gc?.();                                   // очистим хип (если запущено с --expose-gc)
  const cost = randomMatrix(N);

  const t0 = performance.now();
  hungarian(cost);
  const t1 = performance.now();

  const mem = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`N=${N.toString().padStart(4)}  `
            + `time=${((t1 - t0) / 1000).toFixed(2)} s  `
            + `heap≈${mem.toFixed(0)} MB`);
}