export const SOURCES = [
  {id:'a',name:'Input A',color:'#4ca6e2'},
  {id:'b',name:'Input B',color:'#7c79d8'},
  {id:'break',name:'Break',color:'#e7a05a'},
  {id:'rescue',name:'Rescue',color:'#64b3a3'}
];
export const CONTROLS = [
  {id:'inputA',label:'INPUT A'}, {id:'inputB',label:'INPUT B'},
  {id:'takeLive',label:'TAKE LIVE'}, {id:'adBreak',label:'AD BREAK'},
  {id:'returnLive',label:'RETURN LIVE'}, {id:'off',label:'TURN OFF LIVE'}
];
export function createModel(){
  const state={selected:'a',liveInput:'a',output:'rescue',mode:'off',elapsed:0,since:0,message:'Ready. Select an input, then TAKE LIVE.'};
  const listeners=new Set();
  function dispatch(action){
    let ok=true,message='';
    switch(action){
      case 'inputA':case 'inputB':state.selected=action==='inputA'?'a':'b';message=`${state.selected==='a'?'Input A':'Input B'} selected. Channel unchanged until TAKE LIVE.`;break;
      case 'takeLive':state.liveInput=state.selected;state.output=state.selected;state.mode='live';state.since=state.elapsed;message=`${state.selected==='a'?'Input A':'Input B'} is live.`;break;
      case 'adBreak':
        if(state.mode!=='live'){ok=false;message='TAKE LIVE before starting an ad break.';break;}
        state.output='break';state.mode='break';state.since=state.elapsed;message='Ad break on air. RETURN LIVE resumes the last live input.';break;
      case 'returnLive':
        if(state.mode!=='break'){ok=false;message='RETURN LIVE is available during an ad break.';break;}
        state.output=state.liveInput;state.mode='live';state.since=state.elapsed;message=`Returned to ${state.liveInput==='a'?'Input A':'Input B'}.`;break;
      case 'off':state.output='rescue';state.mode='off';state.since=state.elapsed;message='Live turned off. Rescue is on the channel.';break;
      default:ok=false;message='Unknown control.';
    }
    state.message=message;
    for(const listener of listeners)listener(state,{action,ok});
    return {ok,message};
  }
  return {state,dispatch,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},tick(dt){if(Number.isFinite(dt)&&dt>0)state.elapsed+=Math.min(dt,1);}};
}
