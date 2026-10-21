const path=require('path');
const PROJECT='C:\\Users\\Administrator\\Desktop\\Wechat projects\\pension';
const P=require(path.join(PROJECT,'constants','policyData.js'));
const Engine=require(path.join(PROJECT,'calculator','pensionEngine.js'));
function seg(t,a,b,base){return {type:t,startYM:a,endYM:b,baseMonthly:Number(base)};}
function baseInput(extra){
  const segments=[seg('enterprise','1992-10','1992-12',500),seg('enterprise','1993-01','1993-12',600),seg('enterprise','1994-01','1994-12',700),seg('enterprise','1995-01','1995-12',678.67)];
  Object.keys(P.indexDenominatorMonthly).forEach(yy=>{segments.push(seg('enterprise',yy+'-01',yy==='2025'?'2025-09':yy+'-12',P.indexDenominatorMonthly[yy]));});
  const data={gender:'male',femaleType:null,birthYM:'1965-10',workStartYM:'1985-07',retireYM:'2025-10',deemedMonths:null,segments,interestMode:'none',fixedRate:null,fallbackRate:0.0262,accountBalanceManual:null,doc31Eligible:false,doc31TransferYM:null,enterpriseInsuredYM:null,subsidyExcludedRanges:[],baseYearOverride:2025,cPingOverride:null,customCYear:{1992:500,1993:600,1994:700,1995:678.67}};
  return Object.assign(data,extra||{});
}
function seg2003(ratio){const list=[];Object.keys(P.indexDenominatorMonthly).map(Number).filter(y=>y>=2003).forEach(yy=>{const b=Math.round(P.indexDenominatorMonthly[yy]*ratio*100)/100;list.push(seg('enterprise',yy+'-01',yy===2025?'2025-09':yy+'-12',b));});return list;}
const r1=Engine.calculate(baseInput());
console.log('C1',JSON.stringify({total:r1.pension.total,J:r1.pension.J账户,Rbu:r1.intermediates.R补,Rchu:r1.intermediates.R储,applicable:r1.accountSubsidy.applicable,lines:r1.formulaLines.map(f=>f.key+'/'+f.ref)}));
const r2=Engine.calculate(baseInput({doc31Eligible:true,doc31TransferYM:'2003-01',enterpriseInsuredYM:'2003-01',segments:seg2003(1)}));
console.log('C2',JSON.stringify({Rbu:r2.intermediates.R补,Rchu:r2.intermediates.R储,J:r2.pension.J账户,z:r2.accountSubsidy.zRealUsed,months:r2.accountSubsidy.monthCount,tiers:r2.accountSubsidy.tiers.map(t=>[t.rate,t.months,t.bracket]),lines:r2.formulaLines.map(f=>f.key+'/'+f.ref)}));
const probes=[
 ['C4-A retire2030 insured2030',{doc31Eligible:true,doc31TransferYM:'2030-01',enterpriseInsuredYM:'2030-01',segments:[],accountBalanceManual:100000,birthYM:'1970-10',retireYM:'2030-10'}],
 ['C4-B retire2025 insured2030',{doc31Eligible:true,doc31TransferYM:'2030-01',enterpriseInsuredYM:'2030-01',segments:[],accountBalanceManual:100000,birthYM:'1965-10',retireYM:'2025-10'}],
 ['C4-C transfer2030 insured2025',{doc31Eligible:true,doc31TransferYM:'2030-01',enterpriseInsuredYM:'2025-09',segments:[],accountBalanceManual:100000}],
 ['C4-D insured2027 segs2003+',{doc31Eligible:true,doc31TransferYM:'2003-01',enterpriseInsuredYM:'2027-01',segments:seg2003(1)}]
];
for(const [name,extra] of probes){
 try{const r=Engine.calculate(baseInput(extra));
 console.log(name,JSON.stringify({applicable:r.accountSubsidy.applicable,subsidy:r.accountSubsidy.subsidy,Rbu:r.intermediates.R补,missing:r.accountSubsidy.missingYears,reason:r.accountSubsidy.reason,warning:r.accountSubsidy.warning}));}catch(e){console.log(name,'THREW:',e.message.slice(0,200));}
}
