function extended(source){
 return source.replace('ICALL, IRET, IPUSHQ, IPOPQ};','ICALL, IRET, IPUSHQ, IPOPQ, IIADDQ};')
 .replace('IOPQ, IPUSHQ, IPOPQ};','IOPQ, IPUSHQ, IPOPQ, IIADDQ};')
 .replace('IMRMOVQ, IJXX, ICALL};','IMRMOVQ, IJXX, ICALL, IIADDQ};')
 .replace('IRMMOVQ, IMRMOVQ, IOPQ}: D_rB','IRMMOVQ, IMRMOVQ, IOPQ, IIADDQ}: D_rB')
 .replace('IRRMOVQ, IIRMOVQ, IOPQ}: D_rB','IRRMOVQ, IIRMOVQ, IOPQ, IIADDQ}: D_rB')
 .replace('IIRMOVQ, IRMMOVQ, IMRMOVQ}: E_valC','IIRMOVQ, IRMMOVQ, IMRMOVQ, IIADDQ}: E_valC')
 .replace('IRMMOVQ, IMRMOVQ, IOPQ, ICALL, IRET, IPUSHQ, IPOPQ}: E_valB','IRMMOVQ, IMRMOVQ, IOPQ, ICALL, IRET, IPUSHQ, IPOPQ, IIADDQ}: E_valB')
 .replace('E_icode == IOPQ &&','E_icode in {IOPQ, IIADDQ} &&');
}
module.exports={extended};
