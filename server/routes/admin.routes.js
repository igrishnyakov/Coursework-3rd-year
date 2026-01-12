const Router = require('express');
const router  = new Router();
const { buildClusters } = require('../utils/clusterBuilder');
const { buildScores }   = require('../utils/scoreBuilder');
const { runSuggest }    = require('../utils/suggestBuilder');

function safe(fn) {
    return async (req,res) => {
        try {
            await fn(req,res);
        }
        catch(err){
            console.error('[admin]', err);
            res.status(500).json({ error: err.message });
        }
    };
}

router.post('/recalc/clusters', safe(async (_req,res) => {
  const r = await buildClusters();
  res.json(r);
}));

router.post('/recalc/scores', safe(async (_req,res) => {
  const r = await buildScores();
  res.json(r);
}));

router.post('/recalc/suggests', safe(async (_req,res) => {
  await runSuggest();
  res.json({ok:true});
}));

router.post('/recalc/all', safe(async (_req,res) => {
  const c = await buildClusters();
  const s = await buildScores();
  await runSuggest();
  res.json({ clusters:c.updated, scores:s.updated });
}));

module.exports = router;