import test from 'node:test';
import assert from 'node:assert/strict';
import { GazeDwell } from '../src/gaze.js';

test('gaze activates exactly once after continuous dwell',()=>{
  const gaze=new GazeDwell(1.4);let triggers=0;
  for(let i=0;i<100;i++){const result=gaze.update('take',.1);if(i<13)assert.equal(result.triggered,false);if(result.triggered)triggers++;}
  assert.equal(triggers,1);assert.equal(gaze.update('take',.1).progress,1);
});
test('brief tracking jitter does not release a latched button',()=>{
  const gaze=new GazeDwell(.8);gaze.latch('take');gaze.update(null,.05);
  for(let i=0;i<25;i++)assert.equal(gaze.update('take',.1).triggered,false);
});
test('look away for release delay permits another deliberate press',()=>{
  const gaze=new GazeDwell(.8);gaze.latch('take');gaze.update(null,.1);gaze.update(null,.1);let fired=false;
  for(let i=0;i<8;i++)fired=gaze.update('take',.1).triggered;assert.equal(fired,true);
});
test('changing the target starts a new full dwell',()=>{
  const gaze=new GazeDwell(.8);for(let i=0;i<7;i++)gaze.update('a',.1);
  assert.equal(gaze.update('b',.1).triggered,false);for(let i=0;i<6;i++)assert.equal(gaze.update('b',.1).triggered,false);
  assert.equal(gaze.update('b',.1).triggered,true);
});
test('disabled gaze and reset cancel a pending activation',()=>{
  const gaze=new GazeDwell(.8);for(let i=0;i<7;i++)gaze.update('a',.1);
  assert.deepEqual(gaze.update('a',.1,false),{progress:0,triggered:false});assert.equal(gaze.update('a',.1).triggered,false);gaze.reset();assert.equal(gaze.key,null);
});
test('malformed or large frame deltas cannot instantly select',()=>{
  const gaze=new GazeDwell(.8);assert.equal(gaze.update('a',100).triggered,false);assert.equal(gaze.update('a',NaN).triggered,false);assert.equal(gaze.update('a',-1).triggered,false);
  assert.ok(gaze.elapsed<=.1);
});
