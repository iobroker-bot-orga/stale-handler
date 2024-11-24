#!/usr/bin/env node
'use strict';

const {parseArgs} = require('node:util');
//const axios = require('axios');

//const common = require('./lib/commonTools.js');
const github = require('./lib/githubTools.js');
const iobroker = require('./lib/iobrokerTools.js');

const opts = {
    cleanup: false,
    dry: false,
    debug: false,
}

const unstaleUsers = [
    'ioBroker-Bot',
    'Apollon77',
    'mcm1957'
];

const UNSTALE_TEXT = '**This issue should not be considered stale.**\nPlease process and close it if completed.';

const context = {};
const summary = [];

function debug(text) {
    if (opts.debug) {
        console.log(`[DEBUG] ${text}`);
    }
}

async function commentIssue(context, number) {
    debug(`commentIssue()`);

    let comments = await github.getAllComments(context.owner, `ioBroker.${context.adapter}`, number);
    comments = comments || [];
    debug(`comments of issue ${number}`);
    debug(JSON.stringify(comments));
    comments = comments.filter( c => c.body === UNSTALE_TEXT );

    if (comments.length) {
        debug( 'existing comment detected - will try to delete');
        for (const comment of comments) {
            try {
                if (!opts.dry) await github.deleteComment(context.owner, `ioBroker.${context.adapter}`, comment.id, true);
                console.log (`[INFO] comment deleted`);
            } catch {
                console.log (`[INFO] deleting of comment failed`);
            }
        }
    } else {
        debug( 'NO existing comments detected');
    };

    if (!opts.dry) await github.addComment(context.owner, `ioBroker.${context.adapter}`, number, UNSTALE_TEXT);
    console.log (`[INFO] new comment added`);

}

async function checkRepository(context) {
    debug(`checkRepository()`);

    // retrieve and filter issues
    let issues = await github.getAllIssues(`${context.owner}`, `ioBroker.${context.adapter}`);
    if (!issues) issues = [];

    issues = issues.filter(i => i.state === 'open');

    debug( `Open issues of adapter ${context.adapter}`);
    debug (JSON.stringify( issues ));

    issues = issues.filter(i => {
        for (const label of i.labels) {if (label.name === 'stale') return true;}
        return false;
    });

    for (const issue of issues) {
        console.log (`[INFO] Issue ${issue.number} created by ${issue.user?.login} ("${issue.title}") is marked as stale`);
    }

    issues = issues.filter(i => unstaleUsers.includes(i.user?.login));

    debug( `filtered issues of adapter ${context.adapter}`);
    debug (JSON.stringify( issues ));

    for (const issue of issues) {
        summary.push (`${context.owner}/ioBroker.${context.adapter} - ${issue.number}/${issue.user?.login} (${issue.title})`);
    }

    for (const issue of issues) {
        await commentIssue (context, issue.number);
    }
}

async function main() {
    const options = {
        'dry': {
            type: 'boolean',
        },
        'debug': {
            type: 'boolean',
            short: 'd',
        },
    };

    const {
        values,
        positionals,
    } = parseArgs({ options, strict:true, allowPositionals:true,  });

    //console.log(values, positionals);

    opts.dry = values['dry'];
    opts.debug = values['debug'];

    const latestRepo = await iobroker.getLatestRepoLive();
    const total = Object.keys(latestRepo).length;

    // context.owner = 'mcm4iob';
    // context.adapter = 'nsclient';

    // await checkRepository(context);

    // return;

    if (opts.dry) console.log('[DRY] This run will not change any issues as --dry was specified.\n')

    let curr = 0;
    for (const adapter in latestRepo) {

        curr = curr + 1;
        if (adapter.startsWith('_')) continue;

        debug (`processing ${latestRepo[adapter].meta}`);

        const parts = latestRepo[adapter].meta.split('/');
        const owner = parts[3];
        console.log(`\n[INFO] processing ${owner}/ioBroker.${adapter} (${curr}/${total})`);

        context.owner = owner;
        context.adapter = adapter;

        await checkRepository(context);
    };

    console.log ('\n\nSummary of stale issues processed:');
    console.log (summary.join('\n'));
    console.log(``);
    if (opts.dry) console.log('[DRY] This run dir not change any isses as --dry was specified.\n')
    console.log(`[INFO] task completed`);
}

process.env.OWN_GITHUB_TOKEN = process.env.IOBBOT_GITHUB_TOKEN;
main();
