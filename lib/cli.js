#!/usr/bin/env node

'use strict';

var program = require('commander'),
    config = require('../package.json'),
    homesync = require('./homesync'),
    Promise = require('bluebird'),
    folder;

function reportSuccess() {
    console.log('Success: files linked to home directory.');
}

program
    .version(config.version)
    .usage('<folder>')
    .parse(process.argv);

folder = program.args[0];

if (!folder) {
    throw new Error('No folder specified');
} else {
    Promise.try(homesync.bind(null, folder))
        .then(reportSuccess)
        .done();
}
