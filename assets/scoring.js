(function(global){
  'use strict';

  var cachedRules=null;

  function normalize(value){
    return String(value||'')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .trim();
  }

  function safeNumber(value){
    var num=Number(value);
    return Number.isFinite(num)?num:0;
  }

  function resolveScore(fieldRules,rawValue){
    if(!fieldRules||typeof fieldRules!=='object') return 0;
    var value=normalize(rawValue);
    if(!value) return safeNumber(fieldRules.default);
    var direct=fieldRules[rawValue];
    if(direct!==undefined) return safeNumber(direct);
    var keys=Object.keys(fieldRules);
    for(var i=0;i<keys.length;i++){
      if(normalize(keys[i])===value){
        return safeNumber(fieldRules[keys[i]]);
      }
    }
    return safeNumber(fieldRules.default);
  }

  function resolveBucket(score,buckets){
    if(!Array.isArray(buckets)||!buckets.length){
      return {name:'lead normal',priority:'media',min:0};
    }
    var ordered=buckets.slice().sort(function(a,b){return safeNumber(a.min)-safeNumber(b.min);});
    var current=ordered[0];
    for(var i=0;i<ordered.length;i++){
      if(score>=safeNumber(ordered[i].min)){
        current=ordered[i];
      }
    }
    return current;
  }

  async function loadRules(path){
    var url=path||'/data/scoring-rules.json';
    var response=await fetch(url,{cache:'no-store'});
    if(!response.ok){
      throw new Error('No se pudo cargar scoring-rules.json');
    }
    cachedRules=await response.json();
    return cachedRules;
  }

  function scoreLead(leadData,rules){
    var activeRules=rules||cachedRules||{fields:{},buckets:[]};
    var fields=activeRules.fields||{};
    var breakdown={};
    var total=0;

    Object.keys(fields).forEach(function(field){
      var value=leadData&&leadData[field]!==undefined?leadData[field]:'';
      var points=resolveScore(fields[field],value);
      breakdown[field]=points;
      total+=points;
    });

    var bucket=resolveBucket(total,activeRules.buckets);
    return {
      score:total,
      priority:bucket.priority||'media',
      bucket:bucket.name||'lead normal',
      breakdown:breakdown
    };
  }

  global.LeadScoring={
    loadRules:loadRules,
    scoreLead:scoreLead
  };
})(window);
