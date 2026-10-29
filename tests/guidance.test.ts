import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paragraphs} from '../src/lib/paragraphs';
import {isGuidance} from '../src/lib/guidance';
test('editorial paragraphs keep long guidance readable without interpreting markup',()=>{
 assert.deepEqual(paragraphs(' First paragraph\ncontinued. \n\n Second paragraph.\n \n <script>plain text</script> '),['First paragraph\ncontinued.','Second paragraph.','<script>plain text</script>']);
 assert.deepEqual(paragraphs('  '),[]);
});
test('guidance detail applies to guidelines, consensus statements and guidance sections',()=>{
 assert.equal(isGuidance({studyType:'Guideline',section:'Worth Knowing'}),true);
 assert.equal(isGuidance({studyType:'Consensus statement',section:'Worth Knowing'}),true);
 assert.equal(isGuidance({studyType:'Review',section:'Guidelines & Statements'}),true);
 assert.equal(isGuidance({studyType:'Randomized trial',section:'Worth Knowing'}),false);
});
