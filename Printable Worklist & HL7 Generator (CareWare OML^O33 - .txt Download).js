// ==UserScript==
// @name         Printable Worklist & HL7 Generator (CareWare OML^O33 - .txt Download)
// @namespace    http://tampermonkey.net/
// @version      8.36
// @updateURL    https://raw.githubusercontent.com/3soob/kaauh_lab_script/main/Printable%20Worklist%20%26%20HL7%20Generator%20%28CareWare%20OML%5EO33%20-%20.txt%20Download%29.js
// @downloadURL  https://raw.githubusercontent.com/3soob/kaauh_lab_script/main/Printable%20Worklist%20%26%20HL7%20Generator%20%28CareWare%20OML%5EO33%20-%20.txt%20Download%29.js
// @description  Generates strict CareWare ADM OML^O33 HL7 (.txt) using cleaned raw test names, prints a worklist, and adds a mapped New HL7 button with per-test routing between Alinity/VIDAPTOR and CareWare/ADM
// @author       Hamad
// @match        https://his.kaauh.org/lab/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // 1. Comprehensive CentraLink Analyzer Test Mappings (Used for Worklist Printout & Standard HL7)
    const rawTestList = [
        "3Gen TSH", "A/G", "A1AG", "A1AT", "A1MIC", "AAT", "aBC", "ACET", "ACP", "ACT", "ACTM", "ACTMN", "AFP",
        "AGS", "AGU", "aHAVM", "aHAVT", "aHBcM", "aHBcT", "aHBe", "aHBs", "aHBs2", "aHCV", "ALB", "ALP", "ALP-A",
        "ALP-D", "ALSCRN", "ALTI", "AMIK", "AMON", "AMPH1000", "AMPH300", "AMPH500", "AMY", "AP", "APC-R", "APO-A",
        "APO-A1", "APO-B", "APTT", "AS", "ASL", "ASO", "AST", "ATA", "aTG", "ATIII", "aTPO", "B2M", "B2MIC", "B2S",
        "BARB", "BcM", "BENZ", "BHCG", "BMG", "BNP", "BP3", "BR", "BUN", "C3", "C4", "CA", "CA 125", "CA 125II",
        "CA 125ll", "CA 15-3", "CA 19-9", "CA 72-4", "CA125", "CA15-3", "CA153", "CA19-9", "CA199", "CA72-4", "CAL",
        "CARB", "CEA", "CER", "CHE", "CHIV", "CHOL", "CK", "CKMB", "CKMB_Old", "CKNAC", "CL", "CL S", "CMB", "CMM", "CMVG",
        "CO2", "CO2_L", "COC150", "COC300", "Conf", "COR", "CorrelatedCA", "CpS", "cPSA", "CRBM", "CREA", "CREAT",
        "CRP", "CSA", "CSAE", "CT", "CTGC", "CTNI", "cTnI", "CVG", "CYSC", "D LDL", "D-Di", "DBIL", "DDI", "DDimer",
        "DGNA", "DGTN", "DGTX", "DHEAS", "DIG", "E26", "E26 111", "E26III", "ECP", "eE2", "eE2_Old", "EHIV", "EPN",
        "EST", "ETOH", "EXT300", "EXT500", "Factor II", "Factor IX", "Factor V", "Factor VII", "Factor VIII", "Factor X",
        "Factor XI", "Factor XII", "Fer", "FERR_Old", "Fib", "FolSerum", "FPSA", "Free PS", "FreePSA", "FrT4", "FSH",
        "FT3", "FT4", "FTI", "GAP", "GENT", "GGT", "GH", "GLOB", "GLU", "GRH", "H", "H2N", "HA", "HA1C", "HAPT",
        "HAVT", "HbA1C", "HBcT", "HBeAg", "HBs", "HBsII", "HBV DNA 3.0", "hCG", "HCG-ER", "HCV", "HCV RNA 3.0",
        "HCY", "HDL", "HDLC", "HEMO", "HER", "HIV", "HIV RNA 3.0", "Hold1_1", "Hold1_2", "Hold1_3", "Hold2_1",
        "Hold2_2", "Hold2_3", "Hold3_1", "Hold3_2", "Hold3_3", "Hold_Primary_1", "Hold_Primary_2", "Hold_Primary_3",
        "Hold_Skip_1", "Hold_Skip_2", "Hold_Skip_3", "HPG", "hsCRP", "H_Vista", "H_Zero", "I", "ICTE", "IG1", "IGA",
        "IGE", "IGF", "IGG", "IGM", "insulin 0", "IP", "iPTH_Old", "IRI", "IRON", "I_Vista", "I_Zero", "K", "K S",
        "KeepAlive", "KM199", "L", "LA", "LD-LP", "LD-PL", "LDI", "LDL", "LDLC", "LH", "LIDO", "LIP", "LIPE", "LIPL",
        "LMWH", "LYTE", "L_Vista", "L_Zero", "MACR", "MALB", "ManualDilution", "METH", "MG", "MG2", "MMB", "MTAX",
        "MYO", "NA", "Na/K", "NAPA", "NGAL", "NORESULT", "NTP", "OCN", "OPI2K", "OPI300", "Osmo", "OV", "PAMY",
        "PBNP", "PCHE", "PCP", "PCT", "PEP", "PHB", "PHNB", "PHNY", "PHOS", "PHTN", "PHY", "PIIINP", "PLG", "PREALB",
        "PRGE", "PRL", "PROC", "PROL", "Protein C", "Protein S", "PSA", "PT", "PTH", "PTN", "QHBsII", "QUIN", "RCK",
        "RDI", "RefAllgn", "Reptilase", "RF", "RMY", "RPT", "RTI", "RubG", "RubG2", "RubM", "SAL", "SHBG", "SIgE",
        "Slide", "STFR", "STORE", "SYPH", "T4", "TAC", "TACR", "TBIL", "TG", "ThCG", "THEO", "TIBC", "TIMP1", "TOB",
        "TOBR", "TOBRA", "TOP", "Total IgE", "ToxG", "ToxM", "TP", "TRF", "TRIG", "TSH", "TSH3UL", "TSH3UL_Old",
        "TSTO", "TUp", "TXP", "TXU", "U08_1", "U08_2", "U08_3", "UA", "uALB", "UCFP", "uE3", "UFH", "UIBC", "UN",
        "UP/CR", "VALP", "VAN", "VANC", "Vanc Low", "VANCO", "VB12", "VitD", "VPA", "vWF", "wrCRP", "XAMK", "XMTX",
        "_Hold_Primary_1", "_Hold_Primary_2", "_Hold_Primary_3", "_Hold_Skip_1", "_Hold_Skip_2", "_Hold_Skip_3"
    ];

    const lisToMachineMap = {};
    rawTestList.forEach(testStr => {
        const key = testStr.toUpperCase().replace(/[^A-Z0-9]/g, '');
        lisToMachineMap[key] = testStr;
    });
    lisToMachineMap['UREA'] = 'BUN';
    lisToMachineMap['UNC'] = 'BUN';

    // 1B. APPROVED TEST MAP (Applied EXCLUSIVELY to the "new HL7" button)
    // target: 'ALINITY' -> Alinity / VIDAPTOR file | target: 'CAREWARE' -> CareWare / ADM file
    const approvedTestMap = [
        { testId: "1043", abbr: "TACROLIMUS", workbench: "CH-Drug Monitoring", specimen: "Venous Blood", hl7Name: "Tacrolimus", approved: "642", target: "ALINITY" },
        { testId: "1313", abbr: "GENT.OD.T", workbench: "CH-Drug Monitoring", specimen: "Venous Blood", hl7Name: "Gentamicin", approved: "1867", target: "ALINITY" },
        { testId: "2009", abbr: "GENT.MD.T", workbench: "CH-Drug Monitoring", specimen: "Venous Blood", hl7Name: "Gentamicin", approved: "1867", target: "ALINITY" },
        { testId: "2298", abbr: "VALPROIC-T", workbench: "CH-Drug Monitoring", specimen: "Venous Blood", hl7Name: "Valproic", approved: "1836", target: "ALINITY" },
        { testId: "2704", abbr: "GENT.MD.P", workbench: "CH-Drug Monitoring", specimen: "Venous Blood", hl7Name: "Gentamicin", approved: "1867", target: "ALINITY" },
        { testId: "2711", abbr: "VALPR-PK", workbench: "CH-Drug Monitoring", specimen: "Venous Blood", hl7Name: "Valproic", approved: "1836", target: "ALINITY" },
        { testId: "2726", abbr: "AMIK OD-T", workbench: "CH-Drug Monitoring", specimen: "Venous Blood", hl7Name: "Amikacin", approved: "1871", target: "ALINITY" },
        { testId: "2734", abbr: "VANC.MD.T", workbench: "CH-Drug Monitoring", specimen: "Venous Blood", hl7Name: "Vancomycin", approved: "1869", target: "ALINITY" },
        { testId: "1266", abbr: "HBA1C-", workbench: "CH-Glucoses", specimen: "Venous Blood", hl7Name: "HbA1C", approved: "", target: "CAREWARE" },
        { testId: "1002", abbr: "TESTO", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "Testo", approved: "420", target: "ALINITY" },
        { testId: "1042", abbr: "CORT-R", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "Cortisol", approved: "607", target: "ALINITY" },
        { testId: "1152", abbr: "DHEA-S", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "DHEA-S", approved: "826", target: "ALINITY" },
        { testId: "1153", abbr: "Prolactin", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "Prolactin", approved: "207", target: "ALINITY" },
        { testId: "1160", abbr: "B12", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "VB12", approved: "VB12", target: "CAREWARE" },
        { testId: "1203", abbr: "LH", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "LH", approved: "645", target: "ALINITY" },
        { testId: "1257", abbr: "FSH", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "FSH", approved: "88", target: "ALINITY" },
        { testId: "1274", abbr: "FOL", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "FolSerum", approved: "FOL", target: "CAREWARE" },
        { testId: "1294", abbr: "E2", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "Estradiol", approved: "488", target: "ALINITY" },
        { testId: "1295", abbr: "PTH", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "iPTH", approved: "64", target: "ALINITY" },
        { testId: "1296", abbr: "FT4", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "Free T4", approved: "106", target: "ALINITY" },
        { testId: "1314", abbr: "VITD-T", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "Vit D25OH", approved: "797", target: "ALINITY" },
        { testId: "1592", abbr: "Iron", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "Iron", approved: "Iron", target: "CAREWARE" },
        { testId: "1593", abbr: "FERR", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "Fer", approved: "Fer", target: "CAREWARE" },
        { testId: "1594", abbr: "TIBC", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "TIBC", approved: "TIBC", target: "CAREWARE" },
        { testId: "1680", abbr: "TRF", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "TRF", approved: "TRF", target: "CAREWARE" },
        { testId: "2083", abbr: "CORT8", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "Cortisol", approved: "607", target: "ALINITY" },
        { testId: "2085", abbr: "FT3", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "Free T3", approved: "97", target: "ALINITY" },
        { testId: "2425", abbr: "TSH", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "TSH", approved: "248", target: "ALINITY" },
        { testId: "2676", abbr: "PCT", workbench: "CH-Hormones", specimen: "Venous Blood", hl7Name: "PCT", approved: "117", target: "ALINITY" },
        { testId: "2938", abbr: "EPO", workbench: "CH-Immulite", specimen: "Blood", hl7Name: "EPO", approved: "", target: "CAREWARE" },
        { testId: "2332", abbr: "Aldos Ser", workbench: "CH-Immulite", specimen: "Other", hl7Name: "Aldos Ser", approved: "", target: "CAREWARE" },
        { testId: "2333", abbr: "U. ALDO", workbench: "CH-Immulite", specimen: "Other", hl7Name: "U. ALDO", approved: "", target: "CAREWARE" },
        { testId: "1099", abbr: "GH-90", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "GH-90", approved: "", target: "CAREWARE" },
        { testId: "1161", abbr: "GH-0", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "GH-0", approved: "", target: "CAREWARE" },
        { testId: "1162", abbr: "GH-30", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "GH-30", approved: "", target: "CAREWARE" },
        { testId: "1249", abbr: "GH-60", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "GH-60", approved: "", target: "CAREWARE" },
        { testId: "1573", abbr: "GH-120", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "GH-120", approved: "", target: "CAREWARE" },
        { testId: "1992", abbr: "GH150", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "GH150", approved: "", target: "CAREWARE" },
        { testId: "1993", abbr: "GH180", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "GH180", approved: "", target: "CAREWARE" },
        { testId: "1994", abbr: "GH210", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "GH210", approved: "", target: "CAREWARE" },
        { testId: "2120", abbr: "17.0HP-30", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "17.0HP-30", approved: "", target: "CAREWARE" },
        { testId: "2121", abbr: "17.0HP-60", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "17.0HP-60", approved: "", target: "CAREWARE" },
        { testId: "2304", abbr: "IGF-1", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "IGF-1", approved: "", target: "CAREWARE" },
        { testId: "2305", abbr: "IGFBP-3", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "IGFBP-3", approved: "", target: "CAREWARE" },
        { testId: "2361", abbr: "Renin", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "Renin", approved: "", target: "CAREWARE" },
        { testId: "2729", abbr: "17.0HP 2/", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "17.0HP 2/", approved: "", target: "CAREWARE" },
        { testId: "2876", abbr: "DHT", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "DHT", approved: "", target: "CAREWARE" },
        { testId: "4015", abbr: "CALCITONIN", workbench: "CH-Immulite", specimen: "Venous Blood", hl7Name: "CALCITONIN", approved: "", target: "CAREWARE" },
        { testId: "1158", abbr: "CTN-I", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "CTNI", approved: "CTNI", target: "CAREWARE" },
        { testId: "1242", abbr: "HCO3", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "CO2", approved: "CO2", target: "CAREWARE" },
        { testId: "1253", abbr: "BUN", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "BUN", approved: "BUN", target: "CAREWARE" },
        { testId: "1255", abbr: "AST", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "AST", approved: "AST", target: "CAREWARE" },
        { testId: "1278", abbr: "ALTI", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "ALTI", approved: "ALTI", target: "CAREWARE" },
        { testId: "1576", abbr: "CREA", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "CREA", approved: "CREA", target: "CAREWARE" },
        { testId: "1658", abbr: "Glucose 30", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "GLU", approved: "GLU", target: "CAREWARE" },
        { testId: "1662", abbr: "Glucose 60", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "GLU", approved: "GLU", target: "CAREWARE" },
        { testId: "1663", abbr: "Glucose120", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "GLU", approved: "GLU", target: "CAREWARE" },
        { testId: "1775", abbr: "Glucose180", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "GLU", approved: "GLU", target: "CAREWARE" },
        { testId: "1780", abbr: "Amylase", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "AMY", approved: "AMY", target: "CAREWARE" },
        { testId: "1781", abbr: "F. GLU", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "GLU", approved: "GLU", target: "CAREWARE" },
        { testId: "1894", abbr: "GGT", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "GGT", approved: "GGT", target: "CAREWARE" },
        { testId: "1896", abbr: "D.BIL", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "DBIL", approved: "DBIL", target: "CAREWARE" },
        { testId: "1914", abbr: "CHOL", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "CHOL", approved: "CHOL", target: "CAREWARE" },
        { testId: "1915", abbr: "T.BIL", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "TBIL", approved: "TBIL", target: "CAREWARE" },
        { testId: "2004", abbr: "HBA1C", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "HbA1C", approved: "HbA1C", target: "CAREWARE" },
        { testId: "2019", abbr: "TP", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "TP", approved: "TP", target: "CAREWARE" },
        { testId: "2081", abbr: "MG", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "MG", approved: "MG", target: "CAREWARE" },
        { testId: "2152", abbr: "Glucose180", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "GLU", approved: "GLU", target: "CAREWARE" },
        { testId: "2205", abbr: "CA", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "CA", approved: "CA", target: "CAREWARE" },
        { testId: "2206", abbr: "R GLU", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "GLU", approved: "GLU", target: "CAREWARE" },
        { testId: "2207", abbr: "Albumin", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "ALB", approved: "ALB", target: "CAREWARE" },
        { testId: "2210", abbr: "K.", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "K", approved: "K", target: "CAREWARE" },
        { testId: "2254", abbr: "TRIG", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "TRIG", approved: "TRIG", target: "CAREWARE" },
        { testId: "2288", abbr: "ALPI", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "ALP", approved: "ALP", target: "CAREWARE" },
        { testId: "2289", abbr: "CL", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "CL", approved: "CL", target: "CAREWARE" },
        { testId: "2290", abbr: "CKI", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "CK", approved: "CK", target: "CAREWARE" },
        { testId: "2292", abbr: "PHOS", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "PHOS", approved: "PHOS", target: "CAREWARE" },
        { testId: "2337", abbr: "HCY", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "HCY", approved: "HCY", target: "CAREWARE" },
        { testId: "2493", abbr: "UA", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "UA", approved: "UA", target: "CAREWARE" },
        { testId: "2717", abbr: "LDI", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "LDI", approved: "LDI", target: "CAREWARE" },
        { testId: "2718", abbr: "NA", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "NA", approved: "NA", target: "CAREWARE" },
        { testId: "2935", abbr: "Lipase", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "LIP", approved: "LIP", target: "CAREWARE" },
        { testId: "2936", abbr: "PRO-BNP", workbench: "CH-Routine", specimen: "Venous Blood", hl7Name: "PBNP", approved: "PBNP", target: "CAREWARE" },
        { testId: "1980", abbr: "CSF-P", workbench: "CH-Special-1", specimen: "(CSF)", hl7Name: "UCFP", approved: "UCFP", target: "CAREWARE" },
        { testId: "2731", abbr: "CSF glu", workbench: "CH-Special-1", specimen: "(CSF)", hl7Name: "GLU", approved: "GLU", target: "CAREWARE" },
        { testId: "2757", abbr: "Bil(Drain)", workbench: "CH-Special-1", specimen: "Drainage", hl7Name: "Bil(Drain)", approved: "TBIL", target: "CAREWARE" },
        { testId: "2280", abbr: "LDH-PLF", workbench: "CH-Special-1", specimen: "FLIUD", hl7Name: "LDI", approved: "LDI", target: "CAREWARE" },
        { testId: "1251", abbr: "U-CA", workbench: "CH-Special-1", specimen: "Urine", hl7Name: "U-CA", approved: "CA", target: "CAREWARE" },
        { testId: "1275", abbr: "Ur Gluc 1h", workbench: "CH-Special-1", specimen: "Urine", hl7Name: "Ur Gluc 1h", approved: "GLU", target: "CAREWARE" },
        { testId: "1276", abbr: "Ur Gluc 3h", workbench: "CH-Special-1", specimen: "Urine", hl7Name: "Ur Gluc 3h", approved: "GLU", target: "CAREWARE" },
        { testId: "1659", abbr: "Ur Gluc Fa", workbench: "CH-Special-1", specimen: "Urine", hl7Name: "Ur Gluc Fa", approved: "GLU", target: "CAREWARE" },
        { testId: "1755", abbr: "U-CREA", workbench: "CH-Special-1", specimen: "Urine", hl7Name: "CREA", approved: "CREA", target: "CAREWARE" },
        { testId: "2216", abbr: "U. MG", workbench: "CH-Special-1", specimen: "Urine", hl7Name: "U. MG", approved: "MG", target: "CAREWARE" },
        { testId: "2217", abbr: "U. UREA", workbench: "CH-Special-1", specimen: "Urine", hl7Name: "BUN", approved: "BUN", target: "CAREWARE" },
        { testId: "2218", abbr: "U. UA", workbench: "CH-Special-1", specimen: "Urine", hl7Name: "UA", approved: "UA", target: "CAREWARE" },
        { testId: "2498", abbr: "24. UP", workbench: "CH-Special-1", specimen: "Urine", hl7Name: "UCFP", approved: "UCFP", target: "CAREWARE" },
        { testId: "2719", abbr: "Urine Na", workbench: "CH-Special-1", specimen: "Urine", hl7Name: "NA", approved: "NA", target: "CAREWARE" },
        { testId: "2879", abbr: "MA/CR", workbench: "CH-Special-1", specimen: "Urine", hl7Name: "MACR", approved: "MACR,MALB,CREA", target: "CAREWARE" },
        { testId: "3021", abbr: "UP/CR", workbench: "CH-Special-1", specimen: "Urine", hl7Name: "UP/CR", approved: "UP/CR,UCFP,CREA", target: "CAREWARE" },
        { testId: "2246", abbr: "LAC.A(BLD)", workbench: "CH-Special-1", specimen: "Venous Blood", hl7Name: "LA", approved: "LA", target: "CAREWARE" },
        { testId: "1546", abbr: "Urea-U 24h", workbench: "CH-Special-2", specimen: "Urine", hl7Name: "BUN", approved: "BUN", target: "CAREWARE" },
        { testId: "2681", abbr: "24U.Oalate", workbench: "CH-Special-2", specimen: "Urine", hl7Name: "24U.Oalate", approved: "", target: "CAREWARE" },
        { testId: "2735", abbr: "Crea-U-24H", workbench: "CH-Special-2", specimen: "Urine", hl7Name: "CREA", approved: "CREA", target: "CAREWARE" },
        { testId: "2898", abbr: "PET-UV-24H", workbench: "CH-Special-2", specimen: "Urine", hl7Name: "PET-UV-24H", approved: "", target: "CAREWARE" }
    ];

    const approvedByTestId = {};
    const approvedByAbbrExact = {};
    const approvedByAbbrNorm = {};

    approvedTestMap.forEach(entry => {
        approvedByTestId[entry.testId] = entry;
        approvedByAbbrExact[entry.abbr.toUpperCase()] = entry;
        const normKey = entry.abbr.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (normKey) approvedByAbbrNorm[normKey] = entry;
    });

    function lookupApprovedTest(idToken, abbrToken) {
        if (idToken && approvedByTestId[idToken]) {
            return approvedByTestId[idToken];
        }
        if (abbrToken) {
            const leadingIdMatch = abbrToken.match(/^(\d{1,4})\b/);
            if (leadingIdMatch && approvedByTestId[leadingIdMatch[1]]) {
                return approvedByTestId[leadingIdMatch[1]];
            }
            const cleanAbbr = abbrToken.replace(/^\d{1,4}\s*[-:]?\s*/, '').trim();
            const exactKey = cleanAbbr.toUpperCase();
            if (approvedByAbbrExact[exactKey]) {
                return approvedByAbbrExact[exactKey];
            }
            const normKey = exactKey.replace(/[^A-Z0-9]/g, '');
            if (normKey && approvedByAbbrNorm[normKey]) {
                return approvedByAbbrNorm[normKey];
            }
        }
        return null;
    }

    // 2. Panels for Printed Worklist (Visual only)
    const panelDefinitions = [
        { name: 'U&E + Glu', tests: [['CREA', 'CREAT'], ['GLU'], ['BUN'], ['NA'], ['K'], ['CL']] },
        { name: 'P3', tests: [['ALB'], ['CA'], ['CREA', 'CREAT'], ['PHOS', 'IP'], ['MG'], ['BUN'], ['NA'], ['K'], ['CL']] },
        { name: 'U&E', tests: [['CREA', 'CREAT'], ['BUN'], ['NA'], ['K'], ['CL']] },
        { name: 'LFT', tests: [['ALTI', 'ALT'], ['ALB'], ['ALP'], ['GGT'], ['TP'], ['TBIL'], ['AST']] },
        { name: 'RFT', tests: [['ALB'], ['ALP'], ['CA'], ['PHOS', 'IP'], ['TP'], ['UA']] },
        { name: 'BONE', tests: [['ALB'], ['ALP'], ['CA'], ['PHOS', 'IP'], ['TP']] },
        { name: 'PET', tests: [['ALB'], ['CREA', 'CREAT'], ['GLU'], ['BUN']] },
        { name: 'TBIL+DBIL', tests: [['DBIL'], ['TBIL']] },
        { name: 'LIPID', tests: [['TRIG'], ['CHOL']] },
        { name: 'Cardiac', tests: [['AST'], ['CK'], ['LDH']] },
        { name: 'CE', tests: [['AST'], ['CK'], ['LDH']] },
        { name: 'ANEMIC', tests: [['IRON'], ['TIBC'], ['TRF'], ['VB12'], ['FER', 'Fer'], ['FolSerum']] }
    ];

    const supersetMap = {
        'BONE': ['RFT'], 'U&E': ['P3', 'U&E + Glu'], 'LIPID': ['Lipid_FULL'], 'CE': ['Cardiac']
    };

    const urineAnalysisTests = new Set([
        'ASP', 'TREP', 'BLOOD', 'NITRITE', 'RBC', 'CRYSTALS', 'WBC', 'EPITHELIAL', 'CASTS',
        'BACTERIA', 'YEAST', 'YEASTCELL', 'CELL', 'SPGRAVITY', 'PH', 'LEUKOCYTES', 'PROTEIN',
        'KETONE', 'UROBILINOG', 'BILIRUBIN', 'ERYTHROCYT', 'COLOUR', 'APPEARANCE', 'RBCC',
        'CYST', 'TYRO', 'AMOR', 'UNCL', 'TRCH', 'NSE', 'UNCC', 'HYAL', 'EPIC', 'WBCT', 'RBCT',
        'GRAN', 'BROAD', 'FATC', 'TPO4', 'TPO', 'CAOX', 'CAPH', 'CACB', 'URIC', 'LEUC', 'UGLU',
        'FAT', 'MUCOUS', 'ART', 'WBCC', 'BYST', 'HYST', 'SQEP', 'REEP', 'OVFB'
    ]);

    function showToastNotification(message, isError = false) {
        const existingToast = document.getElementById('hl7-custom-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'hl7-custom-toast';
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '99999';
        toast.style.padding = '12px 20px';
        toast.style.borderRadius = '6px';
        toast.style.backgroundColor = isError ? '#dc3545' : '#17a2b8';
        toast.style.color = '#fff';
        toast.style.fontFamily = 'Arial, sans-serif';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = 'bold';
        toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 4000);
    }

    function normalizeSpecimenForHL7(rawSpecimen) {
        if (!rawSpecimen) return 'Serum';
        const clean = rawSpecimen.replace(/[()]/g, '').trim();
        if (/venous(\s+blood)?|whole\s+blood|^vb$/i.test(clean)) return 'Serum';
        if (/^fli?ud$/i.test(clean)) return 'Serum';
        return clean;
    }

    function formatPatientNameForAlinity(rawName) {
        if (!rawName || !rawName.trim()) return 'UNKNOWN^PATIENT^^^^^L';
        const cleaned = rawName.trim();
        if (cleaned.includes('^')) {
            return cleaned.endsWith('^L') ? cleaned : `${cleaned}^^^^^L`;
        }
        if (cleaned.includes(',')) {
            const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
            const last = (parts[0] || '').toUpperCase();
            const first = (parts[1] || '').toUpperCase();
            return `${last}^${first}^^^^^L`;
        }
        const words = cleaned.split(/\s+/).filter(Boolean);
        if (words.length >= 2) {
            const last = words[words.length - 1].toUpperCase();
            const first = words.slice(0, -1).join(' ').toUpperCase();
            return `${last}^${first}^^^^^L`;
        }
        return `${cleaned.toUpperCase()}^^^^^^L`;
    }

    function processTests(rawTestString) {
        if (!rawTestString) return { panelDisplay: '', hl7IndividualTests: [] };

        let preClean = rawTestString.replace(/\b\d{3,4}\b/g, '').trim();
        let rawTokens = preClean.split(/[,/\n\r]+/).map(t => t.trim()).filter(t => t);

        let originalTests = [];
        let normalizedTests = [];
        let hasUrineAnalysis = false;
        let hl7IndividualTests = [];

        rawTokens.forEach(token => {
            let cleanToken = token.replace(/\b\d{3,4}\b/g, '')
                                  .replace(/^[-•*:\s]+/, '')
                                  .replace(/[\s.]+$/, '');

            if (!cleanToken) return;

            let tokenUpper = cleanToken.toUpperCase();
            if (/^(F\.?\s*GLU|R\.?\s*GLU|GLUCOSE.*|CSF\s*GLU|GLU[-.]ASF)$/.test(tokenUpper)) {
                cleanToken = 'GLU';
            } else if (tokenUpper === 'TNIH' || tokenUpper === 'CTN-I') {
                cleanToken = 'CTNI';
            } else if (tokenUpper === 'CK_L' || tokenUpper === 'CKI') {
                cleanToken = 'CK';
            } else if (tokenUpper === 'CKMB' || tokenUpper === 'CK-MB') {
                cleanToken = 'MMB';
            } else if (tokenUpper === 'LDLP' || tokenUpper === 'LDH-PLF' || tokenUpper === 'LDH.PLF') {
                cleanToken = 'LDI';
            } else if (tokenUpper === 'T.BIL') {
                cleanToken = 'TBIL';
            } else if (tokenUpper === 'D.BIL') {
                cleanToken = 'DBIL';
            } else if (tokenUpper === 'ALBUMIN' || tokenUpper === 'ALB-FLD' || tokenUpper === 'ALB.FLD') {
                cleanToken = 'ALB';
            } else if (tokenUpper === 'TP.FLD' || tokenUpper === 'TP-FLD' || tokenUpper === 'TP.PLF' || tokenUpper === 'TP-PLF') {
                cleanToken = 'TP';
            } else if (tokenUpper === 'U-CREA' || tokenUpper === 'U.CREA' || tokenUpper === 'UCREA' || tokenUpper === 'URINE CREA' || tokenUpper === 'URINE CREAT') {
                cleanToken = 'CREA';
            } else if (tokenUpper === 'ALPI') {
                cleanToken = 'ALP';
            } else if (tokenUpper === 'CSF-P' || tokenUpper === 'CSFP' || tokenUpper === 'UP') {
                cleanToken = 'UCFP';
            } else if (tokenUpper === 'LIPASE') {
                cleanToken = 'LIP';
            } else if (tokenUpper === 'AMYLASE') {
                cleanToken = 'AMY';
            } else if (tokenUpper === 'AMM') {
                cleanToken = 'AMON';
            } else if (tokenUpper === 'LAC.A(BLD)' || tokenUpper === 'LAC.A (BLD)') {
                cleanToken = 'LA';
            } else if (tokenUpper === 'PRO-BNP' || tokenUpper === 'PROBNP') {
                cleanToken = 'PBNP';
            } else if (tokenUpper === 'HCO3') {
                cleanToken = 'CO2';
            } else if (tokenUpper === 'CR') {
                cleanToken = 'CREA';
            } else if (tokenUpper === 'MAUR-R' || tokenUpper === 'MA') {
                cleanToken = 'MALB';
            } else if (tokenUpper === 'URINE K') {
                cleanToken = 'K';
            } else if (tokenUpper === 'URINE NA') {
                cleanToken = 'NA';
            } else if (tokenUpper === 'B12') {
                cleanToken = 'VB12';
            } else if (tokenUpper === 'FOL') {
                cleanToken = 'FolSerum';
            } else if (tokenUpper === 'FERR') {
                cleanToken = 'Fer';
            } else if (tokenUpper === 'IRON') {
                cleanToken = 'IRON';
            } else if (/^AMY\s+DRAIN$/i.test(tokenUpper)) {
                cleanToken = 'AMY';
            }

            if (!hl7IndividualTests.includes(cleanToken)) {
                hl7IndividualTests.push(cleanToken);
            }

            let norm = cleanToken.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (!norm) return;

            if (urineAnalysisTests.has(norm)) {
                hasUrineAnalysis = true;
            } else {
                originalTests.push(cleanToken);
                normalizedTests.push(norm);
            }
        });

        if (hl7IndividualTests.includes('MALB') && hl7IndividualTests.includes('CREA')) {
            if (!hl7IndividualTests.includes('MACR')) hl7IndividualTests.push('MACR');
            if (!normalizedTests.includes('MACR')) {
                originalTests.push('MACR');
                normalizedTests.push('MACR');
            }
        }

        if (hl7IndividualTests.includes('UCFP') && hl7IndividualTests.includes('CREA')) {
            if (!hl7IndividualTests.includes('UP/CR')) hl7IndividualTests.push('UP/CR');
            if (!normalizedTests.includes('UPCR')) {
                originalTests.push('UP/CR');
                normalizedTests.push('UPCR');
            }
        }

        let matchedPanels = [];
        let consumedIndices = new Set();
        panelDefinitions.forEach(panel => {
            let matchedIndicesForThisPanel = [];
            let allPresent = panel.tests.every(aliasGroup => {
                let foundIndex = normalizedTests.findIndex((t) => t && aliasGroup.includes(t));
                if (foundIndex !== -1) {
                    matchedIndicesForThisPanel.push(foundIndex);
                    return true;
                }
                return false;
            });

            if (allPresent) {
                let isRedundant = supersetMap[panel.name]?.some(sup => matchedPanels.includes(sup));
                if (!isRedundant) {
                    if (!matchedPanels.includes(panel.name)) matchedPanels.push(panel.name);
                    matchedIndicesForThisPanel.forEach(idx => consumedIndices.add(idx));
                    panel.tests.forEach(aliasGroup => {
                        normalizedTests.forEach((t, idx) => {
                            if (t && aliasGroup.includes(t)) consumedIndices.add(idx);
                        });
                    });
                }
            }
        });

        let finalPrintOutput = [];
        if (hasUrineAnalysis) finalPrintOutput.push('Urine analysis');
        matchedPanels.forEach(p => finalPrintOutput.push(p));

        originalTests.forEach((t, idx) => {
            if (!consumedIndices.has(idx)) {
                let norm = normalizedTests[idx];
                let machineName = lisToMachineMap[norm] || t;
                if (!finalPrintOutput.includes(machineName)) {
                    finalPrintOutput.push(machineName);
                }
            }
        });

        return {
            panelDisplay: finalPrintOutput.join(', '),
            hl7IndividualTests: hl7IndividualTests
        };
    }

    // Standard extraction (Normalized for worklist & standard HL7)
    function extractTableData() {
        const rows = document.querySelectorAll('tbody[formarrayname="TubeTypeList"] tr');
        let extractedData = [];
        let currentTime = new Date().toLocaleString();

        rows.forEach(row => {
            let barcode = row.querySelector('input[formcontrolname="Barcode"]')?.value || '';
            let clusterMrn = row.querySelector('input[formcontrolname="PatientID"]')?.value || '';

            let rawPatientName = row.querySelector('input[formcontrolname="PatientName"]')?.value || '';
            let patientName = rawPatientName.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/^,|,$/g, '').trim();

            let testSpecimen = row.querySelector('input[formcontrolname="TestSpecimen"]')?.value || '';
            let testIdRaw = row.querySelector('textarea[formcontrolname="TestDetails"]')?.value || '';
            let testSection = row.querySelector('input[formcontrolname="TestSection"]')?.value || 'General';

            let testResult = processTests(testIdRaw);

            // FORCE FLUID / FLIUD TO SERUM
            if (/^fli?ud$/i.test(testSpecimen.trim())) {
                testSpecimen = 'Serum';
            }

            // FORCE SPECIMEN TO PLASMA IF 'LA' OR 'AMON' IS IN THE ORDER
            if (testResult.hl7IndividualTests.includes('LA') || testResult.hl7IndividualTests.includes('AMON')) {
                testSpecimen = 'Plasma';
            }
            // FORCE SPECIMEN TO SERUM IF 'AMY' (Amy Drain) AND SPECIMEN IS DRAINAGE
            else if (testResult.hl7IndividualTests.includes('AMY') && /drainage/i.test(testSpecimen)) {
                testSpecimen = 'Serum';
            }

            if (barcode || clusterMrn || patientName) {
                extractedData.push({
                    barcode: barcode.trim(),
                    clusterMrn: clusterMrn.trim(),
                    patientName: patientName,
                    testSpecimen: testSpecimen.trim(),
                    testId: testResult.panelDisplay,
                    individualTests: testResult.hl7IndividualTests,
                    workbench: testSection.trim() || 'General',
                    timestamp: currentTime
                });
            }
        });
        return extractedData;
    }

    // NEW: Extraction for "new HL7" button
    function extractRawTableData() {
        const rows = document.querySelectorAll('tbody[formarrayname="TubeTypeList"] tr');
        let extractedData = [];

        rows.forEach(row => {
            let barcode = row.querySelector('input[formcontrolname="Barcode"]')?.value || '';
            let clusterMrn = row.querySelector('input[formcontrolname="PatientID"]')?.value || '';
            let rawPatientName = row.querySelector('input[formcontrolname="PatientName"]')?.value || '';
            let patientName = rawPatientName.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/^,|,$/g, '').trim();

            let testSpecimen = row.querySelector('input[formcontrolname="TestSpecimen"]')?.value || '';
            let testSection = row.querySelector('input[formcontrolname="TestSection"]')?.value || '';

            let rawTestIds = row.querySelector('[formcontrolname="TestIDs"], [formcontrolname="TestID"], [formcontrolname="TestIds"]')?.value || '';
            let rawAbbreviations = row.querySelector('[formcontrolname="Abbreviations"], [formcontrolname="TestAbbreviation"], [formcontrolname="TestDetails"]')?.value || '';

            let dobRaw = row.querySelector('[formcontrolname="DOB"], [formcontrolname="DateOfBirth"], [formcontrolname="BirthDate"]')?.value || '';
            let genderRaw = row.querySelector('[formcontrolname="Gender"], [formcontrolname="Sex"]')?.value || '';

            // Fallback: inspect other inputs/textareas in the row if explicit formcontrolnames differ
            if (!rawTestIds || !rawAbbreviations) {
                const inputs = row.querySelectorAll('input, textarea');
                inputs.forEach(el => {
                    const fc = (el.getAttribute('formcontrolname') || '').toLowerCase();
                    if (!rawTestIds && (fc.includes('testid') || fc === 'ids')) {
                        rawTestIds = el.value;
                    }
                    if (!rawAbbreviations && (fc.includes('abbrev') || fc.includes('detail') || fc.includes('testname'))) {
                        rawAbbreviations = el.value;
                    }
                    if (!dobRaw && (fc.includes('dob') || fc.includes('birth'))) {
                        dobRaw = el.value;
                    }
                    if (!genderRaw && (fc.includes('gender') || fc.includes('sex'))) {
                        genderRaw = el.value;
                    }
                });
            }

            if (barcode || clusterMrn || patientName) {
                extractedData.push({
                    barcode: barcode.trim(),
                    clusterMrn: clusterMrn.trim(),
                    patientName: patientName,
                    dob: dobRaw.replace(/[^0-9]/g, '').slice(0, 8),
                    gender: genderRaw.trim().toUpperCase().charAt(0),
                    testSpecimen: testSpecimen.trim(),
                    testSection: testSection.trim(),
                    rawTestIds: rawTestIds.trim(),
                    rawAbbreviations: rawAbbreviations.trim()
                });
            }
        });
        return extractedData;
    }

    function getHL7Timestamp(d = new Date()) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    }

    function generateCareWareHL7(extractedData) {
        if (!extractedData || extractedData.length === 0) return '';

        const ts = getHL7Timestamp();
        let segments = [];

        extractedData.forEach((item, index) => {
            const controlId = `HL7${Date.now().toString().slice(-6)}${String(index + 1).padStart(3, '0')}`;
            const barcode = item.barcode || '00000000';
            const mrn = item.clusterMrn || '000000';
            const specimen = normalizeSpecimenForHL7(item.testSpecimen);

            let patientName = 'Unknown Patient';
            if (item.patientName && item.patientName.trim()) {
                patientName = item.patientName.trim();
            }

            // 1. MSH
            segments.push(`MSH|^~\\&|CAREWARE|CAREWARE|ADM|ADM|${ts}||OML^O33|${controlId}|P|2.5|1|||||`);

            // 2. PID
            segments.push(`PID|1||${mrn}||${patientName}||19800101|.||||||||||||||||||||||N`);

            // 3. PV1
            segments.push(`PV1|1|O|CHEMLAB|NA|NA|NA|||||||||||||${mrn}|||||||||||||||||||||||||${ts}||||||||`);

            // 4. SPM
            segments.push(`SPM|1|${barcode}||${specimen}|||||||||||||${ts}|${ts}|||||||||||`);

            const testsToOrder = (item.individualTests && item.individualTests.length > 0) ? item.individualTests : ['UNKNOWN_TEST'];

            testsToOrder.forEach((rawTestName, testIdx) => {
                const seq = testIdx + 1;
                segments.push(`ORC|NW|${barcode}|${barcode}||||^^^${ts}^^S|||||||||||CW|`);
                segments.push(`OBR|${seq}|${barcode}||${rawTestName}|||||||||||||||||||||||||||^||||||||||||||`);
            });
        });

        return segments.join('\r\n') + '\r\n';
    }

    // NEW: Generates SEPARATE HL7 payloads with per-test routing:
    //   1) Alinity / VIDAPTOR -> Only tests with target === 'ALINITY' (numeric Alinity assay numbers)
    //   2) CareWare / ADM     -> All tests with target === 'CAREWARE' (including VB12, FOL, Iron, Fer, TIBC, TRF)
    function generateNewSplitHL7(rawData) {
        if (!rawData || rawData.length === 0) {
            return { alinityHL7: '', carewareHL7: '', alinityCount: 0, carewareCount: 0 };
        }

        const ts = getHL7Timestamp();
        let alinitySegments = [];
        let carewareSegments = [];
        let alinityIndex = 0;
        let carewareIndex = 0;

        rawData.forEach(item => {
            const barcode = item.barcode || '00000000';
            const mrn = item.clusterMrn || '000000';
            const section = item.testSection || '';

            const idTokens = item.rawTestIds
                ? item.rawTestIds.split(/[,;\n\r]+/).map(s => s.trim()).filter(Boolean)
                : [];
            const abbrTokens = item.rawAbbreviations
                ? item.rawAbbreviations.split(/[,;\n\r]+/).map(s => s.trim()).filter(Boolean)
                : [];

            const maxLen = Math.max(idTokens.length, abbrTokens.length, 1);
            let alinityOrders = [];
            let carewareOrders = [];
            let seenAlinity = new Set();
            let seenCareware = new Set();

            for (let i = 0; i < maxLen; i++) {
                const tId = idTokens[i] || '';
                const tAbbr = abbrTokens[i] || '';
                const matched = lookupApprovedTest(tId, tAbbr);

                if (matched) {
                    const codeSource = matched.approved || matched.hl7Name || matched.abbr;
                    const splitCodes = codeSource.split(',').map(c => c.trim()).filter(Boolean);
                    const isAlinityTarget = matched.target === 'ALINITY' && /^\d+$/.test(matched.approved);

                    splitCodes.forEach(code => {
                        if (isAlinityTarget) {
                            if (!seenAlinity.has(code)) {
                                seenAlinity.add(code);
                                alinityOrders.push({
                                    code: code,
                                    hl7Name: matched.hl7Name || code
                                });
                            }
                        } else {
                            if (!seenCareware.has(code)) {
                                seenCareware.add(code);
                                carewareOrders.push(code);
                            }
                        }
                    });
                } else {
                    const fallbackCode = (tAbbr || tId || 'UNKNOWN_TEST').replace(/^\d{1,4}\s*[-:]?\s*/, '').trim() || tId || 'UNKNOWN_TEST';
                    if (!seenCareware.has(fallbackCode)) {
                        seenCareware.add(fallbackCode);
                        carewareOrders.push(fallbackCode);
                    }
                }
            }

            if (alinityOrders.length === 0 && carewareOrders.length === 0) {
                carewareOrders.push('UNKNOWN_TEST');
            }

            // 1. Build Alinity / VIDAPTOR block if sample has Alinity-targeted tests
            if (alinityOrders.length > 0) {
                alinityIndex++;
                const msgCtrlSuffix = String(400 + alinityIndex).padStart(3, '0');
                const xpnPatientName = formatPatientNameForAlinity(item.patientName);
                const dob = (item.dob && item.dob.length === 8) ? item.dob : '19900101';
                const sex = (item.gender === 'M' || item.gender === 'F') ? item.gender : 'U';

                alinitySegments.push(`MSH|^~\\&|VIDAPTOR|VIDA|Abbott|Alinity_CHEM_2_KAUH|${ts}||OML^O33^OML_O33|${ts}.${msgCtrlSuffix}|P|2.5.1|||NE|AL||UNICODE UTF-8|||LAB-28^IHE`);
                alinitySegments.push(`PID|||${mrn}||${xpnPatientName}||${dob}|${sex}`);
                alinitySegments.push(`PV1||N|^CENTRAL_LAB`);
                alinitySegments.push(`SPM|1|||""|||||||P^Patient^HL70369`);
                alinitySegments.push(`SAC|||${barcode}`);

                alinityOrders.forEach(order => {
                    alinitySegments.push(`ORC|NW||||||||${ts}`);
                    alinitySegments.push(`OBR||AWOS-${ts}-${mrn}-${order.code}||${order.code}^${order.hl7Name}^99ABT`);
                });
            }

            // 2. Build CareWare / ADM block if sample has CareWare-targeted tests (including VB12, FOL, Iron, Fer, TIBC, TRF)
            if (carewareOrders.length > 0) {
                carewareIndex++;
                const controlId = `HL7${Date.now().toString().slice(-6)}${String(carewareIndex).padStart(3, '0')}`;
                let specimen = normalizeSpecimenForHL7(item.testSpecimen);

                if (carewareOrders.includes('LA') || carewareOrders.includes('AMON')) {
                    specimen = 'Plasma';
                } else if (carewareOrders.includes('AMY') && /drainage/i.test(item.testSpecimen)) {
                    specimen = 'Serum';
                }

                const patientName = (item.patientName && item.patientName.trim()) ? item.patientName.trim() : 'Unknown Patient';

                carewareSegments.push(`MSH|^~\\&|CAREWARE|CAREWARE|ADM|ADM|${ts}||OML^O33|${controlId}|P|2.5|1|||||`);
                carewareSegments.push(`PID|1||${mrn}||${patientName}||19800101|.||||||||||||||||||||||N`);
                carewareSegments.push(`PV1|1|O|${section || 'CHEMLAB'}|NA|NA|NA|||||||||||||${mrn}|||||||||||||||||||||||||${ts}||||||||`);
                carewareSegments.push(`SPM|1|${barcode}||${specimen}|||||||||||||${ts}|${ts}|||||||||||`);

                carewareOrders.forEach((code, testIdx) => {
                    const seq = testIdx + 1;
                    carewareSegments.push(`ORC|NW|${barcode}|${barcode}||||^^^${ts}^^S|||||${section}||||||CW|`);
                    carewareSegments.push(`OBR|${seq}|${barcode}||${code}||||||||||||||||||||${section}||||||^||||||||||||||`);
                });
            }
        });

        return {
            alinityHL7: alinitySegments.length > 0 ? alinitySegments.join('\r\n') + '\r\n' : '',
            carewareHL7: carewareSegments.length > 0 ? carewareSegments.join('\r\n') + '\r\n' : '',
            alinityCount: alinityIndex,
            carewareCount: carewareIndex
        };
    }

    function downloadHL7File(hl7Content, prefix = 'CareWare_Orders', customTs = null) {
        if (!hl7Content) return;
        const ts = customTs || getHL7Timestamp();
        const filename = `${prefix}_${ts}.txt`;

        const blob = new Blob([hl7Content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }, 300);
    }

    function buildPrintHTML(extractedData) {
        if (!extractedData || extractedData.length === 0) return '';
        let currentTime = extractedData[0].timestamp;
        const workbenchGroups = {};
        extractedData.forEach(item => {
            let rawWb = item.workbench;
            let groupKey = rawWb;
            if (/CH-Special-1/i.test(rawWb) || /CH-Urinalysis/i.test(rawWb)) {
                groupKey = 'CH-Special-1 + CH-Urinalysis';
            }
            if (!workbenchGroups[groupKey]) workbenchGroups[groupKey] = [];
            workbenchGroups[groupKey].push(item);
        });

        let workbenches = Object.keys(workbenchGroups);
        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Printable Worklist</title>
                <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
                <style>
                    @page { size: A4 portrait; margin: 8mm; }
                    * { box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; padding: 0; margin: 0; color: #333; }
                    .workbench-page { page-break-before: always; page-break-after: always; break-before: page; break-after: page; }
                    .workbench-page:first-child { page-break-before: avoid; break-before: avoid; }
                    .workbench-page:last-child { page-break-after: auto; break-after: auto; }
                    .header-container { text-align: center; margin-bottom: 6px; border-bottom: 2px solid #333; padding-bottom: 4px; }
                    h2 { margin: 0 0 2px 0; font-size: 18px; text-transform: uppercase; }
                    .workbench-title { font-size: 14px; font-weight: bold; color: #0056b3; margin: 2px 0; }
                    .timestamp { color: #666; font-size: 12px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                    thead { display: table-header-group; }
                    tr { page-break-inside: avoid; break-inside: avoid; }
                    th, td { border: 1px solid #000; padding: 2px 4px; text-align: left; vertical-align: middle; font-size: 12px; line-height: 1.1; }
                    th { background-color: #f4f4f4 !important; -webkit-print-color-adjust: exact; padding: 4px; font-weight: bold; }
                    svg.barcode { max-width: 100%; height: auto; display: block; margin: 0 auto; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
        `;

        workbenches.forEach(wbName => {
            let pageData = workbenchGroups[wbName];
            htmlContent += `
                <div class="workbench-page">
                    <div class="header-container">
                        <h2>Laboratory Worklist</h2>
                        <div class="workbench-title">Workbench: ${wbName} (Samples: ${pageData.length})</div>
                        <div class="timestamp">Generated: ${currentTime} | Total Received: ${extractedData.length}</div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 4%; text-align: center;">Nr.</th>
                                <th style="width: 22%; text-align: center;">Barcode</th>
                                <th style="width: 12%">Cluster MRN</th>
                                <th style="width: 20%">Patient Name</th>
                                <th style="width: 12%">Specimen</th>
                                <th style="width: 20%">Test ID / Abbreviation</th>
                                <th style="width: 10%">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pageData.map((item, index) => `
                            <tr>
                                <td style="text-align: center;"><strong>${index + 1}</strong></td>
                                <td style="text-align: center;">
                                    <svg class="barcode" jsbarcode-value="${item.barcode}" jsbarcode-format="CODE128"
                                         jsbarcode-displayvalue="true" jsbarcode-height="25" jsbarcode-margin="2"
                                         jsbarcode-width="1.5" jsbarcode-fontsize="12">
                                    </svg>
                                </td>
                                <td>${item.clusterMrn}</td>
                                <td dir="auto" style="line-height: 1.3; word-break: break-word;">${item.patientName}</td>
                                <td>${item.testSpecimen}</td>
                                <td><strong>${item.testId.replace(/\n/g, '<br>')}</strong></td>
                                <td>${item.timestamp.split(', ')[1] || item.timestamp}</td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        });

        htmlContent += `
                <script>
                    window.addEventListener('DOMContentLoaded', () => {
                        try { JsBarcode(".barcode").init(); } catch (e) {}
                        setTimeout(() => { window.print(); }, 400);
                    });
                </script>
            </body>
            </html>
        `;
        return htmlContent;
    }

    function printDirectly(extractedData) {
        const html = buildPrintHTML(extractedData);
        if (!html) return;
        let iframe = document.getElementById('silent-worklist-frame');
        if (iframe) iframe.remove();

        iframe = document.createElement('iframe');
        iframe.id = 'silent-worklist-frame';
        iframe.style.position = 'absolute';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
    }

    function executeOrderProcessing(extractedData) {
        if (!extractedData || extractedData.length === 0) return;
        const hl7Message = generateCareWareHL7(extractedData);
        downloadHL7File(hl7Message);
        printDirectly(extractedData);
    }

    // Global event listener for Save button
    document.addEventListener('click', (e) => {
        const saveBtn = e.target.closest('#savebtn-smplrecieve');
        if (saveBtn && !saveBtn.disabled) {
            const extractedData = extractTableData();
            if (extractedData.length > 0) {

                // Check Auto-HL7 preference (defaults to true if unset)
                const isAutoHL7 = localStorage.getItem('auto_hl7_download') !== 'false';
                if (isAutoHL7) {
                    const hl7Message = generateCareWareHL7(extractedData);
                    downloadHL7File(hl7Message);
                }

                // Check Auto-Print preference
                const isAutoPrint = localStorage.getItem('auto_print_worklist') === 'true';
                if (isAutoPrint) {
                    printDirectly(extractedData);
                }
            }
        }
    }, true);

    function addGenerateButton() {
        const targetBtn = document.getElementById('rapidReceiveBtn');
        if (!targetBtn) return;

        // 1. Existing "Generate Report & HL7" button
        let printBtn = document.getElementById('custom-generate-report-btn');
        if (!printBtn) {
            let autoPrintEnabled = localStorage.getItem('auto_print_worklist') === 'true';
            let autoHL7Enabled = localStorage.getItem('auto_hl7_download') !== 'false'; // defaults to true

            printBtn = document.createElement('button');
            printBtn.id = 'custom-generate-report-btn';
            printBtn.type = 'button';
            printBtn.className = targetBtn.className;
            printBtn.style.backgroundColor = '#28a745';
            printBtn.style.borderColor = '#28a745';
            printBtn.style.color = '#fff';
            printBtn.style.marginLeft = '5px';
            printBtn.style.display = 'inline-flex';
            printBtn.style.alignItems = 'center';
            printBtn.style.gap = '6px';

            function renderButtonContent() {
                printBtn.innerHTML = `
                    <span>📄 Generate Report & HL7</span>
                    <span id="auto-print-toggle-pill" style="
                        display: inline-block; padding: 2px 6px; border-radius: 10px;
                        font-size: 10px; font-weight: bold; cursor: pointer;
                        background-color: ${autoPrintEnabled ? '#155724' : '#6c757d'};
                        color: #fff; border: 1px solid #fff;
                    " title="Toggle Auto-Print on Save">
                        Print: ${autoPrintEnabled ? 'ON' : 'OFF'}
                    </span>
                    <span id="auto-hl7-toggle-pill" style="
                        display: inline-block; padding: 2px 6px; border-radius: 10px;
                        font-size: 10px; font-weight: bold; cursor: pointer;
                        background-color: ${autoHL7Enabled ? '#004085' : '#6c757d'};
                        color: #fff; border: 1px solid #fff;
                    " title="Toggle Auto-HL7 download on Save">
                        HL7: ${autoHL7Enabled ? 'ON' : 'OFF'}
                    </span>
                `;

                const printPill = printBtn.querySelector('#auto-print-toggle-pill');
                if (printPill) {
                    printPill.addEventListener('click', (e) => {
                        e.stopPropagation();
                        autoPrintEnabled = !autoPrintEnabled;
                        localStorage.setItem('auto_print_worklist', autoPrintEnabled);
                        renderButtonContent();
                    });
                }

                const hl7Pill = printBtn.querySelector('#auto-hl7-toggle-pill');
                if (hl7Pill) {
                    hl7Pill.addEventListener('click', (e) => {
                        e.stopPropagation();
                        autoHL7Enabled = !autoHL7Enabled;
                        localStorage.setItem('auto_hl7_download', autoHL7Enabled);
                        renderButtonContent();
                    });
                }
            }

            renderButtonContent();
            targetBtn.parentNode.insertBefore(printBtn, targetBtn.nextSibling);

            // Manual click still generates both regardless of toggles
            printBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const extractedData = extractTableData();
                if (extractedData.length === 0) {
                    showToastNotification('Table not found or no data available. Make sure samples are loaded.', true);
                    return;
                }
                executeOrderProcessing(extractedData);
            });
        }

        // 2. NEW "new HL7" button (Downloads separate files for Alinity/VIDAPTOR and CareWare/ADM)
        if (!document.getElementById('custom-new-hl7-btn')) {
            const newHl7Btn = document.createElement('button');
            newHl7Btn.id = 'custom-new-hl7-btn';
            newHl7Btn.type = 'button';
            newHl7Btn.className = targetBtn.className;
            newHl7Btn.style.backgroundColor = '#007bff';
            newHl7Btn.style.borderColor = '#007bff';
            newHl7Btn.style.color = '#fff';
            newHl7Btn.style.marginLeft = '5px';
            newHl7Btn.style.display = 'inline-flex';
            newHl7Btn.style.alignItems = 'center';
            newHl7Btn.style.gap = '6px';
            newHl7Btn.innerHTML = `<span>🧬 new HL7</span>`;

            printBtn.parentNode.insertBefore(newHl7Btn, printBtn.nextSibling);

            newHl7Btn.addEventListener('click', (e) => {
                e.preventDefault();
                const rawData = extractRawTableData();
                if (rawData.length === 0) {
                    showToastNotification('Table not found or no data available. Make sure samples are loaded.', true);
                    return;
                }
                const ts = getHL7Timestamp();
                const { alinityHL7, carewareHL7, alinityCount, carewareCount } = generateNewSplitHL7(rawData);
                let downloadedSummary = [];

                if (alinityHL7) {
                    downloadHL7File(alinityHL7, 'Alinity_VIDAPTOR_Orders', ts);
                    downloadedSummary.push(`Alinity (${alinityCount})`);
                }
                if (carewareHL7) {
                    setTimeout(() => {
                        downloadHL7File(carewareHL7, 'CareWare_ADM_Orders', ts);
                    }, alinityHL7 ? 200 : 0);
                    downloadedSummary.push(`CareWare (${carewareCount})`);
                }

                showToastNotification(`Downloaded HL7 files: ${downloadedSummary.join(' & ')}.`);
            });
        }
    }

    const observer = new MutationObserver(() => {
        const targetBtn = document.getElementById('rapidReceiveBtn');
        if (targetBtn) addGenerateButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
