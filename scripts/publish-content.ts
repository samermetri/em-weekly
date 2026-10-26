import {execFileSync} from 'node:child_process';
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
const remote=git('remote','get-url','origin');if(!/^https:\/\/github\.com\/samermetri\/em-weekly(?:\.git)?$/.test(remote))throw Error('Unexpected repository');
if(git('branch','--show-current')!=='main')throw Error('Use a fresh main checkout for publication');
execFileSync('pnpm',['validate'],{stdio:'inherit'});
// Include untracked paths and staged paths; refuse code/config/workflow changes.
const names=[...new Set(execFileSync('git',['status','--porcelain','-z','--untracked-files=all'],{encoding:'utf8'}).split('\0').filter(Boolean).map(x=>x.slice(3)))];
if(names.some(p=>! /^(content\/(articles|issues)\/[a-z0-9-]+\.json|state\/(publishing\.json|audits\/[a-z0-9-]+\.json))$/.test(p)))throw Error('Normal publishing may change content and state only. Review code/config changes separately.');
if(names.length){execFileSync('git',['add','--',...names],{stdio:'inherit'});execFileSync('git',['commit','-m','content: publish verified literature updates'],{stdio:'inherit'});execFileSync('git',['push','origin','HEAD:main'],{stdio:'inherit'});}
// A normal authenticated Git/App push triggers the publishing workflow. If your
// connection uses GITHUB_TOKEN, explicitly dispatch publish.yml; see README.
console.log('Read the matching Actions run and deployed status before claiming success.');
