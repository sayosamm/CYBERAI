'use strict';
// Reset the demo data store back to the clearly-labeled sample data.
const { loadEnv } = require('../lib/env');
loadEnv();
const store = require('../data/store');
store.reset();
console.log('Onyx AI demo data reset to sample state ->', store.STORE_PATH);
