import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {publicationSource,approvedSource} from '../src/lib/source-policy';
import {articleSchema} from '../src/lib/schema';
import {weeklyItems} from '../src/lib/publishing';
const base=articleSchema.parse(JSON.parse(fs.readFileSync('content/articles/preoxi.json','utf8')));
const hosts=['doi.org','pubmed.ncbi.nlm.nih.gov','www.aap.org'];
test('source approval rejects lookalike hosts, insecure URLs and credentials',()=>{
 assert(approvedSource('https://www.aap.org/ImmunizationSchedule',hosts));
 for(const url of ['https://doi.org.attacker.test/paper','https://attackerdoi.org/paper','http://doi.org/paper','https://user:secret@doi.org/paper'])assert(!approvedSource(url,hosts));
});
test('unknown primary host uses recorded DOI or PMID without changing evidence or the original',()=>{
 const original={...base,canonicalUrl:'https://unreviewed.test/paper',officialPdfUrl:'https://unreviewed.test/file.pdf'};
 const result=publicationSource(original,hosts);
 assert.equal(result.article.canonicalUrl,`https://doi.org/${base.doi}`);
 assert.equal(result.article.officialPdfUrl,null);
 assert.equal(result.article.humanReview,original.humanReview);
 assert.equal(result.article.summary,original.summary);
 assert.equal(original.canonicalUrl,'https://unreviewed.test/paper');
 assert.equal(publicationSource({...original,doi:null},hosts).article.canonicalUrl,`https://pubmed.ncbi.nlm.nih.gov/${base.pmid}/`);
});
test('one unusable source is withheld while other articles remain eligible for a weekly digest',()=>{
 const good={...base,sample:false,firstOnlineDate:'2026-10-20'};
 const bad={...good,id:'bad-source',doi:null,pmid:null,canonicalUrl:'https://unreviewed.test/paper'};
 const results=[good,bad].map(a=>publicationSource(a,hosts));
 assert.equal(results[1].article.status,'held');
 assert(results[1].notice?.includes('withheld'));
 assert.equal(bad.status,'published');
 assert.deepEqual(weeklyItems({sample:false,coverageStart:'2026-10-19',coverageEnd:'2026-10-25',items:[]},results.map(r=>r.article)).map(a=>a.articleId),[good.id]);
});
